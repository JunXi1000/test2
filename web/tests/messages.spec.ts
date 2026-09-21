import { test, expect, type Page } from '@playwright/test'

/**
 * 消息页特性化 E2E（mock 模式，不需要后端）。
 *
 * **这组测试的用途是给阶段 3「消息页三份拷贝合一」当重构护栏**，不是普通的功能测试。
 * 它把重构前**实际跑通**的行为逐条钉住，重构中任何行为漂移都会立刻变红。
 *
 * 三个必须知道的点：
 *
 * 1) **极性是这组测试的重点**。dashboard 是买家视角（自己 = `sender:'user'`），
 *    merchant 是卖家视角（自己 = `sender:'merchant'`），而 mock 里那条种子消息的
 *    `senderType` 恒为 `'SHOP'` —— 所以**同一份数据在两侧必须落到相反的一侧**。
 *    这条一旦被改坏，看模板是看不出来的（class 还是那些 class），只有量几何位置才露馅。
 *
 * 2) **断言气泡位置用手量，不用 class 字符串**。重构会大改 class，绑死
 *    `'ml-auto flex-row-reverse'` 之类的写法会因为跟行为无关的改动误报。
 *
 * 3) **不断言「刷新后消息还在」**。mock 的累积数组活在模块作用域里，整页 reload
 *    会重新求值模块、消息即丢 —— 那是 mock 的性质，不是页面的行为。
 *    （mock 原先连「同一次会话内」都不留存，见下方「发送」用例；那个已在 `chat.ts` 修掉。）
 *
 * mock 数据形状（`src/api/modules/chat.ts`）：1 个会话 "Customer Support"、1 条消息。
 */

const SEED_MESSAGE = 'Hi there! How can we help you today?'
const CONVERSATION_NAME = 'Customer Support'

async function seedSession(page: Page, role: 'user' | 'merchant') {
  await page.addInitScript((r) => {
    localStorage.setItem('RUNTIME_USE_MOCK', 'true')
    localStorage.setItem(
      'nexus_user',
      JSON.stringify({ id: '1', name: 'E2E User', email: 'e2e@example.com', role: r }),
    )
    localStorage.setItem('nexus_token', 'e2e-token')
  }, role)
}

async function waitForApp(page: Page) {
  await page.waitForFunction(() => (document.getElementById('app')?.children.length ?? 0) > 0, {
    timeout: 45_000,
  })
}

/**
 * 量每个气泡落在会话区的左半还是右半边。
 * 这是「谁发的」在视觉上的**唯一可靠表达**，且与 class 写法解耦。
 */
async function bubbleSides(page: Page): Promise<Array<'left' | 'right'>> {
  return page.evaluate(() => {
    const list = document.querySelector('[data-testid="messages-list"]')
    if (!list) return []
    const listBox = list.getBoundingClientRect()
    const mid = listBox.left + listBox.width / 2
    return Array.from(document.querySelectorAll('[data-testid="messages-bubble"]')).map((el) => {
      const box = el.getBoundingClientRect()
      return box.left + box.width / 2 > mid ? 'right' : 'left'
    })
  })
}

test.describe('消息页 · 买家视角 (/dashboard/messages)', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, 'user')
  })

  test('会话列表渲染，桌面端自动选中首条并渲染其消息', async ({ page }) => {
    await page.goto('/dashboard/messages')
    await waitForApp(page)

    const items = page.getByTestId('messages-conversation-item')
    await expect(items).toHaveCount(1)
    await expect(items.first()).toContainText(CONVERSATION_NAME)

    // loadAll() 在非移动端会自动选中第一条，所以消息区应当已经有内容
    await expect(page.getByTestId('messages-list')).toBeVisible()
    await expect(page.getByTestId('messages-bubble')).toHaveCount(1)
    await expect(page.getByTestId('messages-bubble').first()).toContainText(SEED_MESSAGE)
  })

  test('种子消息来自对端，落在左侧', async ({ page }) => {
    await page.goto('/dashboard/messages')
    await waitForApp(page)
    await expect(page.getByTestId('messages-bubble')).toHaveCount(1)

    // senderType 'SHOP' → 买家视角下是「别人发的」
    expect(await bubbleSides(page)).toEqual(['left'])
  })

  test('搜索不匹配时显示空态，清空后恢复', async ({ page }) => {
    await page.goto('/dashboard/messages')
    await waitForApp(page)

    const search = page.getByTestId('messages-search')
    await search.fill('zzz-no-such-conversation-zzz')

    const empty = page.getByTestId('messages-empty')
    await expect(empty).toBeVisible()
    await expect(empty).toContainText('No conversations found')
    await expect(page.getByTestId('messages-conversation-item')).toHaveCount(0)

    await search.fill('')
    await expect(page.getByTestId('messages-conversation-item')).toHaveCount(1)
  })

  test('发送的消息立刻出现、落在右侧，且会话预览同步更新', async ({ page }) => {
    await page.goto('/dashboard/messages')
    await waitForApp(page)
    await expect(page.getByTestId('messages-bubble')).toHaveCount(1)

    const text = 'E2E-ping-buyer'
    await page.getByTestId('messages-input').fill(text)
    await page.getByTestId('messages-send').click()

    // 发完 doSendMessage 会 refreshActiveMessages() + loadConversations()，
    // 所以这里等的是「重拉之后它还在」—— 原先 mock 不落库时这一步必然失败。
    await expect(page.getByTestId('messages-bubble')).toHaveCount(2)
    await expect(page.getByTestId('messages-bubble').last()).toContainText(text)

    // 自己发的在右侧；且此时列表里是 [对端, 自己]
    expect(await bubbleSides(page)).toEqual(['left', 'right'])

    // 会话预览也跟上了（证明 loadConversations 的链路是通的）
    await expect(page.getByTestId('messages-conversation-item').first()).toContainText(text)
  })

  test('窄屏默认停在列表，点会话后切到聊天', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/dashboard/messages')
    await waitForApp(page)

    // 移动端不自动选中，且 showChat 为 false → 聊天区整个不渲染
    await expect(page.getByTestId('messages-conversation-item')).toHaveCount(1)
    await expect(page.getByTestId('messages-list')).toBeHidden()

    await page.getByTestId('messages-conversation-item').first().click()
    await expect(page.getByTestId('messages-list')).toBeVisible()
    await expect(page.getByTestId('messages-bubble')).toHaveCount(1)
  })

  test('超宽屏出现第三栏，默认两栏', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/dashboard/messages')
    await waitForApp(page)

    // isUltraWide 为真，但 ultraWideMode 默认 'two' → 检查器不出
    await expect(page.getByTestId('messages-conversation-item')).toBeVisible()
    await expect(page.getByTestId('messages-inspector')).toBeHidden()

    // 切到三栏
    await page.getByRole('button', { name: 'Switch to three columns' }).click()
    const inspector = page.getByTestId('messages-inspector')
    await expect(inspector).toBeVisible()
    await expect(inspector).toContainText('Conversation Details')
    // 买家视角这里显示的是对端（商家）
    await expect(inspector).toContainText(CONVERSATION_NAME)
  })
})

test.describe('消息页 · 卖家视角 (/merchant/dashboard/messages)', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, 'merchant')
  })

  test('同一份 mock 数据渲染成「自己发的」，落在右侧（与买家视角相反）', async ({ page }) => {
    await page.goto('/merchant/dashboard/messages')
    await waitForApp(page)

    await expect(page.getByTestId('messages-conversation-item')).toHaveCount(1)
    await expect(page.getByTestId('messages-bubble')).toHaveCount(1)
    await expect(page.getByTestId('messages-bubble').first()).toContainText(SEED_MESSAGE)

    // 同一条 senderType 'SHOP' 的消息，在卖家视角下是自己发的 —— 这就是极性。
    // 与上面「买家视角」那条用例的期望值**必须相反**。
    expect(await bubbleSides(page)).toEqual(['right'])
  })

  test('搜索不匹配时显示空态', async ({ page }) => {
    await page.goto('/merchant/dashboard/messages')
    await waitForApp(page)

    await page.getByTestId('messages-search').fill('zzz-no-such-conversation-zzz')

    const empty = page.getByTestId('messages-empty')
    await expect(empty).toBeVisible()
    await expect(empty).toContainText('No conversations found')
    await expect(page.getByTestId('messages-conversation-item')).toHaveCount(0)
  })

  test('发送的消息落在右侧', async ({ page }) => {
    await page.goto('/merchant/dashboard/messages')
    await waitForApp(page)
    await expect(page.getByTestId('messages-bubble')).toHaveCount(1)

    const text = 'E2E-ping-seller'
    await page.getByTestId('messages-input').fill(text)
    await page.getByTestId('messages-send').click()

    await expect(page.getByTestId('messages-bubble')).toHaveCount(2)
    await expect(page.getByTestId('messages-bubble').last()).toContainText(text)
    // 卖家视角下两条都是自己发的
    expect(await bubbleSides(page)).toEqual(['right', 'right'])
  })
})

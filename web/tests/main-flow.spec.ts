import { test, expect, type Page } from '@playwright/test'

/**
 * 主流程 E2E（mock 模式，不需要后端）。
 *
 * 全部断言都基于实际跑通的行为，选择器优先用 data-testid。
 *
 * 三个必须知道的前提：
 *
 * 1) mock 开关要走 localStorage 覆盖 —— `src/config/env.ts` 里
 *    `RUNTIME_USE_MOCK` 优先于 `VITE_USE_MOCK`，必须在应用启动前写入，
 *    所以只能用 addInitScript，不能 page.goto 之后再设。
 *
 * 2) 站内跳转必须点链接，不能 page.goto —— `stores/cart.ts` 的持久化条件
 *    在「mock + 登录态」下两头不落地（见 REFACTOR_PLAN 的待确认项）：
 *    登录态不写 localStorage，mock 又不写服务端，购物车只存在内存里。
 *    page.goto 会整页重载，内存态即丢。点链接走 SPA 路由则不受影响，
 *    这个写法在持久化修好之后依然成立。
 *
 * 3) 支付结果是按卡号路由的（`api/modules/payment.ts` 的 routeCardScenario），
 *    所以成功/3DS/拒付三条分支都能确定性地测，不依赖随机数。
 */

const CARD_SUCCESS = '4242424242424242'
const CARD_3DS = '4000002500003155'
const CARD_DECLINE = '4000000000000002'

/** mock 开关 + 可选的登录态注入，必须在页面加载前执行 */
async function seedSession(page: Page, options: { loggedIn?: boolean } = {}) {
  const { loggedIn = true } = options
  await page.addInitScript((logged) => {
    localStorage.setItem('RUNTIME_USE_MOCK', 'true')
    if (logged) {
      // initAuth() 只认 role ∈ user/admin/merchant，其余会清空登录态
      localStorage.setItem(
        'nexus_user',
        JSON.stringify({ id: '1', name: 'E2E User', email: 'e2e@example.com', role: 'user' }),
      )
      localStorage.setItem('nexus_token', 'e2e-token')
    }
  }, loggedIn)
}

/** 等应用真正挂载完成——首页首屏是懒加载的，等固定毫秒数会飘 */
async function waitForApp(page: Page) {
  await page.waitForFunction(() => (document.getElementById('app')?.children.length ?? 0) > 0, {
    timeout: 45_000,
  })
}

/** 首页商品卡的 quick-add（不需要选颜色/尺码，避免踩 ensureSelectionsOrWarn 的门槛） */
async function quickAddFirstProduct(page: Page) {
  const addButton = page.locator('button:has-text("Add")').first()
  await expect(addButton).toBeVisible()
  await addButton.click()
}

/** 从购物车进入结算并填完收货信息，停在支付步 */
async function gotoCheckoutAndFillShipping(page: Page) {
  // 点 header 的购物车链接：SPA 导航，不整页重载
  await page.locator('a[href="/cart"]').first().click()
  await page.waitForURL(/\/cart$/, { timeout: 15_000 })
  await expect(page.getByTestId('cart-checkout')).toBeVisible()

  await page.getByTestId('cart-checkout').click()
  await page.waitForURL(/\/checkout/, { timeout: 15_000 })

  await page.getByTestId('checkout-email').fill('e2e@example.com')
  await page.getByTestId('checkout-first-name').fill('Alex')
  await page.getByTestId('checkout-last-name').fill('Doe')
  await page.getByTestId('checkout-address').fill('1 Infinite Loop')
  await page.getByTestId('checkout-city').fill('Cupertino')
  await page.getByTestId('checkout-zip').fill('95014')
  await page.getByTestId('checkout-next').click()

  // 校验通过后应该推进到支付步
  await expect(page.getByTestId('checkout-card-number')).toBeVisible()
}

/** 填卡 → 推进到 Review → 点 Pay 真正发起支付 */
async function payWithCard(page: Page, cardNumber: string) {
  await page.getByTestId('checkout-card-number').fill(cardNumber)
  await page.getByTestId('checkout-expiry').fill('1230')
  await page.getByTestId('checkout-cvc').fill('123')
  await page.getByTestId('checkout-next').click()

  // 支付步点一次只是推进到 Review，按钮文案变成 "Pay $xx"
  await expect(page.getByTestId('checkout-next')).toContainText('Pay')
  // nextStep() 只在最后一步才调 handlePayment()，所以这里必须再点一次
  await page.getByTestId('checkout-next').click()
}

test.describe('登录', () => {
  test('mock 模式下用表单登录，落到首页并写入登录态', async ({ page }) => {
    await seedSession(page, { loggedIn: false })

    await page.goto('/login')
    await page.getByTestId('login-username').fill('e2e@example.com')
    await page.getByTestId('login-password').fill('Passw0rd!123')
    await page.getByTestId('login-submit').click()

    // 用户角色登录后回首页
    await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 })

    const user = await page.evaluate(() => localStorage.getItem('nexus_user'))
    expect(JSON.parse(user ?? '{}')).toMatchObject({
      email: 'e2e@example.com',
      role: 'user',
    })
    expect(await page.evaluate(() => localStorage.getItem('nexus_token'))).toBeTruthy()
  })
})

test.describe('浏览与加购', () => {
  test('首页加购后购物车能看到该商品', async ({ page }) => {
    await seedSession(page)
    await page.goto('/')
    await waitForApp(page)

    await quickAddFirstProduct(page)
    await page.locator('a[href="/cart"]').first().click()
    await page.waitForURL(/\/cart$/, { timeout: 15_000 })

    await expect(page.locator('body')).toContainText('1 item(s) in your cart')
    await expect(page.getByTestId('cart-checkout')).toBeVisible()
  })

  test('商品详情页加购按钮存在且可点', async ({ page }) => {
    await seedSession(page)
    await page.goto('/product/1')
    await waitForApp(page)

    const addToBag = page.getByTestId('pdp-add-to-bag')
    await expect(addToBag).toBeVisible()
    await expect(addToBag).toContainText('ADD TO BAG')
  })
})

test.describe('下单', () => {
  test('3DS 卡：认证弹窗确认后下单成功，落到 thank-you', async ({ page }) => {
    await seedSession(page)
    await page.goto('/')
    await waitForApp(page)

    await quickAddFirstProduct(page)
    await gotoCheckoutAndFillShipping(page)
    await payWithCard(page, CARD_3DS)

    // 3DS 卡应该弹认证框，而不是直接扣款
    const completeAuth = page.locator('button:has-text("Complete Authentication")')
    await expect(completeAuth).toBeVisible({ timeout: 15_000 })
    await completeAuth.click()

    await page.waitForURL(/\/thank-you/, { timeout: 20_000 })
    await expect(page.locator('body')).toContainText('Your order has been confirmed')

    const orderId = new URL(page.url()).searchParams.get('orderId')
    expect(orderId).toMatch(/^ORD-\d+$/)
  })

  test('成功卡：不弹 3DS，直接下单成功', async ({ page }) => {
    await seedSession(page)
    await page.goto('/')
    await waitForApp(page)

    await quickAddFirstProduct(page)
    await gotoCheckoutAndFillShipping(page)
    await payWithCard(page, CARD_SUCCESS)

    // 「直接到达 thank-you」本身就是没走 3DS 的证据：requires_action 分支
    // 不会跳转，而是停在结算页等认证弹窗。
    await page.waitForURL(/\/thank-you/, { timeout: 20_000 })
    await expect(page.locator('body')).toContainText('Your order has been confirmed')
  })

  test('拒付卡：停留在结算页并显示拒付原因', async ({ page }) => {
    await seedSession(page)
    await page.goto('/')
    await waitForApp(page)

    await quickAddFirstProduct(page)
    await gotoCheckoutAndFillShipping(page)
    await payWithCard(page, CARD_DECLINE)

    // 不能跳走，且要把失败原因摆出来
    await expect(page.locator('body')).toContainText('declined', { timeout: 15_000 })
    expect(new URL(page.url()).pathname).toBe('/checkout')
  })
})

test.describe('退换', () => {
  test('登录态下退换页可达并渲染空态', async ({ page }) => {
    await seedSession(page)
    await page.goto('/dashboard/returns')
    await waitForApp(page)

    await expect(page.locator('body')).toContainText('Returns & Refunds')
    await expect(page.locator('body')).toContainText('No return requests')
    await expect(page.locator('button:has-text("New Return")')).toBeVisible()
  })
})

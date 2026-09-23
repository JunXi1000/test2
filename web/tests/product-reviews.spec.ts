import { test, expect, type Page } from '@playwright/test'

/**
 * 商品详情页「评价区」E2E（mock 模式，不需要后端）。
 *
 * 为什么单独建这个文件：阶段 7f 把评价区从 `ProductDetail.vue` 整块搬进了
 * `useProductReviews` + `<ReviewSection>`（389 行模板 + 约 490 行脚本），
 * 而这块**此前没有任何 E2E**（`admin-lists.spec.ts` 里那几条 review 测试是后台审核列表，
 * 另一个页面）。搬完才补护栏，顺序不如阶段 5 那样「先护栏后重构」，所以这里把
 * 「搬完仍然可用」的判据写全一点。
 *
 * 不往 `features.spec.ts` 堆 —— 那是「什么都测一点」的大文件（见 REFACTOR_PLAN 阶段 0）。
 *
 * 选择器约定：能按 role/text 就按，避免绑定 class。评价卡本身没有 data-testid，
 * 所以用「用户名」这类稳定文案定位。
 */

/** mock 开关必须在应用启动前写入：RUNTIME_USE_MOCK 优先于 VITE_USE_MOCK */
async function seedSession(page: Page, options: { loggedIn?: boolean } = {}) {
  const { loggedIn = false } = options
  await page.addInitScript((logged) => {
    localStorage.setItem('RUNTIME_USE_MOCK', 'true')
    if (logged) {
      localStorage.setItem(
        'nexus_user',
        JSON.stringify({ id: '1', name: 'E2E User', email: 'e2e@example.com', role: 'user' }),
      )
      localStorage.setItem('nexus_token', 'e2e-token')
    }
    // 每个用例从干净的本地评价开始：这份数据按商品 id 存在 localStorage，会跨用例泄漏。
    //
    // 但不能无条件清 —— addInitScript 在**每次**导航（含 page.reload）都会跑，
    // 无脑清会把「刷新后仍在」那条用例刚写进去的评价也一起抹掉。
    // 用 sessionStorage 当哨兵：同一次会话只在首次加载清。
    if (!sessionStorage.getItem('__e2e_reviews_seeded')) {
      localStorage.removeItem('product_reviews_1')
      localStorage.removeItem('product_review_helpful_delta_1')
      localStorage.removeItem('product_review_helpful_voted_1')
      sessionStorage.setItem('__e2e_reviews_seeded', '1')
    }
  }, loggedIn)
}

async function gotoReviews(page: Page) {
  await page.goto('/product/1')
  await page.waitForFunction(() => (document.getElementById('app')?.children.length ?? 0) > 0, {
    timeout: 45_000,
  })
  const root = page.locator('#reviews-section')
  await expect(root).toBeVisible({ timeout: 15_000 })
  return root
}

/** 种子评价的 8 位作者 —— 断言「渲染了哪几条」时用 */
const SEED_AUTHORS = [
  'Alex Chen',
  'Sarah Miller',
  'Jordan Wang',
  'Emily Zhang',
  'Michael Brown',
  'Lisa Park',
  'David Kim',
  'Rachel Torres',
]

test.describe('商品详情 · 评价区', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page)
  })

  test('渲染种子评价：首屏 6 条，其余靠 Load More', async ({ page }) => {
    const root = await gotoReviews(page)

    await expect(root.getByText(/8 reviews/)).toBeVisible()
    for (const name of SEED_AUTHORS.slice(0, 6)) {
      await expect(root.getByText(name, { exact: true })).toBeVisible()
    }
    // 第 7、8 条要翻页才出来
    await expect(root.getByText('David Kim', { exact: true })).toBeHidden()
    await expect(root.getByRole('button', { name: /Load More Reviews/ })).toBeVisible()
  })

  test('Load More 把剩下的评价放出来，按钮随之消失', async ({ page }) => {
    const root = await gotoReviews(page)

    await root.getByRole('button', { name: /Load More Reviews/ }).click()

    await expect(root.getByText('David Kim', { exact: true })).toBeVisible()
    await expect(root.getByText('Rachel Torres', { exact: true })).toBeVisible()
    await expect(root.getByRole('button', { name: /Load More Reviews/ })).toBeHidden()
  })

  test('评分分布按 5→1 列出五档', async ({ page }) => {
    const root = await gotoReviews(page)

    // 分布条每档形如 [星数][星标][横条][条数]
    for (const star of ['5', '4', '3', '2', '1']) {
      await expect(root.locator(`text="${star}"`).first()).toBeVisible()
    }
  })

  test('星级筛选：点 5★ 后只剩 5 星评价', async ({ page }) => {
    const root = await gotoReviews(page)

    await root.getByRole('button', { name: '5★' }).click()

    // 种子里的 5 星是 Alex Chen / Jordan Wang / Michael Brown
    await expect(root.getByText('Alex Chen', { exact: true })).toBeVisible()
    await expect(root.getByText('Sarah Miller', { exact: true })).toBeHidden()
    await expect(root.getByText('Lisa Park', { exact: true })).toBeHidden()
  })

  test('搜索命中作者名', async ({ page }) => {
    const root = await gotoReviews(page)

    await root.getByPlaceholder('Search reviews...').fill('Sarah')

    await expect(root.getByText('Sarah Miller', { exact: true })).toBeVisible()
    await expect(root.getByText('Alex Chen', { exact: true })).toBeHidden()
  })

  test('搜索命中正文（不只是作者名）', async ({ page }) => {
    const root = await gotoReviews(page)

    // 'expectations' 只出现在 Alex Chen 那条正文里，不在任何作者名中
    await root.getByPlaceholder('Search reviews...').fill('expectations')

    await expect(root.getByText('Alex Chen', { exact: true })).toBeVisible()
    await expect(root.getByText('Sarah Miller', { exact: true })).toBeHidden()
  })

  test('"With Images" 只留带图评价', async ({ page }) => {
    const root = await gotoReviews(page)

    await root.getByRole('button', { name: 'With Images' }).click()

    // 种子里只有 Michael Brown 带图
    await expect(root.getByText('Michael Brown', { exact: true })).toBeVisible()
    await expect(root.getByText('Alex Chen', { exact: true })).toBeHidden()
  })

  test('筛选到空集时显示空态与「清空筛选」，点了能恢复', async ({ page }) => {
    const root = await gotoReviews(page)

    await root.getByPlaceholder('Search reviews...').fill('zzz-no-such-review')

    await expect(root.getByText('No reviews match your filters.')).toBeVisible()
    await root.getByText('Clear filters').click()
    await expect(root.getByText('Alex Chen', { exact: true })).toBeVisible()
  })

  test('排序切到 Most Helpful 后，helpful 最多的那条排第一', async ({ page }) => {
    const root = await gotoReviews(page)

    await root.locator('select').selectOption('most-helpful')

    // 种子里 Michael Brown 是 20（最高）。用第一张卡的文本判断
    const firstCard = root.locator('.rounded-xl.border.border-border.bg-card').first()
    await expect(firstCard).toContainText('Michael Brown')
  })

  test('helpful 投票 +1，且同一评价只能投一次', async ({ page }) => {
    const root = await gotoReviews(page)
    // lucide 图标自带 lucide-<name> class，比按文案定位稳
    const voteButton = root.locator('button:has(svg.lucide-thumbs-up)').first()

    const before = Number((await voteButton.innerText()).trim())
    await voteButton.click()

    await expect(voteButton).toHaveText(String(before + 1))
    // 再点一次：提示已投，计数不变
    await voteButton.click()
    await expect(page.getByText('Already marked helpful')).toBeVisible()
    await expect(voteButton).toHaveText(String(before + 1))
  })

  test('未登录点 Reply 会引导登录，而不是静默失败', async ({ page }) => {
    const root = await gotoReviews(page)

    await root
      .getByRole('button', { name: /^Reply/ })
      .first()
      .click()

    await expect(page.getByText('You need to log in to reply.')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('未登录写评价：提示并跳登录', async ({ page }) => {
    const root = await gotoReviews(page)

    await root.getByRole('button', { name: 'WRITE A REVIEW' }).click()
    await root.getByPlaceholder('Share your experience with this product...').fill('很不错的商品')
    await root.getByRole('button', { name: 'Post Review' }).click()

    await expect(page).toHaveURL(/\/login/)
  })

  test('带图评价的图片可点开灯箱，点背景关闭', async ({ page }) => {
    const root = await gotoReviews(page)

    // Michael Brown 那条带图
    await root.getByRole('button', { name: 'With Images' }).click()
    await root.locator('img.cursor-zoom-in').first().click()

    const lightbox = page.locator('.backdrop-blur-sm')
    await expect(lightbox).toBeVisible()
    await lightbox.click({ position: { x: 10, y: 10 } })
    await expect(lightbox).toBeHidden()
  })
})

test.describe('商品详情 · 评价区（登录态）', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { loggedIn: true })
  })

  test('登录后可以写评价，提交后立刻出现在最上面并计入总数', async ({ page }) => {
    const root = await gotoReviews(page)

    await root.getByRole('button', { name: 'WRITE A REVIEW' }).click()
    await root.getByPlaceholder('Share your experience with this product...').fill('E2E 写的评价')
    await root.getByRole('button', { name: 'Post Review' }).click()

    await expect(page.getByText('Review submitted')).toBeVisible()
    await expect(root.getByText('E2E 写的评价')).toBeVisible()
    await expect(root.getByText(/9 reviews/)).toBeVisible()
    // 自己写的评价有删除按钮
    await expect(root.getByTitle('Delete your review')).toBeVisible()
  })

  test('登录后可以回复一条**种子**评价，且该评价不会重复出现', async ({ page }) => {
    const root = await gotoReviews(page)

    await expect(root.getByText(/8 reviews/)).toBeVisible()
    await root.locator('button:has(svg.lucide-reply)').first().click()
    await root.getByPlaceholder('Write a reply...').fill('谢谢反馈')
    // 「Reply」既是每张卡的操作按钮也是提交按钮，按 role+name 会撞上 6 个 —— 用 testid
    await root.getByTestId('review-reply-submit').click()

    await expect(page.getByText('Reply posted')).toBeVisible()
    // 关键：回复种子评价会把种子克隆进用户区。若两处都渲染，作者名会出现两次
    await expect(root.getByText('Sarah Miller', { exact: true })).toHaveCount(1)
    await expect(root.getByText('谢谢反馈')).toBeVisible()
  })

  test('刷新后自己写的评价与回复仍在（localStorage 持久化）', async ({ page }) => {
    const root = await gotoReviews(page)
    await root.getByRole('button', { name: 'WRITE A REVIEW' }).click()
    await root.getByPlaceholder('Share your experience with this product...').fill('持久化检查')
    await root.getByRole('button', { name: 'Post Review' }).click()
    await expect(root.getByText('持久化检查')).toBeVisible()

    await page.reload({ waitUntil: 'domcontentloaded' })

    const again = page.locator('#reviews-section')
    await expect(again.getByText('持久化检查')).toBeVisible({ timeout: 15_000 })
  })
})

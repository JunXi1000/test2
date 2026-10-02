import { test, expect, type Page } from '@playwright/test'

/**
 * 商品详情页「评价区」E2E。
 *
 * ## 本文件在 TASK-002 被**整体改判**（原 13 条断言已失效）
 *
 * 原文件断言「渲染 8 条种子评价」并围绕它们做筛选/排序/投票/回复/LoadMore。
 * 但本批已刻意**关闭伪造评价**：`web/src/api/modules/reviews.ts` 的
 * `SEED_REVIEWS_ENABLED = false`，评价区因此渲染**诚实空态**。
 *
 * **处置原则（Lead 裁决）**：把这些断言改写为断言「诚实空态」，**不跳过、不保留伪造评价断言**。
 * 理由与「不得为绿灯恢复已删除的错误语义」是同一条：
 *   - 保留 = 把已删除的行为钉住，测试会替一个不再存在的产品行为背书；
 *   - 跳过 = 隐藏真实产品行为，读者无从知道评价区现在是空的。
 *
 * ⚠️ **可见行为变更（需向用户披露）**：商品详情页**不再展示演示评价**（此前 8 条编造评价）。
 * 这是有意的诚实降级 —— 后端评价端点就位后把开关翻回 `true` 即可恢复，
 * `useProductReviews` 的合并/水合/迁移逻辑全部原样保留。
 *
 * ## 仍然覆盖的（真实、不依赖种子）
 * - 空态文案、`0 reviews` 计数、筛选控件仍可用且不报错；
 * - 登录用户**可以写评价**：提交后立刻出现、计数变 `1 reviews`、可删除、刷新后仍在（localStorage）；
 * - 未登录写评价 → 引导登录。
 *
 * ## 明确**不再覆盖**（随种子一起下线，属已知缺口）
 * Load More 分页、星级筛选到非空集、搜索命中作者/正文、"With Images" 只看带图、
 * Most Helpful 排序、helpful 投票、回复**种子**评价、带图评价灯箱。
 * 这些都需要**真实评价数据**才有意义 —— 后端评价端点落地后应连同种子一起恢复。
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

/**
 * 已下线的**演示种子**作者。保留这份名单是为了**反向断言**：它们一个都不该出现
 * （这正是"伪造评价已关闭"的可观测证据）。
 */
const RETIRED_SEED_AUTHORS = [
  'Alex Chen',
  'Sarah Miller',
  'Jordan Wang',
  'Emily Zhang',
  'Michael Brown',
  'Lisa Park',
  'David Kim',
  'Rachel Torres',
]

const EMPTY_TEXT = 'No reviews yet. Be the first to share your experience.'

test.describe('商品详情 · 评价区（匿名）—— 诚实空态', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page)
  })

  test('禁用演示种子后渲染诚实空态：0 条评价 + 空态文案', async ({ page }) => {
    const root = await gotoReviews(page)

    await expect(root.getByText(EMPTY_TEXT)).toBeVisible()
    await expect(root.getByText('0 reviews')).toBeVisible()
    // 空态下不该出现「清空筛选」—— 没有任何评价被筛掉,重置按钮是无意义的
    await expect(root.getByText('Clear filters')).toHaveCount(0)
  })

  test('演示种子作者一个都不出现（反向断言:伪造评价确实关闭）', async ({ page }) => {
    const root = await gotoReviews(page)

    for (const name of RETIRED_SEED_AUTHORS) {
      await expect(root.getByText(name, { exact: true })).toHaveCount(0)
    }
  })

  test('没有评价时筛选与搜索控件仍在，且操作不报错', async ({ page }) => {
    const root = await gotoReviews(page)

    // 控件仍渲染（模板未按"有评价"条件隐藏）
    await expect(root.getByPlaceholder('Search reviews...')).toBeVisible()
    await expect(root.getByRole('button', { name: '5★' })).toBeVisible()
    await expect(root.getByRole('button', { name: 'With Images' })).toBeVisible()

    // 空集上操作：仍是空态、不得抛错或白屏
    await root.getByPlaceholder('Search reviews...').fill('zzz-no-such-review')
    await root.getByRole('button', { name: '5★' }).click()
    await expect(root.getByText(EMPTY_TEXT)).toBeVisible()
    await expect(root.getByText('0 reviews')).toBeVisible()
  })

  test('未登录写评价：引导登录', async ({ page }) => {
    const root = await gotoReviews(page)

    await root.getByRole('button', { name: 'WRITE A REVIEW' }).click()
    await root.getByPlaceholder('Share your experience with this product...').fill('很不错的商品')
    await root.getByRole('button', { name: 'Post Review' }).click()

    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('商品详情 · 评价区（登录态）—— 唯一数据来源是用户自己写的', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { loggedIn: true })
  })

  test('登录后写评价：提交后立刻出现、计数从 0 变 1、可删除', async ({ page }) => {
    const root = await gotoReviews(page)

    await expect(root.getByText('0 reviews')).toBeVisible()

    await root.getByRole('button', { name: 'WRITE A REVIEW' }).click()
    await root.getByPlaceholder('Share your experience with this product...').fill('E2E 写的评价')
    await root.getByRole('button', { name: 'Post Review' }).click()

    await expect(page.getByText('Review submitted')).toBeVisible()
    await expect(root.getByText('E2E 写的评价')).toBeVisible()
    await expect(root.getByText('1 reviews')).toBeVisible()
    // 自己写的评价有删除按钮
    await expect(root.getByTitle('Delete your review')).toBeVisible()
    // 空态随数据出现而消失
    await expect(root.getByText(EMPTY_TEXT)).toHaveCount(0)
  })

  test('刷新后自己写的评价仍在（localStorage 持久化）', async ({ page }) => {
    const root = await gotoReviews(page)
    await root.getByRole('button', { name: 'WRITE A REVIEW' }).click()
    await root.getByPlaceholder('Share your experience with this product...').fill('持久化检查')
    await root.getByRole('button', { name: 'Post Review' }).click()
    await expect(root.getByText('持久化检查')).toBeVisible()

    await page.reload({ waitUntil: 'domcontentloaded' })

    const again = page.locator('#reviews-section')
    await expect(again.getByText('持久化检查')).toBeVisible({ timeout: 15_000 })
    await expect(again.getByText('1 reviews')).toBeVisible()
  })
})

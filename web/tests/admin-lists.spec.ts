import { test, expect, type Page } from '@playwright/test'

/**
 * 5 个 admin 列表页的特性化 E2E（mock 模式，不需要后端）。
 *
 * **这组测试的用途是给阶段 5「列表页抽象」当重构护栏**，不是普通的功能测试。
 * 它把重构前**实际跑通**的行为逐条钉住，重构中任何行为漂移都会立刻变红。
 * 覆盖：admin/Merchants、admin/Orders、admin/Products、admin/Reviews、admin/Users。
 * （merchant 两页与 dashboard/Orders 不在阶段 5 范围内，见 REFACTOR_PLAN 阶段 5。）
 *
 * 四个必须知道的点：
 *
 * 1) **断言挂「用户可见文本」，不挂 class 字符串**。阶段 5 会把 `.admin-toolbar-shell`
 *    这类外壳收进 `<DataTablePanel>`。所以：搜索框用 placeholder 定位、筛选器用
 *    `data-testid="list-status-filter"`、空态用文案、商品卡用商品标题。
 *    唯一例外是 `el-table` 内部结构（`.el-table__row`）—— CLAUDE.md 明令 `el-table` 不动。
 *
 * 2) **`data-testid="list-status-filter"` 是给测试用的契约**。EP 的 `el-select` 把
 *    "All Status" 渲染成 span 而非 input placeholder，没有可靠的可见文本锚点；
 *    而绑 `admin-toolbar-select` 这类 class 正是阶段 3 警告过的写法（重构会动 class）。
 *    重构时**必须保留这个 testid**，否则这组护栏会因非行为原因误报。
 *
 * 3) **不断言请求次数**。清空搜索时「发两次请求」是既有缺陷（阶段 5 的 5b 要修），
 *    把它写进断言等于把 bug 固化成契约。这里只钉用户看得见的结果。
 *
 * 4) **业务动作会写回 localStorage**（approve / toggle / ban 等），且下次读会优先读它。
 *    这组测试只读不写，所以每个 test 的独立 context 已经足够隔离 —— 别在这里加写操作。
 *
 * mock 数据规模（`src/api/modules/admin*.ts`，全部真正响应 `q` 与筛选参数，不是忽略）：
 * merchants 6 / orders 5 / products 3 / reviews 8 / users 4。
 * 注意 users 的筛选键是 **role 不是 status**，products 的 draft、archived **没有任何数据**
 * （正好用来引脚空态），而 merchants 的 `rejected` 记录在 UI 下拉里**够不到**。
 */

async function seedSession(page: Page, role: 'user' | 'admin' | 'merchant') {
  await page.addInitScript((r) => {
    localStorage.setItem('RUNTIME_USE_MOCK', 'true')
    localStorage.setItem(
      'nexus_user',
      JSON.stringify({ id: '1', name: 'E2E Admin', email: 'e2e@example.com', role: r }),
    )
    localStorage.setItem('nexus_token', 'e2e-token')
  }, role)
}

async function waitForApp(page: Page) {
  await page.waitForFunction(() => (document.getElementById('app')?.children.length ?? 0) > 0, {
    timeout: 45_000,
  })
}

/** 种 admin 会话后直达指定后台页，并等到该页真正挂载 */
async function gotoAdminList(page: Page, path: string) {
  await seedSession(page, 'admin')
  await page.goto(path)
  await waitForApp(page)

  // waitForApp 只保证应用外壳挂上了（#app 有子节点），而路由组件是懒加载 chunk：
  // 冷启动时 vite 还要现编译这个 chunk，4 个 worker 并行各自点开一个 admin chunk
  // 时这一步能远超 10s，于是断言在「组件还没挂载」的 10s 里数到 0 行 —— 假的红。
  // 这里先等页面自己的筛选器出现（就是下面各条断言依赖的那个 testid 契约），
  // 再交给断言，超时给足冷编译的开销。
  await page
    .locator('[data-testid="list-status-filter"]')
    .waitFor({ state: 'attached', timeout: 60_000 })
}

/** mock 有 300ms debounce + 最慢 500ms 延迟，断言统一放宽到 10s */
const SETTLE = { timeout: 10_000 }

/**
 * 后台页面的真实前缀是 `/admin/dashboard`，**不是 `/admin`**
 * （`/admin` 自身 redirect 到 `/admin/login`；见 `src/router/index.ts:25-68`）。
 * 写成 `/admin/merchants` 会落到 404 页，测出来的红全是假的。
 */
const ADMIN_BASE = '/admin/dashboard'

function searchInput(page: Page, placeholder: string) {
  return page.getByPlaceholder(placeholder)
}

/** el-table 的行。CLAUDE.md 明令 el-table 不动，所以这个选择器在阶段 5 里是安全的 */
function tableRows(page: Page) {
  return page.locator('.el-table__row')
}

/**
 * 选状态筛选。EP 的下拉 teleport 到 body，且页面里可能残留已关闭下拉的同名隐藏项
 * （既有 E2E 踩过这个坑），所以必须加 `:visible`。
 */
async function pickFilter(page: Page, label: string) {
  await page.locator('[data-testid="list-status-filter"]').click()
  await page.locator(`.el-select-dropdown__item:has-text("${label}"):visible`).first().click()
}

test.describe('admin/Merchants — 列表机制', () => {
  const PATH = `${ADMIN_BASE}/merchants`
  const SEARCH = 'Search by store, owner, or email...'

  test('首屏渲染全部 6 个商家', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(tableRows(page)).toHaveCount(6, SETTLE)
    await expect(page.getByText('Nexus Tech')).toBeVisible()
    await expect(page.getByText('Kids Corner')).toBeVisible()
  })

  test('搜索 "Nexus" 命中 1 个商家', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(tableRows(page)).toHaveCount(6, SETTLE)

    await searchInput(page, SEARCH).fill('Nexus')
    await expect(tableRows(page)).toHaveCount(1, SETTLE)
    await expect(page.getByText('Nexus Tech')).toBeVisible()
    await expect(page.getByText('Kids Corner')).toHaveCount(0)
  })

  test('搜索无匹配时显示空态', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(tableRows(page)).toHaveCount(6, SETTLE)

    await searchInput(page, SEARCH).fill('zzz-no-such-merchant')
    await expect(tableRows(page)).toHaveCount(0, SETTLE)
    await expect(page.getByText('No merchants found')).toBeVisible()
  })

  test('清空搜索后恢复全部 6 个商家', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(tableRows(page)).toHaveCount(6, SETTLE)

    await searchInput(page, SEARCH).fill('Nexus')
    await expect(tableRows(page)).toHaveCount(1, SETTLE)

    await searchInput(page, SEARCH).fill('')
    await expect(tableRows(page)).toHaveCount(6, SETTLE)
  })

  test('筛选 Pending Review 只显示 2 个待审商家', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(tableRows(page)).toHaveCount(6, SETTLE)

    await pickFilter(page, 'Pending Review')
    await expect(tableRows(page)).toHaveCount(2, SETTLE)
    await expect(page.getByText('Gadget World')).toBeVisible()
    await expect(page.getByText('Green Living')).toBeVisible()
  })
})

test.describe('admin/Orders — 列表机制', () => {
  const PATH = `${ADMIN_BASE}/orders`
  const SEARCH = 'Search by order ID, customer, or merchant...'

  test('首屏渲染全部 5 个订单', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(tableRows(page)).toHaveCount(5, SETTLE)
    await expect(page.getByText('ORD-001')).toBeVisible()
  })

  test('搜索 "John Doe" 命中 2 个订单', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(tableRows(page)).toHaveCount(5, SETTLE)

    await searchInput(page, SEARCH).fill('John Doe')
    await expect(tableRows(page)).toHaveCount(2, SETTLE)
  })

  test('搜索无匹配时显示空态', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(tableRows(page)).toHaveCount(5, SETTLE)

    await searchInput(page, SEARCH).fill('zzz-no-such-order')
    await expect(tableRows(page)).toHaveCount(0, SETTLE)
    await expect(page.getByText('No orders found')).toBeVisible()
  })

  test('筛选 Shipped 只显示 1 个订单', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(tableRows(page)).toHaveCount(5, SETTLE)

    await pickFilter(page, 'Shipped')
    await expect(tableRows(page)).toHaveCount(1, SETTLE)
    await expect(page.getByText('ORD-002')).toBeVisible()
  })
})

test.describe('admin/Products — 列表机制（网格，非 el-table）', () => {
  const PATH = `${ADMIN_BASE}/products`
  const SEARCH = 'Search by name or merchant...'

  test('首屏渲染全部 3 个商品', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(page.getByText('Nexus VR Pro')).toBeVisible(SETTLE)
    await expect(page.getByText('Smart Ring')).toBeVisible()
    await expect(page.getByText('Illegal Item')).toBeVisible()
  })

  test('搜索 "Smart Ring" 后只剩它一个', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(page.getByText('Nexus VR Pro')).toBeVisible(SETTLE)

    await searchInput(page, SEARCH).fill('Smart Ring')
    await expect(page.getByText('Nexus VR Pro')).toHaveCount(0, SETTLE)
    await expect(page.getByText('Illegal Item')).toHaveCount(0)
    await expect(page.getByText('Smart Ring')).toBeVisible()
  })

  test('筛选 Draft 无数据时显示空态', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(page.getByText('Nexus VR Pro')).toBeVisible(SETTLE)

    await pickFilter(page, 'Draft')
    await expect(page.getByText('No products found')).toBeVisible(SETTLE)
    await expect(page.getByText('Nexus VR Pro')).toHaveCount(0)
  })
})

test.describe('admin/Reviews — 列表机制', () => {
  const PATH = `${ADMIN_BASE}/reviews`
  const SEARCH = 'Search reviews, users, or products...'

  test('首屏渲染全部 8 条评价', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(tableRows(page)).toHaveCount(8, SETTLE)
  })

  test('搜索 "Spam Bot" 命中 1 条评价', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(tableRows(page)).toHaveCount(8, SETTLE)

    await searchInput(page, SEARCH).fill('Spam Bot')
    await expect(tableRows(page)).toHaveCount(1, SETTLE)
    await expect(page.getByText('Spam Bot')).toBeVisible()
  })

  test('筛选 Hidden 只显示 1 条评价', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(tableRows(page)).toHaveCount(8, SETTLE)

    await pickFilter(page, 'Hidden')
    await expect(tableRows(page)).toHaveCount(1, SETTLE)
  })
})

test.describe('admin/Users — 列表机制（筛选键是 role 不是 status）', () => {
  const PATH = `${ADMIN_BASE}/users`
  const SEARCH = 'Search by name or email...'

  test('首屏渲染全部 4 个用户', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(tableRows(page)).toHaveCount(4, SETTLE)
    await expect(page.getByText('John Doe')).toBeVisible()
  })

  test('筛选 Merchant 只显示 1 个用户', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(tableRows(page)).toHaveCount(4, SETTLE)

    await pickFilter(page, 'Merchant')
    await expect(tableRows(page)).toHaveCount(1, SETTLE)
    await expect(page.getByText('Alice Merchant')).toBeVisible()
  })

  test('搜索 "Suspended" 命中 1 个用户', async ({ page }) => {
    await gotoAdminList(page, PATH)
    await expect(tableRows(page)).toHaveCount(4, SETTLE)

    await searchInput(page, SEARCH).fill('Suspended')
    await expect(tableRows(page)).toHaveCount(1, SETTLE)
    await expect(page.getByText('Suspended User')).toBeVisible()
  })
})

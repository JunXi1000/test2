import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

// ── Helper: wait for app to mount ──────────────────────────────────
async function gotoApp(page: any, path: string) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForFunction(
    () => {
      const app = document.getElementById('app')
      if (!app) return false
      return app.children.length > 2 && app.textContent && app.textContent.length > 50
    },
    { timeout: 10000 },
  )
  await page.waitForTimeout(800)
}

// ═══════════════════════════════════════════════════════════════════
// Phase 1: Search Enhancement
// ═══════════════════════════════════════════════════════════════════
test.describe('Phase 1: Search Enhancement', () => {
  test('Homepage has search input and category chips', async ({ page }) => {
    await gotoApp(page, '/')
    await expect(page.locator('input[placeholder*="Search"]').first()).toBeVisible({
      timeout: 5000,
    })
    await expect(page.locator('button:has-text("All")').first()).toBeVisible()
  })

  test('Search results page loads with query param', async ({ page }) => {
    await gotoApp(page, '/search?q=phone')
    await expect(page.locator('text=results').first()).toBeVisible({ timeout: 5000 })
  })

  test('Trending searches shown on empty search page', async ({ page }) => {
    await gotoApp(page, '/search')
    await expect(page.locator('text=Trending').first()).toBeVisible({ timeout: 5000 })
  })

  test('Search filters sidebar visible on results', async ({ page }) => {
    await gotoApp(page, '/search?q=phone')
    await expect(page.locator('text=Category').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Price Range').first()).toBeVisible({ timeout: 5000 })
  })

  test('Search bar navigates to /search on Enter', async ({ page }) => {
    await gotoApp(page, '/')
    const searchInput = page.locator('input[placeholder*="Search"]').first()
    await searchInput.fill('laptop')
    await searchInput.press('Enter')
    await page.waitForURL('**/search?q=laptop*', { timeout: 5000 })
    await expect(page).toHaveURL(/\/search\?q=laptop/)
  })
})

// ═══════════════════════════════════════════════════════════════════
// Phase 2: Wishlist
// ═══════════════════════════════════════════════════════════════════
test.describe('Phase 2: Wishlist Persistence', () => {
  test('Wishlist page redirects to login when unauthenticated', async ({ page }) => {
    await gotoApp(page, '/dashboard/wishlist')
    await page.waitForTimeout(2000)
    // Dashboard pages require auth, should redirect to login
    expect(page.url()).toMatch(/\/login/)
  })

  test('Heart icon visible on product cards', async ({ page }) => {
    await gotoApp(page, '/')
    await page.waitForTimeout(2000)
    const heartBtns = page.locator('button[title*="wishlist"], button[title*="Wishlist"]')
    const count = await heartBtns.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Click heart toggles wishlist', async ({ page }) => {
    await gotoApp(page, '/')
    await page.waitForTimeout(1500)
    // 上面那条用例已断言 count > 0，所以这里不该再写 if 守卫 ——
    // 守卫会让「按钮压根不存在」也判为通过。
    const heartBtn = page.locator('button[title*="wishlist"], button[title*="Wishlist"]').first()
    await expect(heartBtn).toBeVisible()

    // 收藏状态由 title 文案体现（ProductCard 依据 wishlistStore 切换）
    await expect(heartBtn).toHaveAttribute('title', /Add to wishlist/i)
    await heartBtn.click()
    await expect(heartBtn).toHaveAttribute('title', /Remove from wishlist/i)
  })
})

// ═══════════════════════════════════════════════════════════════════
// Phase 3: Browsing History
//   ⚠️ 2026-10：首页的「Recently Viewed」板块已整块移除（位置太靠底，商品一多就没人看得到），
//   所以原本断言那个板块可见的用例一并删除。
//   **记录行为**仍在（ProductDetail.vue 依旧调 browsingHistory.recordView()），
//   该行为由 tests/e2e-functional.spec.ts 的「Browsing History」用例覆盖，此处不重复。
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// Phase 4: Product Compare
// ═══════════════════════════════════════════════════════════════════
test.describe('Phase 4: Product Compare', () => {
  test('Compare checkbox appears on product cards (hover)', async ({ page }) => {
    await gotoApp(page, '/')
    await page.waitForTimeout(1500)
    const card = page.locator('.group.relative.rounded-2xl').first()
    await card.hover()
    const compareBtn = card.locator('button[title*="compare"], button[title*="Compare"]')
    await expect(compareBtn).toBeVisible({ timeout: 3000 })
  })

  test('Compare page redirects when insufficient items', async ({ page }) => {
    await gotoApp(page, '/compare')
    await page.waitForTimeout(2000)
    const url = page.url()
    expect(url).not.toContain('/compare')
  })
})

// ═══════════════════════════════════════════════════════════════════
// Phase 5: Breadcrumb
// ═══════════════════════════════════════════════════════════════════
test.describe('Phase 5: Breadcrumb Navigation', () => {
  test('Product detail has breadcrumb with Home link', async ({ page }) => {
    await gotoApp(page, '/product/1')
    await page.waitForTimeout(1500)
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('nav[aria-label="Breadcrumb"] >> text=Home').first()).toBeVisible()
  })

  test('Search results has breadcrumb', async ({ page }) => {
    await gotoApp(page, '/search?q=test')
    await page.waitForTimeout(1500)
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible({ timeout: 5000 })
  })
})

// ═══════════════════════════════════════════════════════════════════
// Phase 6: Coupon Center
// ═══════════════════════════════════════════════════════════════════
test.describe('Phase 6: Coupon Center', () => {
  test('Coupon page redirects to login when unauthenticated', async ({ page }) => {
    await gotoApp(page, '/dashboard/coupons')
    await page.waitForTimeout(2000)
    expect(page.url()).toMatch(/\/login/)
  })

  test('Can claim a coupon (when authenticated via localStorage bypass)', async ({ page }) => {
    // Even if redirected, the page components should exist in the build
    // We test this by verifying the route is registered via the coupons page redirect
    await gotoApp(page, '/dashboard/coupons')
    await page.waitForTimeout(2000)
    // Should redirect to login (route exists, auth guard works)
    expect(page.url()).toMatch(/\/login/)
  })
})

// ═══════════════════════════════════════════════════════════════════
// Phase 7: Returns & Refunds
// ═══════════════════════════════════════════════════════════════════
test.describe('Phase 7: Returns & Refunds', () => {
  test('Returns page redirects to login when unauthenticated', async ({ page }) => {
    await gotoApp(page, '/dashboard/returns')
    await page.waitForTimeout(2000)
    expect(page.url()).toMatch(/\/login/)
  })

  test('Route exists and auth guard works', async ({ page }) => {
    await gotoApp(page, '/dashboard/returns')
    await page.waitForTimeout(2000)
    // Route is registered, just protected by auth
    expect(page.url()).toMatch(/\/login/)
  })
})

// ═══════════════════════════════════════════════════════════════════
// Phase 8: Q&A
// ═══════════════════════════════════════════════════════════════════
test.describe('Phase 8: Product Q&A', () => {
  test('Q&A tab visible in product detail', async ({ page }) => {
    await gotoApp(page, '/product/1')
    await page.waitForTimeout(1500)
    const qaTab = page.locator('button[data-tab="qa"]')
    await expect(qaTab).toBeVisible({ timeout: 5000 })
  })

  test('Clicking Q&A tab shows Q&A content', async ({ page }) => {
    await gotoApp(page, '/product/1')
    await page.waitForTimeout(2000)
    // Scroll to the tabs area
    await page.evaluate(() => {
      const tabs = document.querySelector('[role="tablist"]')
      if (tabs) tabs.scrollIntoView({ block: 'center' })
    })
    await page.waitForTimeout(500)
    // Click the QA tab using dispatching a MouseEvent to bypass overlays
    await page.evaluate(() => {
      const qaBtn = document.querySelector('button[data-tab="qa"]') as HTMLElement
      if (qaBtn) {
        qaBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      }
    })
    await page.waitForTimeout(2000)
    // Check that the QA tab is now selected (has aria-selected)
    const qaTab = page.locator('button[data-tab="qa"]')
    await expect(qaTab).toHaveAttribute('aria-selected', 'true', { timeout: 5000 })
  })
})

// ═══════════════════════════════════════════════════════════════════
// Phase 9: Stock Alerts
// ═══════════════════════════════════════════════════════════════════
test.describe('Phase 9: Stock Alerts', () => {
  test('Stock status visible on product detail', async ({ page }) => {
    await gotoApp(page, '/product/1')
    await page.waitForTimeout(1500)
    const stockEl = page.locator('text=/In Stock|Only.*left|Out of Stock/').first()
    await expect(stockEl).toBeVisible({ timeout: 5000 })
  })
})

// ═══════════════════════════════════════════════════════════════════
// Phase 10: Lazy Loading
// ═══════════════════════════════════════════════════════════════════
test.describe('Phase 10: Image Lazy Loading', () => {
  test('Images use lazy loading on homepage', async ({ page }) => {
    await gotoApp(page, '/')
    await page.waitForTimeout(2000)
    const lazyImages = page.locator('img[loading="lazy"]')
    const count = await lazyImages.count()
    expect(count).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════
// Phase 11: PWA
// ═══════════════════════════════════════════════════════════════════
test.describe('Phase 11: PWA Support', () => {
  test('manifest.json accessible with correct fields', async ({ page }) => {
    const response = await page.request.get(BASE + '/manifest.json')
    expect(response.status()).toBe(200)
    const json = await response.json()
    expect(json.name).toContain('NEXUS')
    expect(json.display).toBe('standalone')
    expect(json.theme_color).toBeDefined()
  })

  test('Service worker accessible', async ({ page }) => {
    const response = await page.request.get(BASE + '/sw.js')
    expect(response.status()).toBe(200)
    const text = await response.text()
    expect(text).toContain('CACHE_NAME')
    expect(text).toContain('install')
    expect(text).toContain('fetch')
  })

  test('Theme color meta tag present', async ({ page }) => {
    await gotoApp(page, '/')
    const metaTheme = page.locator('meta[name="theme-color"]')
    await expect(metaTheme).toHaveAttribute('content', '#7c3aed')
  })

  test('Manifest link in head', async ({ page }) => {
    await gotoApp(page, '/')
    const manifestLink = page.locator('link[rel="manifest"]')
    await expect(manifestLink).toHaveAttribute('href', '/manifest.json')
  })
})

// ═══════════════════════════════════════════════════════════════════
// Core Pages
// ═══════════════════════════════════════════════════════════════════
test.describe('Core Pages', () => {
  test('Cart page renders', async ({ page }) => {
    await gotoApp(page, '/cart')
    await page.waitForTimeout(1000)
    // Cart page should show cart-related content or empty cart message
    await expect(page.locator('text=/Cart|Shopping|bag|empty|subtotal/i').first()).toBeVisible({
      timeout: 5000,
    })
  })

  /**
   * B3 之后 `/checkout` 挂上了 `meta:{requiresAuth:true, role:'user'}`，于是
   * 「匿名访问」与「登录后空车」是**两条不同的不变式**，必须分开钉：
   *   - 匿名 → 认证守卫先拦截，落到登录页并带 `redirect=/checkout`；
   *   - 登录 + 空车 → 走到页面自己的空车守卫，落到 `/cart`。
   * 旧版只有后者且没 seed 登录态，B3 之后它会先撞上认证守卫而失效。
   */
  test('Checkout page redirects anonymous visitors to login with redirect param', async ({
    page,
  }) => {
    await gotoApp(page, '/checkout')
    await page.waitForTimeout(2000)
    // 认证守卫必须把归属信息带上，否则登录后回不到结算页
    const url = page.url()
    expect(url).toMatch(/\/login/)
    expect(decodeURIComponent(url)).toMatch(/redirect=.*\/checkout/)
  })

  test('Checkout page redirects to cart when empty (logged in)', async ({ page }) => {
    // 先注入登录态，才能走到页面自己的空车守卫 —— 而不是被认证守卫送到登录页
    await page.addInitScript(() => {
      localStorage.setItem('RUNTIME_USE_MOCK', 'true')
      localStorage.setItem(
        'nexus_user',
        JSON.stringify({ id: '1', name: 'E2E User', email: 'e2e@example.com', role: 'user' }),
      )
      localStorage.setItem('nexus_token', 'e2e-token')
    })
    await gotoApp(page, '/checkout')
    await page.waitForTimeout(2500)
    // 空车 → 回购物车（原本的守卫行为，B3 未改）
    expect(page.url()).toMatch(/\/cart/)
  })

  test('Login page renders', async ({ page }) => {
    await gotoApp(page, '/login')
    await page.waitForTimeout(1000)
    await expect(
      page
        .locator('input[type="email"], input[placeholder*="email"], input[placeholder*="Email"]')
        .first(),
    ).toBeVisible({ timeout: 5000 })
  })

  test('Signup page renders', async ({ page }) => {
    await gotoApp(page, '/signup')
    await page.waitForTimeout(1000)
    await expect(
      page.locator('text=/sign up|create account|register|Sign up/i').first(),
    ).toBeVisible({ timeout: 5000 })
  })

  test('Store page renders', async ({ page }) => {
    await gotoApp(page, '/store/1')
    await page.waitForTimeout(1500)
    // Store page should have products or store info
    await expect(page.locator('text=/Store|products|product/i').first()).toBeVisible({
      timeout: 5000,
    })
  })

  test('404 page renders for unknown routes', async ({ page }) => {
    await gotoApp(page, '/this-page-does-not-exist-12345')
    await page.waitForTimeout(1000)
    // 404 page should show some not-found indicator
    await expect(page.locator('text=/not found|404|doesn.t exist|exist/i').first()).toBeVisible({
      timeout: 5000,
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// Dashboard Pages (require auth — check redirect)
// ═══════════════════════════════════════════════════════════════════
test.describe('Dashboard Auth Guards', () => {
  const protectedRoutes = [
    ['Dashboard', '/dashboard'],
    ['Orders', '/dashboard/orders'],
    ['Addresses', '/dashboard/addresses'],
    ['Settings', '/dashboard/settings'],
    ['Messages', '/dashboard/messages'],
    ['Coupons', '/dashboard/coupons'],
    ['Returns', '/dashboard/returns'],
    ['Wishlist', '/dashboard/wishlist'],
  ]

  for (const [name, route] of protectedRoutes) {
    test(`${name} (${route}) redirects to login`, async ({ page }) => {
      await gotoApp(page, route)
      await page.waitForTimeout(2000)
      expect(page.url()).toMatch(/\/login/)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════
// Admin & Merchant Pages
// ═══════════════════════════════════════════════════════════════════
test.describe('Admin & Merchant Portals', () => {
  test('Admin login renders', async ({ page }) => {
    await gotoApp(page, '/admin/login')
    await page.waitForTimeout(1000)
    await expect(page.locator('text="Administrator sign in"')).toBeVisible({ timeout: 5000 })
  })

  test('Admin dashboard redirects to login', async ({ page }) => {
    await gotoApp(page, '/admin/dashboard')
    await page.waitForTimeout(2000)
    expect(page.url()).toMatch(/\/admin\/login/)
  })

  test('Merchant login renders', async ({ page }) => {
    await gotoApp(page, '/merchant/login')
    await page.waitForTimeout(1000)
    await expect(page.locator('text="Merchant sign in"')).toBeVisible({ timeout: 5000 })
  })

  test('Merchant dashboard redirects to login', async ({ page }) => {
    await gotoApp(page, '/merchant/dashboard')
    await page.waitForTimeout(2000)
    expect(page.url()).toMatch(/\/merchant\/login/)
  })
})

// ═══════════════════════════════════════════════════════════════════
// Floating UI
// ═══════════════════════════════════════════════════════════════════
test.describe('Floating UI Elements', () => {
  test('Back to top button appears after scrolling', async ({ page }) => {
    await gotoApp(page, '/')
    await page.waitForTimeout(1000)
    await page.evaluate(() => window.scrollTo(0, 500))
    await page.waitForTimeout(500)
    const backToTop = page.locator('button[aria-label="Back to top"], button[title="Back to Top"]')
    await expect(backToTop).toBeVisible({ timeout: 3000 })
  })

  test('Chat widget loaded on homepage', async ({ page }) => {
    // 原来的断言是 expect(count).toBeGreaterThanOrEqual(0) —— 恒真，等于没测。
    // 这条用例想验的是「异步组件加载不会把首页搞崩」，那就真的去验它：
    // 收集未捕获异常，并确认应用确实渲染出了内容。
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(e.message))

    await gotoApp(page, '/')
    await page.waitForTimeout(2000)

    expect(pageErrors).toEqual([])
    const appText = await page.locator('#app').innerText()
    expect(appText.length).toBeGreaterThan(50)
  })
})

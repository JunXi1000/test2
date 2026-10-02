import { test, expect, type Page } from '@playwright/test'

/**
 * 商品详情页「左栏图集」E2E（mock 模式，不需要后端）。
 *
 * 与 `e2e-functional.spec.ts` 里那条视频相册用例互补：那条覆盖的是**视频**路径
 * （缩略图角标 → 切到 <video> → 播放/暂停/全屏），这里补它没碰的**图片**路径 ——
 * 缩略图选中、上/下一张、悬停放大镜。
 *
 * 为什么补：阶段 7g 把图集整块搬进了 `<ProductGallery>` + `useProductGallery`
 * （162 行模板 + 约 260 行脚本），而图片路径原本没有断言覆盖。
 *
 * **刻意不断言图片是否真的加载成功**：mock 的图是外链（unsplash），E2E 环境里能不能拉到
 * 取决于网络。图集本身带失败兜底（原图 → 内联占位图），所以「图没加载出来」不是失败 ——
 * 断言它反而会把用例变成看天吃饭。
 * 这里只断言**结构**与**交互**：选中态变了、放大镜出现了。
 */

async function seedMock(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('RUNTIME_USE_MOCK', 'true')
  })
}

async function gotoGallery(page: Page, productPath = '/product/12') {
  await page.goto(productPath)
  await page.waitForFunction(() => (document.getElementById('app')?.children.length ?? 0) > 0, {
    timeout: 45_000,
  })
  const hero = page.locator('.product-hero-card').first()
  await expect(hero).toBeVisible({ timeout: 15_000 })
  return hero
}

test.describe('商品详情 · 图集', () => {
  test.beforeEach(async ({ page }) => {
    await seedMock(page)
  })

  test('缩略图条按 data-thumb-index 顺序渲染全部条目', async ({ page }) => {
    await gotoGallery(page)

    const thumbs = page.locator('button[data-thumb-index]')
    const count = await thumbs.count()
    expect(count).toBeGreaterThan(1)
    for (let i = 0; i < count; i++) {
      await expect(page.locator(`button[data-thumb-index="${i}"]`)).toBeVisible()
    }
  })

  test('点缩略图切换选中项，且选中态是排他的', async ({ page }) => {
    await gotoGallery(page)

    // **刻意不断言主图 src 变化** —— 这条曾经这么写，是错的：
    //   `api/modules/product.ts` 的 mock 分支以前把 images 注成 `[image, image, image]`（同一 URL 三份），
    //   于是「图片→图片」的切换在 src 上根本看不出来（该重复已于 2026-10 去掉，现在 mock 与真实后端一致：
    //   只回一张 `image`），src 还会被失败兜底改写（`resolveImageSrc` 按 slot 的 cursor 取候选）。
    // 能确定性观测的是**选中态**：点谁谁高亮，且同一时刻只有一个是高亮的。
    //
    // 商品 id=12 有演示视频（`id % 4 === 0`），图集 = [图片(0), 视频(1)] 两项，
    // 而当前选中项是 0，所以这里点**视频**那格来完成"切到另一项"的验证。
    const activeCount = () =>
      page
        .locator('button[data-thumb-index]')
        .evaluateAll((els) => els.filter((e) => e.className.includes('border-primary')).length)

    expect(await activeCount()).toBe(1)

    const videoThumb = page.locator('button[data-thumb-kind="video"]').first()
    await videoThumb.click()

    await expect(videoThumb).toHaveClass(/border-primary/)
    expect(await activeCount()).toBe(1)
    await expect(page.locator('button[data-thumb-index="0"]')).not.toHaveClass(/border-primary/)
  })

  test('下一张/上一张按钮能切换，且可循环', async ({ page }) => {
    await gotoGallery(page)

    const thumbs = page.locator('button[data-thumb-index]')
    const total = await thumbs.count()

    /** 当前高亮的是第几个缩略图 —— 用选中态的 class 反查，而不是自己维护一份状态 */
    const selectedIndex = () =>
      page
        .locator('button[data-thumb-index]')
        .evaluateAll((els) => els.findIndex((e) => e.className.includes('border-primary')))

    const first = await selectedIndex()
    await page.locator('button:has(svg.lucide-chevron-right)').first().click()
    expect(await selectedIndex()).toBe((first + 1) % total)

    await page.locator('button:has(svg.lucide-chevron-left)').first().click()
    expect(await selectedIndex()).toBe(first)
  })

  test('桌面端悬停主图出现放大镜与预览面板，移开即消失', async ({ page }) => {
    // 放大镜与预览面板都是 hidden lg:block —— 默认 1280 宽已满足
    await gotoGallery(page)

    const lens = page.getByTestId('zoom-lens')
    const panel = page.getByTestId('zoom-panel')
    await expect(lens).toBeHidden()
    await expect(panel).toBeHidden()

    const hero = page.locator('.product-hero-card').first()
    const box = (await hero.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

    await expect(lens).toBeVisible({ timeout: 5000 })
    await expect(panel).toBeVisible()

    await page.mouse.move(box.x - 40, box.y - 40)
    await expect(lens).toBeHidden({ timeout: 5000 })
    await expect(panel).toBeHidden()
  })

  test('视频条目上不显示放大镜（避免遮挡播放控件）', async ({ page }) => {
    await gotoGallery(page)

    await page.locator('button[data-thumb-kind="video"]').first().click()
    const hero = page.locator('.product-hero-card').first()
    const box = (await hero.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

    await expect(hero.locator('video')).toBeVisible({ timeout: 8000 })
    await expect(page.getByTestId('zoom-lens')).toBeHidden()
  })

  test('分享按钮可点击且不抛错', async ({ page }) => {
    await gotoGallery(page)

    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.locator('button:has(svg.lucide-share-2)').first().click()

    // 无 navigator.share 时走剪贴板兜底；权限被拒也会被 catch 掉，不该冒泡成未捕获错误
    expect(errors).toEqual([])
  })
})

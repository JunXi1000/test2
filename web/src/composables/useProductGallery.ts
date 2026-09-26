import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { IMAGE_FALLBACK } from '@/utils/imagePlaceholder'
import type { Product } from '@/types/product'

/** 相册条目：图片与演示视频混排（阶段 4.1） */
export type GalleryItem = { kind: 'image'; src: string } | { kind: 'video'; src: string }

export interface UseProductGalleryOptions {
  /** 用来给 picsum 备选图生成稳定 seed —— 同一个商品的备选图不该每次都换 */
  productId: number
  product: Ref<Product | null>
  /** 选中颜色会影响主图（变体图优先）；卡片槽位 key 也带它，切换颜色要重新走失败转移链 */
  selectedColor: Ref<{ name: string; value?: string } | null>
  /**
   * 两个模板 ref 由**组件**声明后传进来，不由本组合式创建。
   *
   * 原因：模板里 `ref="heroCardRef"` 要求它是 `<script setup>` 的顶层绑定，而经解构出来的
   * 变量 vue-tsc 不认（它只对直接 `ref()` 声明做模板 ref 识别），于是报「声明未使用」。
   * 这也是诚实的边界 —— 它们指向的是组件的 DOM。
   */
  heroCardRef: Ref<HTMLElement | null>
  thumbnailStripRef: Ref<HTMLElement | null>
}

/**
 * 商品图集：主图/视频混排、切换、缩略图、悬停放大镜，以及**外链图失败转移**。
 *
 * 失败转移链是这块最不显然的部分：每张图按 slot 记住自己失败到第几级
 * （`imageFailoverCursor`），原图挂了换 picsum，再挂换备选 seed，最后落到内联占位图。
 * 用 slot 而不是 URL 做键，是因为同一个 URL 可能出现在多个位置（主图 + 缩略图），
 * 各自的重试进度要独立。
 */
export function useProductGallery(options: UseProductGalleryOptions) {
  const { productId, product, selectedColor, heroCardRef, thumbnailStripRef } = options

  const currentImageIndex = ref(0)

  /** 相册条目。演示视频固定插在第 2 位（index 1）—— 首图仍是商品主图 */
  const galleryItems = computed<GalleryItem[]>(() => {
    const p = product.value
    if (!p) return []
    const imgs = p.images?.length ? p.images : [p.image]
    const items: GalleryItem[] = imgs.map((src) => ({ kind: 'image', src }))
    if (p.video) {
      items.splice(1, 0, { kind: 'video', src: p.video })
    }
    return items
  })

  const currentGalleryItem = computed<GalleryItem | null>(
    () => galleryItems.value[currentImageIndex.value] ?? null,
  )
  const isCurrentVideo = computed(() => currentGalleryItem.value?.kind === 'video')
  /** 视频封面图：复用商品首图 */
  const videoPoster = computed(
    () => product.value?.image ?? product.value?.images?.[0] ?? IMAGE_FALLBACK,
  )

  const currentImage = computed(() => {
    if (
      product.value?.variantImages &&
      selectedColor.value?.name &&
      product.value.variantImages[selectedColor.value.name]
    ) {
      return product.value.variantImages[selectedColor.value.name]
    }
    const item = galleryItems.value[currentImageIndex.value]
    if (item?.kind === 'image') return item.src
    return product.value?.images?.[0] ?? product.value?.image ?? ''
  })

  /** 只含图片（不含视频），预热下一张时用 —— 不该去预热一个视频 URL */
  const galleryImages = computed(() => {
    const p = product.value
    if (!p) return []
    return p.images?.length ? p.images : [p.image]
  })

  const canPrevImage = computed(() => galleryItems.value.length > 1)
  const canNextImage = computed(() => galleryItems.value.length > 1)

  const mainImageSlotKey = computed(
    () => `main-${selectedColor.value?.name || 'default'}-${currentImageIndex.value}`,
  )
  const resolvedMainImage = computed(() =>
    resolveImageSrc(mainImageSlotKey.value, currentImage.value || IMAGE_FALLBACK),
  )

  // ── 外链图失败转移 ──
  const imageFailoverCursor = ref<Record<string, number>>({})
  const isDevMode = import.meta.env.DEV
  const devImageFailTotal = ref(0)
  const devImageFailByUrl = ref<Record<string, number>>({})

  function buildImageCandidates(primarySrc: string, slotKey: string) {
    const sanitizedPrimary = String(primarySrc || '').trim()
    const seed = encodeURIComponent(`product-${productId}-${slotKey}`)
    const candidates = [
      sanitizedPrimary,
      `https://picsum.photos/seed/${seed}/1200/900`,
      `https://picsum.photos/seed/${seed}-alt/1200/900`,
    ].filter(Boolean)
    candidates.push(IMAGE_FALLBACK)
    return candidates
  }

  function resolveImageSrc(slotKey: string, primarySrc: string) {
    const candidates = buildImageCandidates(primarySrc, slotKey)
    const cursor = imageFailoverCursor.value[slotKey] ?? 0
    return candidates[Math.min(cursor, candidates.length - 1)]
  }

  function isUsingBackupSource(slotKey: string) {
    return (imageFailoverCursor.value[slotKey] ?? 0) > 0
  }

  function onImageError(event: Event, slotKey: string, primarySrc: string) {
    const target = event.target as HTMLImageElement
    if (!target) return
    const candidates = buildImageCandidates(primarySrc, slotKey)
    const currentCursor = imageFailoverCursor.value[slotKey] ?? 0
    const nextCursor = Math.min(currentCursor + 1, candidates.length - 1)
    const failedSrc = target.currentSrc || target.src || primarySrc

    if (isDevMode) {
      devImageFailTotal.value += 1
      const key = String(failedSrc || 'unknown')
      devImageFailByUrl.value[key] = (devImageFailByUrl.value[key] ?? 0) + 1

      console.warn('[ProductDetail:image-failover]', {
        slotKey,
        failedSrc,
        primarySrc,
        nextFallbackLevel: nextCursor,
        nextSrc: candidates[nextCursor],
      })
    }

    imageFailoverCursor.value[slotKey] = nextCursor
    target.src = candidates[nextCursor]
  }

  // ── 预热 ──
  let idleWarmupTimer: number | null = null

  function preloadImage(src: string | undefined) {
    if (!src) return
    const img = new Image()
    img.decoding = 'async'
    img.src = src
  }

  function getNetworkHints() {
    const connection = (
      navigator as Navigator & {
        connection?: {
          saveData?: boolean
          effectiveType?: string
        }
      }
    ).connection
    return {
      saveData: Boolean(connection?.saveData),
      effectiveType: connection?.effectiveType || '4g',
    }
  }

  function wrapIndex(i: number, len: number): number {
    return ((i % len) + len) % len
  }

  /** 立即预热相邻一张（省流/2G 只预热下一张；3G 不预热上一张） */
  function warmupNearbyGalleryImages() {
    const len = galleryImages.value.length
    if (!len) return

    const { saveData, effectiveType } = getNetworkHints()
    const nextSrc = galleryImages.value[wrapIndex(currentImageIndex.value + 1, len)]

    if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
      preloadImage(nextSrc)
      return
    }

    const prevSrc = galleryImages.value[wrapIndex(currentImageIndex.value - 1, len)]
    preloadImage(nextSrc)
    if (effectiveType !== '3g') {
      preloadImage(prevSrc)
    }
  }

  /** 网络好的时候，等浏览器空闲再预热隔一张的图 */
  function scheduleIdleWarmup() {
    const len = galleryImages.value.length
    if (!len) return
    const { saveData, effectiveType } = getNetworkHints()
    if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g')
      return

    const run = () => {
      const next2 = galleryImages.value[wrapIndex(currentImageIndex.value + 2, len)]
      const prev2 = galleryImages.value[wrapIndex(currentImageIndex.value - 2, len)]
      preloadImage(next2)
      preloadImage(prev2)
    }

    const w = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }

    if (w.requestIdleCallback) {
      if (idleWarmupTimer !== null && w.cancelIdleCallback) {
        w.cancelIdleCallback(idleWarmupTimer)
      }
      idleWarmupTimer = w.requestIdleCallback(run, { timeout: 1200 })
      return
    }

    if (idleWarmupTimer !== null) {
      window.clearTimeout(idleWarmupTimer)
    }
    idleWarmupTimer = window.setTimeout(run, 280)
  }

  // ── 切换 ──
  function selectImage(index: number) {
    if (index < 0 || index >= galleryItems.value.length) return
    currentImageIndex.value = index
    nextTick(() => {
      const target = thumbnailStripRef.value?.querySelector<HTMLElement>(
        `button[data-thumb-index="${index}"]`,
      )
      target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    })
  }

  function prevImage() {
    if (!galleryItems.value.length) return
    const len = galleryItems.value.length
    selectImage((currentImageIndex.value - 1 + len) % len)
  }

  function nextImage() {
    if (!galleryItems.value.length) return
    const len = galleryItems.value.length
    selectImage((currentImageIndex.value + 1) % len)
  }

  // ── 悬停放大镜 ──
  const zoomActive = ref(false)
  const zoomLensX = ref(0)
  const zoomLensY = ref(0)
  const zoomBgPos = ref('center')
  const zoomPanelLeft = ref(0)
  const zoomPanelTop = ref(0)
  const ZOOM_SCALE = 2.5
  const LENS_SIZE = 160
  const ZOOM_PANEL_SIZE = 420

  function onHeroMouseMove(e: MouseEvent) {
    const el = heroCardRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const w = rect.width
    const h = rect.height

    // 镜片夹在卡片内，避免贴边时露出一半
    const half = LENS_SIZE / 2
    const lx = Math.max(half, Math.min(x, w - half))
    const ly = Math.max(half, Math.min(y, h - half))
    zoomLensX.value = lx - half
    zoomLensY.value = ly - half

    const px = (x / w) * 100
    const py = (y / h) * 100
    zoomBgPos.value = `${px}% ${py}%`

    zoomPanelLeft.value = rect.right + 12
    zoomPanelTop.value = rect.top

    if (!zoomActive.value) zoomActive.value = true
  }

  function onHeroMouseLeave() {
    zoomActive.value = false
  }

  // ── 副作用 ──
  watch(currentImageIndex, () => {
    warmupNearbyGalleryImages()
    scheduleIdleWarmup()
  })

  watch(galleryItems, () => {
    // 换了商品/换了一批图 → 每个 slot 的重试进度都作废
    imageFailoverCursor.value = {}
    warmupNearbyGalleryImages()
    scheduleIdleWarmup()
  })

  onBeforeUnmount(() => {
    if (isDevMode && devImageFailTotal.value > 0) {
      const topFailed = Object.entries(devImageFailByUrl.value)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([url, count]) => ({ url, count }))
      console.info('[ProductDetail:image-failover-summary]', {
        totalFailed: devImageFailTotal.value,
        uniqueFailedUrls: Object.keys(devImageFailByUrl.value).length,
        topFailed,
      })
    }

    if (idleWarmupTimer !== null) {
      const w = window as Window & { cancelIdleCallback?: (handle: number) => void }
      if (w.cancelIdleCallback) {
        w.cancelIdleCallback(idleWarmupTimer)
      } else {
        window.clearTimeout(idleWarmupTimer)
      }
      idleWarmupTimer = null
    }
  })

  return {
    // 状态
    currentImageIndex,
    // 派生
    galleryItems,
    currentGalleryItem,
    isCurrentVideo,
    videoPoster,
    currentImage,
    galleryImages,
    canPrevImage,
    canNextImage,
    mainImageSlotKey,
    resolvedMainImage,
    isUsingBackupSource,
    isDevMode,
    imageFallback: IMAGE_FALLBACK,
    // 动作
    resolveImageSrc,
    onImageError,
    selectImage,
    prevImage,
    nextImage,
    // 放大镜
    zoomActive,
    zoomLensX,
    zoomLensY,
    zoomBgPos,
    zoomPanelLeft,
    zoomPanelTop,
    ZOOM_SCALE,
    LENS_SIZE,
    ZOOM_PANEL_SIZE,
    onHeroMouseMove,
    onHeroMouseLeave,
  }
}

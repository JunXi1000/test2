<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Star,
  Truck,
  ShieldCheck,
  Minus,
  Plus,
  MessageSquare,
  Check,
  ShoppingBag,
  Zap,
  Hash,
  Store,
  Clock,
  Heart,
  Ruler,
} from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import SizeGuide from '@/components/ui/SizeGuide.vue'
import { useCartStore } from '@/stores/cart'
import { useWishlistStore } from '@/stores/wishlist'
import { useBrowsingHistory } from '@/stores/browsingHistory'
import { useStockAlertStore } from '@/stores/stockAlerts'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useAsyncTask } from '@/composables/useAsyncTask'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
// 推荐位的 getRelatedProducts / getBoughtTogether 已随块搬进 <ProductRecommendations>
import { getProductById } from '@/api/modules/product'
import type { Product } from '@/types/product'
import ErrorState from '@/components/ui/state/ErrorState.vue'
import ReviewSection from '@/components/ui/product/ReviewSection.vue'
import ProductGallery from '@/components/ui/product/ProductGallery.vue'
import ProductRecommendations from '@/components/ui/product/ProductRecommendations.vue'
import { formatPricePlain } from '@/utils/format'
import Breadcrumb from '@/components/ui/Breadcrumb.vue'
import ProductQA from '@/components/ui/ProductQA.vue'
import { getMerchantPublicProfile, type MerchantPublicProfile } from '@/api/modules/merchantPublic'

const route = useRoute()
const router = useRouter()
const cartStore = useCartStore()
const wishlistStore = useWishlistStore()
const browsingHistory = useBrowsingHistory()
const stockAlertStore = useStockAlertStore()
const { toast } = useToast()
const productId = Number(route.params.id)

const {
  isLoading: isLoadingRef,
  error: errorRef,
  run,
} = useAsyncTask({
  fallbackMessage: 'Failed to load product',
  initialLoading: true,
})
const productRef = ref<Product | null>(null)

const selectedColor = ref<{ name: string; value?: string } | null>(null)
const selectedSize = ref<string>('')
const quantity = ref(1)
const qtyBadgePulse = ref(false)
const qtyButtonPulse = ref<'minus' | 'plus' | ''>('')
const addToBagSuccessPulse = ref(false)
const buyNowPulse = ref(false)
const colorSectionRef = ref<HTMLElement | null>(null)
const sizeSectionRef = ref<HTMLElement | null>(null)
const highlightColorMissing = ref(false)
const highlightSizeMissing = ref(false)
const colorExpanded = ref(false)
const specExpanded = ref(false)
const showSizeGuide = ref(false)
const COLLAPSE_THRESHOLD_COLORS = 6
const COLLAPSE_THRESHOLD_SPECS = 6

const visibleColors = computed(() => {
  const all = productRef.value?.colors || []
  if (colorExpanded.value || all.length <= COLLAPSE_THRESHOLD_COLORS) return all
  const visible = all.slice(0, COLLAPSE_THRESHOLD_COLORS)
  if (selectedColor.value && !visible.find((c) => c.name === selectedColor.value?.name)) {
    visible[COLLAPSE_THRESHOLD_COLORS - 1] = selectedColor.value
  }
  return visible
})

const visibleSpecs = computed(() => {
  const all = productRef.value?.sizes || []
  if (specExpanded.value || all.length <= COLLAPSE_THRESHOLD_SPECS) return all
  const visible = all.slice(0, COLLAPSE_THRESHOLD_SPECS)
  if (selectedSize.value && !visible.includes(selectedSize.value)) {
    visible[COLLAPSE_THRESHOLD_SPECS - 1] = selectedSize.value
  }
  return visible
})

const hasHiddenColors = computed(
  () => (productRef.value?.colors?.length || 0) > COLLAPSE_THRESHOLD_COLORS,
)
const hasHiddenSpecs = computed(
  () => (productRef.value?.sizes?.length || 0) > COLLAPSE_THRESHOLD_SPECS,
)

const safeRating = computed(() => Number(productRef.value?.rating ?? 0))
const safeReviews = computed(() => Number(productRef.value?.reviews ?? 0))
const comparePrice = computed(() => Number((productRef.value?.price ?? 0) * 1.2))

let highlightTimer: ReturnType<typeof setTimeout> | null = null

function ensureSelectionsOrWarn() {
  if (!productRef.value) return false

  if (highlightTimer) {
    clearTimeout(highlightTimer)
    highlightColorMissing.value = false
    highlightSizeMissing.value = false
  }

  if (productRef.value.colors?.length && !selectedColor.value?.name) {
    highlightColorMissing.value = true
    colorSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightTimer = setTimeout(() => {
      highlightColorMissing.value = false
    }, 1500)
    toast({ title: 'Please select a color', variant: 'destructive' })
    return false
  }
  if (productRef.value.sizes?.length && !selectedSize.value) {
    highlightSizeMissing.value = true
    sizeSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightTimer = setTimeout(() => {
      highlightSizeMissing.value = false
    }, 1500)
    toast({
      title: `Please select ${productRef.value?.specLabel?.toLowerCase() || 'a size'}`,
      variant: 'destructive',
    })
    return false
  }
  return true
}

const increment = () => {
  qtyButtonPulse.value = 'plus'
  quantity.value++
  window.setTimeout(() => {
    if (qtyButtonPulse.value === 'plus') qtyButtonPulse.value = ''
  }, 150)
}
const decrement = () => {
  qtyButtonPulse.value = 'minus'
  if (quantity.value > 1) quantity.value--
  window.setTimeout(() => {
    if (qtyButtonPulse.value === 'minus') qtyButtonPulse.value = ''
  }, 150)
}

const addToCart = () => {
  if (!productRef.value) return
  if (!ensureSelectionsOrWarn()) return

  const productToAdd = { ...productRef.value }
  if (
    selectedColor.value?.name &&
    productRef.value.variantImages &&
    productRef.value.variantImages[selectedColor.value.name]
  ) {
    productToAdd.image = productRef.value.variantImages[selectedColor.value.name]
  }

  cartStore.addItem(productToAdd, {
    color: selectedColor.value?.name || '',
    size: selectedSize.value || '',
    quantity: quantity.value,
  })

  toast({
    title: 'Added to cart',
    description: `${productRef.value.title} has been added.`,
    variant: 'success',
  })

  addToBagSuccessPulse.value = true
  window.setTimeout(() => {
    addToBagSuccessPulse.value = false
  }, 800)
}

const buyNow = () => {
  if (!productRef.value) return
  if (!ensureSelectionsOrWarn()) return
  buyNowPulse.value = true

  const productToBuy = { ...productRef.value }
  if (
    selectedColor.value?.name &&
    productRef.value.variantImages &&
    productRef.value.variantImages[selectedColor.value.name]
  ) {
    productToBuy.image = productRef.value.variantImages[selectedColor.value.name]
  }

  cartStore.setDirectBuyItem(productToBuy, {
    color: selectedColor.value?.name || '',
    size: selectedSize.value || '',
    quantity: quantity.value,
  })
  window.setTimeout(() => {
    buyNowPulse.value = false
  }, 180)
  router.push('/checkout?mode=direct')
}

const contactSeller = () => {
  router.push('/dashboard/messages')
}

const activeTab = ref<'details' | 'specs' | 'reviews' | 'qa'>('details')
const tabSwitcherRef = ref<HTMLElement | null>(null)
const tabKeys: Array<'details' | 'specs' | 'reviews' | 'qa'> = ['details', 'specs', 'reviews', 'qa']
const activeTabIndex = computed(() => Math.max(0, tabKeys.indexOf(activeTab.value)))
const detailsSectionRef = ref<HTMLElement | null>(null)
const specsSectionRef = ref<HTMLElement | null>(null)
const qaSectionRef = ref<HTMLElement | null>(null)

/**
 * 评价区在子组件 `<ReviewSection>` 里，所以这里**不能**用模板 ref —— 那拿到的是组件实例
 * 而不是 DOM。它自己带着 id="reviews-section"，按 id 取即可（同一文件里 submitReview
 * 原先就是这么滚过去的）。
 */
const reviewsSectionElement = () => document.getElementById('reviews-section')
const isProgrammaticTabScroll = ref(false)
let tabScrollUnlockTimer: ReturnType<typeof setTimeout> | null = null

const authStore = useAuthStore()

const shareProduct = async () => {
  try {
    const shareData = {
      title: productRef.value?.title || 'Product',
      text: productRef.value?.description || 'Check this product',
      url: window.location.href,
    }
    if (navigator.share) {
      await navigator.share(shareData)
      toast({
        title: 'Shared',
        description: 'Product link shared successfully',
        variant: 'success',
      })
    } else {
      await navigator.clipboard.writeText(window.location.href)
      toast({
        title: 'Link copied',
        description: 'Product link copied to clipboard',
        variant: 'success',
      })
    }
  } catch (err) {
    toast({ title: 'Share failed', description: 'Could not share product', variant: 'destructive' })
  }
}

async function jumpToReviews() {
  await switchTab('reviews')
}

async function switchTab(tab: 'details' | 'specs' | 'reviews' | 'qa') {
  activeTab.value = tab
  await nextTick()
  const sectionMap: Record<string, HTMLElement | null> = {
    details: detailsSectionRef.value,
    specs: specsSectionRef.value,
    reviews: reviewsSectionElement(),
    qa: qaSectionRef.value,
  }
  const target = sectionMap[tab]
  if (!target) return

  const headerOffset = Number.parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--app-header-offset') || '64',
    10,
  )
  const tabHeight = tabSwitcherRef.value?.offsetHeight ?? 52
  const top = window.scrollY + target.getBoundingClientRect().top - headerOffset - tabHeight - 20

  isProgrammaticTabScroll.value = true
  if (tabScrollUnlockTimer) clearTimeout(tabScrollUnlockTimer)
  tabScrollUnlockTimer = setTimeout(() => {
    isProgrammaticTabScroll.value = false
  }, 500)

  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

function onTabKeydown(event: KeyboardEvent, index: number) {
  const key = event.key
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(key)) return
  event.preventDefault()

  let nextIndex = index
  if (key === 'ArrowRight') nextIndex = (index + 1) % tabKeys.length
  if (key === 'ArrowLeft') nextIndex = (index - 1 + tabKeys.length) % tabKeys.length
  if (key === 'Home') nextIndex = 0
  if (key === 'End') nextIndex = tabKeys.length - 1

  const nextTab = tabKeys[nextIndex]
  const nextButton = tabSwitcherRef.value?.querySelector<HTMLButtonElement>(
    `button[data-tab="${nextTab}"]`,
  )
  nextButton?.focus()
  void switchTab(nextTab)
}

function syncActiveTabByScroll() {
  if (isProgrammaticTabScroll.value) return

  const doc = document.documentElement
  const nearBottomThreshold = Math.min(Math.max(window.innerHeight * 0.2, 96), 220)
  const viewportBottom = window.scrollY + window.innerHeight
  const pageBottom = doc.scrollHeight
  if (pageBottom - viewportBottom <= nearBottomThreshold) {
    activeTab.value = 'reviews'
    return
  }

  const headerOffset = Number.parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--app-header-offset') || '64',
    10,
  )
  const tabHeight = tabSwitcherRef.value?.offsetHeight ?? 52
  const anchorLine = headerOffset + tabHeight + 28

  const sections: Array<{ tab: 'details' | 'specs' | 'reviews' | 'qa'; el: HTMLElement | null }> = [
    { tab: 'details', el: detailsSectionRef.value },
    { tab: 'specs', el: specsSectionRef.value },
    { tab: 'reviews', el: reviewsSectionElement() },
    { tab: 'qa', el: qaSectionRef.value },
  ]

  let currentTab: 'details' | 'specs' | 'reviews' | 'qa' = 'details'
  for (const section of sections) {
    if (!section.el) continue
    const top = section.el.getBoundingClientRect().top
    if (top <= anchorLine) currentTab = section.tab
  }
  activeTab.value = currentTab
}

async function fetchDetail() {
  const result = await run(() => getProductById(productId))

  // 取数成功才做后续副作用（浏览历史 / 重置选择 / 拉商家与推荐），与原 try 的语义一致
  if (!result.ok) return

  const product = result.value
  productRef.value = product

  // record browsing history
  browsingHistory.recordView({
    id: product.id,
    title: product.title,
    price: product.price,
    image: product.image ?? product.images?.[0] ?? '',
    category: product.category,
    rating: product.rating,
  })

  selectedColor.value = null
  selectedSize.value = ''

  // 商品加载完成后(此时才有真实 shopId)再加载商家信息,避免 onMounted 竞态取到假 id
  loadMerchant()
}

// ── Merchant info ──
const merchantProfile = ref<MerchantPublicProfile | null>(null)
const merchantLoading = ref(false)

const PRODUCT_MERCHANT_MAP: Record<number, string> = {}
function getMerchantIdForProduct(pId: number): string {
  // 真实模式:优先用商品自带的真实 shopId(替换 mock 时代硬编码的 'm1'/'m2' 假 id)
  const shopId = productRef.value?.shopId
  if (shopId) return String(shopId)
  if (PRODUCT_MERCHANT_MAP[pId]) return PRODUCT_MERCHANT_MAP[pId]
  return pId % 2 === 0 ? 'm2' : 'm1'
}

async function loadMerchant() {
  merchantLoading.value = true
  try {
    const mid = getMerchantIdForProduct(productId)
    merchantProfile.value = await getMerchantPublicProfile(mid)
  } catch {
  } finally {
    merchantLoading.value = false
  }
}

// ── Stock status (mock) ──
const stockStatus = computed(() => {
  if (!productRef.value) return { text: '', type: '' }
  const id = productRef.value.id
  const stock = (id * 7 + 13) % 100
  if (stock > 20) return { text: 'In Stock', type: 'success' }
  if (stock > 0) return { text: `Only ${stock} left`, type: 'warning' }
  return { text: 'Out of Stock', type: 'danger' }
})

onMounted(fetchDetail)
onMounted(() => stockAlertStore.load())
onMounted(() => {
  window.addEventListener('scroll', syncActiveTabByScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', syncActiveTabByScroll)
  if (tabScrollUnlockTimer) {
    clearTimeout(tabScrollUnlockTimer)
    tabScrollUnlockTimer = null
  }
})

watch(quantity, () => {
  qtyBadgePulse.value = true
  window.setTimeout(() => {
    qtyBadgePulse.value = false
  }, 150)
})

watch(selectedColor, () => {
  highlightColorMissing.value = false
})
watch(
  () => selectedSize.value,
  () => {
    highlightSizeMissing.value = false
  },
)
</script>

<template>
  <div class="product-detail-page min-h-screen bg-background pb-36 md:pb-0">
    <!-- Main Content Area -->
    <div class="max-w-[1440px] mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-12">
      <!-- Breadcrumb -->
      <Breadcrumb
        :items="[
          {
            label: productRef?.category || 'Products',
            to: productRef?.category ? `/search?category=${productRef.category}` : undefined,
          },
          { label: productRef?.title || 'Loading...' },
        ]"
        class="mb-4 md:mb-6"
      />

      <div v-if="isLoadingRef" class="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10 lg:gap-12">
        <div class="lg:col-span-5 space-y-4">
          <Skeleton class="w-full max-w-md mx-auto lg:mx-0 aspect-[4/3] rounded-2xl" />
          <div class="flex gap-3 justify-center lg:justify-start">
            <Skeleton v-for="i in 4" :key="i" class="w-16 h-16 rounded-xl" />
          </div>
        </div>
        <div class="lg:col-span-7 space-y-8">
          <div class="space-y-4">
            <Skeleton class="h-10 w-3/4 rounded-lg" />
            <Skeleton class="h-6 w-1/4 rounded-lg" />
          </div>
          <Skeleton class="h-32 w-full rounded-2xl" />
          <div class="space-y-4">
            <Skeleton class="h-12 w-full rounded-xl" />
            <Skeleton class="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>

      <ErrorState v-else-if="errorRef" :message="errorRef" @retry="fetchDetail" />

      <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10 lg:gap-12 items-start">
        <!-- Left: 主图 / 演示视频 / 缩略图 / 放大镜 —— 整块在 <ProductGallery> 里。
             selectedColor 由右栏选择器驱动（变体图），share 是页面动作（navigator.share + toast）。 -->
        <ProductGallery
          :product-id="productId"
          :product="productRef"
          :selected-color="selectedColor"
          @share="shareProduct"
        />

        <!-- Right: Commerce & Configuration -->
        <div class="lg:col-span-7 flex flex-col space-y-5 md:space-y-10 lg:pt-2">
          <!-- Header -->
          <div class="space-y-3 md:space-y-4">
            <div
              class="flex items-center gap-1.5 md:gap-2 text-primary text-xs md:text-sm font-bold tracking-tight"
            >
              <Zap class="w-4 h-4 fill-current" />
              <span>FLASH SALE - LIMITED TIME</span>
            </div>
            <h1
              class="product-title text-[30px] md:text-5xl font-black tracking-tight leading-[1.1]"
            >
              {{ productRef?.title }}
            </h1>
            <div class="flex items-center gap-x-3 gap-y-1 md:gap-6 flex-wrap">
              <div class="flex items-center gap-1.5">
                <div class="flex text-amber-400">
                  <Star
                    v-for="i in 5"
                    :key="i"
                    class="w-4 h-4"
                    :class="
                      i <= Math.floor(productRef?.rating || 0) ? 'fill-current' : 'opacity-20'
                    "
                  />
                </div>
                <span class="text-sm font-bold">{{ safeRating.toFixed(1) }}</span>
              </div>
              <span class="h-4 w-px bg-border"></span>
              <button
                type="button"
                class="text-sm font-medium text-muted-foreground underline underline-offset-4 cursor-pointer hover:text-foreground transition-colors"
                @click="jumpToReviews"
              >
                {{ safeReviews }} Reviews
              </button>
            </div>
            <div class="product-price-row flex items-baseline gap-2 md:gap-3">
              <span class="text-3xl md:text-4xl font-black text-primary"
                >${{ formatPricePlain(productRef?.price) }}</span
              >
              <span class="text-lg md:text-xl text-muted-foreground line-through opacity-50"
                >${{ formatPricePlain(comparePrice) }}</span
              >
            </div>
          </div>

          <!-- Configuration -->
          <div
            class="space-y-5 md:space-y-8 rounded-2xl border border-border/60 bg-card/50 p-3 md:p-0 md:rounded-none md:border-0 md:bg-transparent"
          >
            <!-- Colors -->
            <div
              v-if="productRef?.colors?.length"
              ref="colorSectionRef"
              class="space-y-3 md:space-y-4 rounded-2xl p-2 transition-colors duration-300"
              :class="highlightColorMissing ? 'ring-2 ring-destructive/50 bg-destructive/5' : ''"
            >
              <div class="flex items-center justify-between gap-2">
                <label
                  class="inline-flex items-center gap-2 text-[11px] md:text-xs font-black tracking-[0.08em] md:tracking-widest uppercase"
                >
                  <span class="h-3.5 w-1 rounded-full bg-primary/80"></span>
                  <span>Color{{ selectedColor?.name ? ` — ${selectedColor.name}` : '' }}</span>
                </label>
              </div>
              <div class="flex flex-wrap gap-2 md:gap-2.5">
                <button
                  v-for="color in visibleColors"
                  :key="color.name"
                  class="flex items-center gap-2 rounded-full border-2 px-2.5 py-1.5 transition-all relative group"
                  :class="
                    selectedColor?.name === color.name
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-foreground/30'
                  "
                  :title="color.name"
                  @click="selectedColor = selectedColor?.name === color.name ? null : color"
                >
                  <div
                    class="relative w-6 h-6 rounded-full shadow-inner flex-shrink-0"
                    :style="{ backgroundColor: color.value }"
                  >
                    <Check
                      v-if="selectedColor?.name === color.name"
                      class="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow-md"
                    />
                  </div>
                  <span
                    class="text-xs font-semibold pr-0.5"
                    :class="
                      selectedColor?.name === color.name ? 'text-primary' : 'text-muted-foreground'
                    "
                    >{{ color.name }}</span
                  >
                </button>
                <button
                  v-if="hasHiddenColors"
                  class="flex items-center gap-1 rounded-full border-2 border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                  @click="colorExpanded = !colorExpanded"
                >
                  {{
                    colorExpanded
                      ? 'Collapse'
                      : `+${productRef!.colors!.length - COLLAPSE_THRESHOLD_COLORS} more`
                  }}
                </button>
              </div>
            </div>

            <!-- Sizes -->
            <div
              v-if="productRef?.sizes?.length"
              ref="sizeSectionRef"
              class="space-y-3 md:space-y-4 rounded-2xl p-2 transition-colors duration-300"
              :class="highlightSizeMissing ? 'ring-2 ring-destructive/50 bg-destructive/5' : ''"
            >
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <label
                  class="inline-flex items-center gap-2 text-[11px] md:text-xs font-black tracking-[0.08em] md:tracking-widest uppercase"
                >
                  <span class="h-3.5 w-1 rounded-full bg-primary/80"></span>
                  <span
                    >{{ productRef.specLabel || 'Size'
                    }}{{ selectedSize ? ` — ${selectedSize}` : '' }}</span
                  >
                </label>
                <button
                  v-if="productRef?.hasSizeGuide && productRef?.sizes?.length"
                  class="inline-flex items-center gap-1.5 text-[11px] md:text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                  @click="showSizeGuide = true"
                >
                  <Ruler class="w-3.5 h-3.5" />
                  Size Guide
                </button>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  v-for="size in visibleSpecs"
                  :key="size"
                  :data-size="size"
                  class="min-h-[44px] md:h-12 rounded-xl px-2 text-sm leading-tight text-center font-bold transition-all border-2 flex items-center justify-center relative"
                  :class="
                    selectedSize === size
                      ? 'border-primary bg-primary/5 text-primary shadow-sm shadow-primary/10'
                      : 'border-border hover:border-foreground'
                  "
                  @click="selectedSize = selectedSize === size ? '' : size"
                >
                  <Check
                    v-if="selectedSize === size"
                    class="absolute top-1 right-1 w-3 h-3 text-primary"
                  />
                  {{ size }}
                </button>
                <button
                  v-if="hasHiddenSpecs"
                  class="min-h-[44px] md:h-12 rounded-xl px-2 text-sm leading-tight text-center font-semibold border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                  @click="specExpanded = !specExpanded"
                >
                  {{
                    specExpanded
                      ? 'Collapse'
                      : `+${productRef!.sizes!.length - COLLAPSE_THRESHOLD_SPECS} more`
                  }}
                </button>
              </div>
            </div>

            <!-- 尺码指南弹窗（阶段 4.2） -->
            <SizeGuide
              v-if="productRef?.hasSizeGuide && productRef?.sizes?.length"
              v-model="showSizeGuide"
              :sizes="productRef.sizes"
              :selected-size="selectedSize"
              @select="
                (size: string) => {
                  selectedSize = size
                  showSizeGuide = false
                }
              "
            />

            <!-- Quantity & CTA -->
            <div class="space-y-3 md:space-y-4 pt-2 md:pt-4">
              <div class="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4">
                <!-- Quantity Picker -->
                <div
                  class="inline-flex w-fit self-start items-center gap-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl p-1 border border-border"
                >
                  <button
                    class="w-10 h-10 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all duration-150 active:scale-95"
                    :class="qtyButtonPulse === 'minus' ? 'bg-primary/10 text-primary scale-95' : ''"
                    @click="decrement"
                  >
                    <Minus class="w-4 h-4" />
                  </button>
                  <span class="min-w-[2.75rem] px-1 text-center font-bold">{{ quantity }}</span>
                  <button
                    class="w-10 h-10 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all duration-150 active:scale-95"
                    :class="qtyButtonPulse === 'plus' ? 'bg-primary/10 text-primary scale-95' : ''"
                    @click="increment"
                  >
                    <Plus class="w-4 h-4" />
                  </button>
                </div>
                <!-- Add to Cart -->
                <Button
                  size="lg"
                  data-testid="pdp-add-to-bag"
                  class="flex-1 h-12 md:h-14 rounded-2xl text-sm md:text-base font-black tracking-tight transition-all duration-300"
                  :class="
                    addToBagSuccessPulse
                      ? 'ring-2 ring-primary/40 shadow-[0_0_0_4px_rgba(124,58,237,0.18)]'
                      : ''
                  "
                  @click="addToCart"
                >
                  <Check v-if="addToBagSuccessPulse" class="w-5 h-5 mr-2" />
                  <ShoppingBag v-else class="w-5 h-5 mr-2" />
                  {{ addToBagSuccessPulse ? 'ADDED' : 'ADD TO BAG' }}
                </Button>
              </div>
              <!-- Buy Now -->
              <Button
                size="lg"
                variant="outline"
                class="w-full h-12 md:h-14 rounded-2xl text-sm md:text-base font-black tracking-tight border-2 hover:bg-foreground hover:text-background transition-all duration-150 active:scale-[0.99]"
                :class="
                  buyNowPulse
                    ? 'border-primary/40 bg-primary/5 text-primary shadow-[0_0_0_3px_rgba(124,58,237,0.12)] scale-[0.99]'
                    : ''
                "
                @click="buyNow"
              >
                BUY IT NOW
              </Button>
              <!-- Wishlist -->
              <Button
                variant="ghost"
                class="w-full h-10 rounded-xl text-sm font-semibold transition-all"
                :class="
                  productRef && wishlistStore.isInWishlist(productRef.id)
                    ? 'text-red-500 bg-red-50 dark:bg-red-950/20'
                    : ''
                "
                @click="
                  productRef &&
                  wishlistStore.toggleItem({
                    id: productRef.id,
                    title: productRef.title,
                    price: productRef.price,
                    image: productRef.image ?? productRef.images?.[0] ?? '',
                    category: productRef.category,
                    rating: productRef.rating,
                    reviews: productRef.reviews,
                  })
                "
              >
                <Heart
                  class="w-4 h-4 mr-2"
                  :class="{
                    'fill-current': productRef && wishlistStore.isInWishlist(productRef.id),
                  }"
                />
                {{
                  productRef && wishlistStore.isInWishlist(productRef.id)
                    ? 'SAVED TO WISHLIST'
                    : 'ADD TO WISHLIST'
                }}
              </Button>
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <span
                  v-if="productRef?.colors?.length"
                  class="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 font-semibold text-primary"
                >
                  <span
                    class="mr-1.5 h-2.5 w-2.5 rounded-full border border-black/10 dark:border-white/20"
                    :style="{ backgroundColor: selectedColor?.value || '#9ca3af' }"
                  ></span>
                  {{ selectedColor?.name }}
                </span>
                <span
                  v-if="productRef?.sizes?.length"
                  class="inline-flex items-center rounded-full border border-border bg-secondary/40 px-2.5 py-1 font-semibold text-foreground/80"
                >
                  {{ selectedSize }}
                </span>
                <span
                  class="inline-flex items-center rounded-full border border-border bg-secondary/40 px-2.5 py-1 font-semibold text-foreground/80 transition-all duration-150"
                  :class="
                    qtyBadgePulse ? 'border-primary/40 bg-primary/10 text-primary scale-[1.03]' : ''
                  "
                >
                  <Hash class="mr-1 h-3 w-3 opacity-70" />
                  Qty {{ quantity }}
                </span>
              </div>
              <button
                class="w-full py-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
                @click="contactSeller"
              >
                <MessageSquare class="w-4 h-4" />
                CHAT WITH SPECIALIST
              </button>
            </div>
          </div>

          <!-- Stock Status -->
          <div v-if="stockStatus.text" class="flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full"
              :class="{
                'bg-emerald-500': stockStatus.type === 'success',
                'bg-amber-500': stockStatus.type === 'warning',
                'bg-red-500': stockStatus.type === 'danger',
              }"
            ></span>
            <span
              class="text-xs font-bold"
              :class="{
                'text-emerald-600': stockStatus.type === 'success',
                'text-amber-600': stockStatus.type === 'warning',
                'text-red-600': stockStatus.type === 'danger',
              }"
              >{{ stockStatus.text }}</span
            >

            <!-- Notify when back in stock -->
            <button
              v-if="stockStatus.type === 'danger' && productRef"
              class="text-xs font-bold px-2.5 py-1 rounded-full border transition-colors"
              :class="
                stockAlertStore.isSubscribed(productRef.id)
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400 hover:bg-amber-100'
              "
              @click="
                stockAlertStore.isSubscribed(productRef.id)
                  ? stockAlertStore.unsubscribe(productRef.id)
                  : stockAlertStore.subscribe(
                      {
                        id: productRef.id,
                        title: productRef.title,
                        image: productRef.image ?? productRef.images?.[0] ?? '',
                      },
                      authStore.user?.email || '',
                    )
              "
            >
              {{
                stockAlertStore.isSubscribed(productRef.id)
                  ? '✓ Notified on Restock'
                  : '🔔 Notify Me'
              }}
            </button>
          </div>

          <!-- Trust Badges -->
          <div
            class="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 p-4 md:p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl md:rounded-[2rem] border border-border/50"
          >
            <div class="flex flex-col gap-2">
              <Truck class="w-6 h-6 text-primary" />
              <span class="text-xs font-black uppercase tracking-tighter">Fast Shipping</span>
              <span class="text-[10px] text-muted-foreground">Free on orders over $100</span>
            </div>
            <div class="flex flex-col gap-2 border-l border-border pl-4">
              <ShieldCheck class="w-6 h-6 text-primary" />
              <span class="text-xs font-black uppercase tracking-tighter">2 Year Warranty</span>
              <span class="text-[10px] text-muted-foreground">Genuine certified product</span>
            </div>
          </div>

          <!-- Merchant Store Card -->
          <div
            v-if="merchantLoading"
            class="rounded-2xl border border-border p-4 flex items-center gap-3"
          >
            <Skeleton class="w-12 h-12 rounded-full flex-shrink-0" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4 w-28" />
              <Skeleton class="h-3 w-40" />
            </div>
          </div>
          <div
            v-else-if="merchantProfile"
            class="rounded-2xl border border-border bg-card p-4 space-y-3"
          >
            <div class="flex items-center gap-3">
              <router-link :to="`/store/${merchantProfile.id}`" class="flex-shrink-0">
                <div
                  class="w-12 h-12 rounded-full overflow-hidden border-2 border-border bg-secondary"
                >
                  <img
                    :src="merchantProfile.avatar"
                    :alt="merchantProfile.storeName"
                    class="w-full h-full object-cover"
                  />
                </div>
              </router-link>
              <div class="flex-1 min-w-0">
                <router-link
                  :to="`/store/${merchantProfile.id}`"
                  class="hover:text-primary transition-colors"
                >
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold text-sm truncate">{{ merchantProfile.storeName }}</span>
                    <ShieldCheck
                      v-if="merchantProfile.verified"
                      class="w-3.5 h-3.5 text-primary flex-shrink-0"
                    />
                  </div>
                </router-link>
                <div class="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span class="flex items-center gap-0.5"
                    ><Star class="w-3 h-3 text-amber-500 fill-amber-500" />
                    {{ merchantProfile.stats.rating }}</span
                  >
                  <span>•</span>
                  <span>{{ merchantProfile.stats.totalProducts }} products</span>
                  <span>•</span>
                  <span class="flex items-center gap-0.5"
                    ><Clock class="w-3 h-3" /> {{ merchantProfile.responseTime }}</span
                  >
                </div>
              </div>
            </div>
            <div class="flex gap-2">
              <router-link :to="`/store/${merchantProfile.id}`" class="flex-1">
                <Button variant="outline" size="sm" class="w-full text-xs gap-1.5 h-8">
                  <Store class="w-3.5 h-3.5" />
                  Visit Store
                </Button>
              </router-link>
              <Button
                variant="outline"
                size="sm"
                class="flex-1 text-xs gap-1.5 h-8"
                @click="contactSeller"
              >
                <MessageSquare class="w-3.5 h-3.5" />
                Chat
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Secondary Content: Tabs -->
      <div v-if="productRef" class="mt-14 md:mt-24 border-t border-border pt-10 md:pt-16">
        <div class="max-w-4xl mx-auto">
          <!-- Tabs Header (Modern Pills) -->
          <div
            ref="tabSwitcherRef"
            class="sticky z-30 flex items-stretch p-1 bg-zinc-100/95 dark:bg-zinc-900/95 backdrop-blur rounded-2xl mb-8 shadow-sm"
            :style="{ top: 'calc(var(--app-header-offset, 64px) + 12px)' }"
            role="tablist"
            aria-label="Product detail sections"
          >
            <span
              class="pointer-events-none absolute top-1 bottom-1 rounded-xl bg-white dark:bg-zinc-800 shadow-sm transition-all duration-300 ease-out"
              :style="{
                width: 'calc((100% - 0.5rem) / 4)',
                left: `calc(0.25rem + ${activeTabIndex} * ((100% - 0.5rem) / 4))`,
              }"
            />
            <button
              v-for="(tab, idx) in tabKeys"
              :key="tab"
              :data-tab="tab"
              class="relative z-10 flex-1 py-3 rounded-xl text-[10px] sm:text-xs font-black tracking-[0.08em] sm:tracking-widest uppercase transition-all duration-300 ease-out transform-gpu"
              :class="
                activeTab === tab
                  ? 'text-primary -translate-y-0.5'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-zinc-800/50'
              "
              role="tab"
              :aria-selected="activeTab === tab"
              :aria-controls="`${tab}-section`"
              :tabindex="activeTab === tab ? 0 : -1"
              @click="switchTab(tab as 'details' | 'specs' | 'reviews' | 'qa')"
              @keydown="onTabKeydown($event, idx)"
            >
              {{ tab }}
            </button>
          </div>

          <!-- Tab Content Area -->
          <div class="min-h-[400px] space-y-12">
            <!-- Details -->
            <section id="details-section" ref="detailsSectionRef" class="scroll-mt-40 space-y-8">
              <div class="prose prose-zinc dark:prose-invert max-w-none">
                <h3 class="text-2xl font-black mb-6">Designed for the future.</h3>
                <p class="text-lg leading-relaxed text-muted-foreground">
                  {{ productRef.description }}
                </p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-12 mt-12">
                  <div class="space-y-4">
                    <div class="w-12 h-1 bg-primary rounded-full"></div>
                    <h4 class="font-bold text-xl">Premium Materials</h4>
                    <p class="text-sm text-muted-foreground leading-relaxed">
                      Crafted with aerospace-grade materials ensuring durability without
                      compromising on the elegant aesthetic.
                    </p>
                  </div>
                  <div class="space-y-4">
                    <div class="w-12 h-1 bg-primary rounded-full"></div>
                    <h4 class="font-bold text-xl">Intuitive Design</h4>
                    <p class="text-sm text-muted-foreground leading-relaxed">
                      Every curve and button is meticulously placed for the most natural user
                      experience possible.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <!-- Specs -->
            <section id="specs-section" ref="specsSectionRef" class="scroll-mt-40 space-y-1">
              <div
                v-for="(val, key) in {
                  Brand: 'Nexus',
                  Category: productRef.category,
                  Model: '2024 Gen 2',
                  Warranty: '2 Years',
                  Origin: 'Imported',
                  'In Box': 'Device, Cable, Manual',
                }"
                :key="key"
                class="flex justify-between py-5 border-b border-border group hover:bg-zinc-50 dark:hover:bg-zinc-900/50 px-4 transition-colors rounded-lg"
              >
                <span class="text-sm font-bold tracking-widest uppercase text-muted-foreground">{{
                  key
                }}</span>
                <span class="text-sm font-black">{{ val }}</span>
              </div>
            </section>

            <!-- Reviews：整块在 <ReviewSection> 里（含评分分布、筛选、写评价、回复、投票、图片预览）。
                 它自带 id="reviews-section"，tab 滚动联动按 id 找它。 -->
            <ReviewSection :product-id="productId" @submitted="activeTab = 'reviews'" />

            <!-- Q&A -->
            <section id="qa-section" ref="qaSectionRef" class="scroll-mt-40 space-y-10">
              <div>
                <h3 class="text-2xl font-black mb-2">Questions & Answers</h3>
                <p class="text-muted-foreground text-sm">
                  Ask the seller or other buyers about this product.
                </p>
              </div>
              <ProductQA
                v-if="productRef"
                :product-id="productRef.id"
                :product-title="productRef.title"
              />
            </section>
          </div>
        </div>
      </div>
    </div>

    <!-- 商品推荐（阶段 1.1）：凑单 + 猜你喜欢，整块在 <ProductRecommendations> 里。
         它自己加载数据（本块模板本来就在 v-if="productRef" 内，商品没出来时不挂载）；
         接规格 prop 是因为「加入购物车」要按用户当前选的颜色/尺码/数量加主商品。 -->
    <ProductRecommendations
      v-if="productRef"
      :product-id="productId"
      :product="productRef"
      :selected-color="selectedColor"
      :selected-size="selectedSize"
      :quantity="quantity"
    />

    <!-- Mobile Sticky Purchase Bar -->
    <div
      v-if="productRef"
      class="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div class="px-3 sm:px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.6rem)]">
        <div class="flex items-end justify-between gap-3 mb-2">
          <div class="min-w-0 flex-1">
            <div class="text-[11px] leading-4 text-muted-foreground truncate">
              <template v-if="productRef?.colors?.length">{{ selectedColor?.name }} · </template
              ><template v-if="productRef?.sizes?.length">{{ selectedSize }} · </template>Qty
              {{ quantity }}
            </div>
            <div class="text-[31px] sm:text-[33px] font-black text-primary leading-none mt-0.5">
              ${{ formatPricePlain(productRef?.price) }}
            </div>
          </div>
          <button
            class="h-9 mb-0.5 shrink-0 px-3 rounded-lg border border-primary/20 bg-primary/5 text-xs font-bold text-primary hover:bg-primary/10 transition-colors flex items-center gap-1.5"
            @click="contactSeller"
          >
            <MessageSquare class="w-3.5 h-3.5" />
            Chat
          </button>
          <button
            v-if="productRef"
            class="h-9 mb-0.5 shrink-0 w-9 rounded-lg border flex items-center justify-center transition-colors"
            :class="
              wishlistStore.isInWishlist(productRef.id)
                ? 'border-red-200 bg-red-50 dark:bg-red-950/20 text-red-500'
                : 'border-border bg-card text-muted-foreground'
            "
            @click="
              wishlistStore.toggleItem({
                id: productRef.id,
                title: productRef.title,
                price: productRef.price,
                image: productRef.image ?? productRef.images?.[0] ?? '',
                category: productRef.category,
                rating: productRef.rating,
                reviews: productRef.reviews,
              })
            "
          >
            <Heart
              class="w-4 h-4"
              :class="{ 'fill-current': wishlistStore.isInWishlist(productRef.id) }"
            />
          </button>
        </div>
        <div class="mobile-buy-actions grid grid-cols-2 gap-2">
          <Button
            size="sm"
            data-testid="pdp-add-to-bag-mobile"
            class="h-11 rounded-xl text-sm font-black"
            @click="addToCart"
          >
            Add to Bag
          </Button>
          <Button
            size="sm"
            variant="outline"
            class="h-11 rounded-xl text-sm font-black border-2"
            @click="buyNow"
          >
            Buy Now
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 390px) {
  .product-detail-page .product-title {
    font-size: 1.65rem;
    line-height: 1.15;
  }

  .product-detail-page .product-price-row {
    gap: 0.35rem;
  }

  .product-detail-page .mobile-buy-actions {
    grid-template-columns: 1fr;
  }
}
</style>

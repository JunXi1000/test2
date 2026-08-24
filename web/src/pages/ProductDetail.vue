<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Star, Truck, ShieldCheck, Minus, Plus, Share2, MessageSquare, Check, ShoppingBag, Zap, ChevronLeft, ChevronRight, ThumbsUp, X, Hash, Store, Clock, Package, Reply, CornerDownRight, Trash2, BadgeCheck, Heart, Play, Ruler } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import SizeGuide from '@/components/ui/SizeGuide.vue'
import { useCartStore } from '@/stores/cart'
import { useWishlistStore } from '@/stores/wishlist'
import { useBrowsingHistory } from '@/stores/browsingHistory'
import { useStockAlertStore } from '@/stores/stockAlerts'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { getProductById, getRelatedProducts, getBoughtTogether } from '@/api/modules/product'
import type { Product } from '@/types/product'
import ErrorState from '@/components/ui/state/ErrorState.vue'
import Breadcrumb from '@/components/ui/Breadcrumb.vue'
import ProductQA from '@/components/ui/ProductQA.vue'
import ProductCard from '@/components/ui/card/ProductCard.vue'
import { getMerchantPublicProfile, type MerchantPublicProfile } from '@/api/modules/merchantPublic'

const route = useRoute()
const router = useRouter()
const cartStore = useCartStore()
const wishlistStore = useWishlistStore()
const browsingHistory = useBrowsingHistory()
const stockAlertStore = useStockAlertStore()
const { toast } = useToast()
const productId = Number(route.params.id)

const isLoadingRef = ref<boolean>(true)
const productRef = ref<Product | null>(null)
const errorRef = ref<string>('')

const currentImageIndex = ref(0)
const thumbnailStripRef = ref<HTMLElement | null>(null)
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
  if (selectedColor.value && !visible.find(c => c.name === selectedColor.value?.name)) {
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

const hasHiddenColors = computed(() => (productRef.value?.colors?.length || 0) > COLLAPSE_THRESHOLD_COLORS)
const hasHiddenSpecs = computed(() => (productRef.value?.sizes?.length || 0) > COLLAPSE_THRESHOLD_SPECS)

/** 相册条目：图片与演示视频混排（阶段 4.1）。视频固定插入到第 2 位（index 1）。 */
type GalleryItem = { kind: 'image'; src: string } | { kind: 'video'; src: string }

const galleryItems = computed<GalleryItem[]>(() => {
  const p = productRef.value
  if (!p) return []
  const imgs = p.images?.length ? p.images : [p.image]
  const items: GalleryItem[] = imgs.map((src) => ({ kind: 'image', src }))
  if (p.video) {
    items.splice(1, 0, { kind: 'video', src: p.video })
  }
  return items
})

const currentGalleryItem = computed<GalleryItem | null>(() => galleryItems.value[currentImageIndex.value] ?? null)
const isCurrentVideo = computed(() => currentGalleryItem.value?.kind === 'video')
/** 视频封面图：复用商品首图 */
const videoPoster = computed(() => productRef.value?.image ?? productRef.value?.images?.[0] ?? imageFallback)

const currentImage = computed(() => {
  if (productRef.value?.variantImages && selectedColor.value?.name && productRef.value.variantImages[selectedColor.value.name]) {
    return productRef.value.variantImages[selectedColor.value.name]
  }
  const item = galleryItems.value[currentImageIndex.value]
  if (item?.kind === 'image') return item.src
  return productRef.value?.images?.[0] ?? productRef.value?.image ?? ''
})

const galleryImages = computed(() => {
  const p = productRef.value
  if (!p) return []
  return p.images?.length ? p.images : [p.image]
})

const canPrevImage = computed(() => galleryItems.value.length > 1)
const canNextImage = computed(() => galleryItems.value.length > 1)

const mainImageSlotKey = computed(() => `main-${selectedColor.value?.name || 'default'}-${currentImageIndex.value}`)
const resolvedMainImage = computed(() => resolveImageSrc(mainImageSlotKey.value, currentImage.value || imageFallback))

const safeRating = computed(() => Number(productRef.value?.rating ?? 0))
const safeReviews = computed(() => Number(productRef.value?.reviews ?? 0))
const comparePrice = computed(() => Number((productRef.value?.price ?? 0) * 1.2))
const imageFallback = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="720" height="540" viewBox="0 0 720 540"><rect width="720" height="540" fill="%23e5e7eb"/><g fill="%239ca3af"><circle cx="280" cy="220" r="34"/><path d="M120 390l130-120 95 90 85-70 170 100H120z"/></g><text x="360" y="470" font-family="Arial,sans-serif" font-size="28" fill="%236b7280" text-anchor="middle">Image unavailable</text></svg>'
const imageFailoverCursor = ref<Record<string, number>>({})
const isDevMode = import.meta.env.DEV
const devImageFailTotal = ref(0)
const devImageFailByUrl = ref<Record<string, number>>({})

function formatPrice(price: number | undefined) {
  return Number(price ?? 0).toLocaleString('en-US')
}

function buildImageCandidates(primarySrc: string, slotKey: string) {
  const sanitizedPrimary = String(primarySrc || '').trim()
  const seed = encodeURIComponent(`product-${productId}-${slotKey}`)
  const candidates = [
    sanitizedPrimary,
    `https://picsum.photos/seed/${seed}/1200/900`,
    `https://picsum.photos/seed/${seed}-alt/1200/900`
  ].filter(Boolean)
  candidates.push(imageFallback)
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
  }

  if (isDevMode) {
    console.warn('[ProductDetail:image-failover]', {
      slotKey,
      failedSrc,
      primarySrc,
      nextFallbackLevel: nextCursor,
      nextSrc: candidates[nextCursor]
    })
  }

  imageFailoverCursor.value[slotKey] = nextCursor
  target.src = candidates[nextCursor]
}

function preloadImage(src: string | undefined) {
  if (!src) return
  const img = new Image()
  img.decoding = 'async'
  img.src = src
}

function getNetworkHints() {
  const connection = (navigator as Navigator & {
    connection?: {
      saveData?: boolean
      effectiveType?: string
    }
  }).connection
  return {
    saveData: Boolean(connection?.saveData),
    effectiveType: connection?.effectiveType || '4g'
  }
}

function wrapIndex(i: number, len: number): number {
  return ((i % len) + len) % len
}

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

function scheduleIdleWarmup() {
  const len = galleryImages.value.length
  if (!len) return
  const { saveData, effectiveType } = getNetworkHints()
  if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g') return

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

function selectImage(index: number) {
  if (index < 0 || index >= galleryItems.value.length) return
  currentImageIndex.value = index
  nextTick(() => {
    const target = thumbnailStripRef.value?.querySelector<HTMLElement>(`button[data-thumb-index="${index}"]`)
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
    highlightTimer = setTimeout(() => { highlightColorMissing.value = false }, 1500)
    toast({ title: 'Please select a color', variant: 'destructive' })
    return false
  }
  if (productRef.value.sizes?.length && !selectedSize.value) {
    highlightSizeMissing.value = true
    sizeSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightTimer = setTimeout(() => { highlightSizeMissing.value = false }, 1500)
    toast({ title: `Please select ${productRef.value?.specLabel?.toLowerCase() || 'a size'}`, variant: 'destructive' })
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
  if (selectedColor.value?.name && productRef.value.variantImages && productRef.value.variantImages[selectedColor.value.name]) {
    productToAdd.image = productRef.value.variantImages[selectedColor.value.name]
  }

  cartStore.addItem(productToAdd, {
    color: selectedColor.value?.name || '',
    size: selectedSize.value || '',
    quantity: quantity.value
  })
  
  toast({
    title: 'Added to cart',
    description: `${productRef.value.title} has been added.`,
    variant: 'success'
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
  if (selectedColor.value?.name && productRef.value.variantImages && productRef.value.variantImages[selectedColor.value.name]) {
    productToBuy.image = productRef.value.variantImages[selectedColor.value.name]
  }

  cartStore.setDirectBuyItem(productToBuy, {
    color: selectedColor.value?.name || '',
    size: selectedSize.value || '',
    quantity: quantity.value
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
const reviewsSectionRef = ref<HTMLElement | null>(null)
const qaSectionRef = ref<HTMLElement | null>(null)
const isProgrammaticTabScroll = ref(false)
let tabScrollUnlockTimer: ReturnType<typeof setTimeout> | null = null
let idleWarmupTimer: number | null = null

interface ReviewReply {
  id: number
  user: string
  avatar: string
  date: string
  content: string
}

interface ReviewItem {
  id: number
  user: string
  rating: number
  date: string
  content: string
  avatar: string
  images?: string[]
  helpful?: number
  replies?: ReviewReply[]
  verified?: boolean
}

const authStore = useAuthStore()

const baseReviews: ReviewItem[] = [
  {
    id: 1, user: 'Alex Chen', rating: 5, date: '2026-03-25', verified: true,
    content: 'Absolutely amazing quality. The build is solid and it feels premium in hand. Exceeded all my expectations.',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100', helpful: 12,
    replies: [
      { id: 101, user: 'Store Support', avatar: '', date: '2026-03-26', content: 'Thank you for your kind words! We\'re glad you love it.' }
    ]
  },
  {
    id: 2, user: 'Sarah Miller', rating: 4, date: '2026-03-20', verified: true,
    content: 'Great product overall, though shipping took a day longer than expected. The quality itself is top-notch.',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100', helpful: 8
  },
  {
    id: 3, user: 'Jordan Wang', rating: 5, date: '2026-03-15', verified: true,
    content: 'Best purchase this year. Highly recommend to anyone looking for quality gear. Worth every penny.',
    avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=100', helpful: 15
  },
  {
    id: 4, user: 'Emily Zhang', rating: 3, date: '2026-03-10',
    content: 'Decent product for the price. Nothing spectacular but gets the job done. Packaging could be better.',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=100', helpful: 4
  },
  {
    id: 5, user: 'Michael Brown', rating: 5, date: '2026-02-28', verified: true,
    content: 'Incredible value! I\'ve tried many similar products and this one stands out. The attention to detail is superb.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100', helpful: 20,
    images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=200']
  },
  {
    id: 6, user: 'Lisa Park', rating: 2, date: '2026-02-15',
    content: 'Not what I expected from the photos. The color was slightly off and it arrived with a minor scratch. Returning it.',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=100', helpful: 6
  },
  {
    id: 7, user: 'David Kim', rating: 4, date: '2026-02-01', verified: true,
    content: 'Solid build quality and looks great on my desk. Took one star off because the manual was hard to follow.',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=100', helpful: 3
  },
  {
    id: 8, user: 'Rachel Torres', rating: 1, date: '2026-01-20',
    content: 'Stopped working after two weeks. Very disappointing. Customer service was slow to respond.',
    avatar: '', helpful: 9,
    replies: [
      { id: 102, user: 'Store Support', avatar: '', date: '2026-01-22', content: 'We\'re sorry about your experience. Please contact us directly for a replacement.' }
    ]
  }
]

const reviewStorageRef = ref<ReviewItem[]>([])
const reviewFilter = ref<string>('all')
const reviewSort = ref<'latest' | 'top' | 'most-helpful'>('latest')
const reviewSearch = ref('')
const onlyWithImages = ref(false)
const reviewFormOpen = ref(false)
const reviewSubmitting = ref(false)
const reviewRating = ref(5)
const reviewContent = ref('')
const reviewImages = ref<string[]>([])
const reviewMaxChars = 500
const previewImageUrl = ref('')
const reviewPage = ref(1)
const reviewPageSize = 6
const helpfulDeltaRef = ref<Record<number, number>>({})
const votedReviewIds = ref<number[]>([])
const replyingToId = ref<number | null>(null)
const replyContent = ref('')
const replySubmitting = ref(false)

const reviewStorageKey = computed(() => `product_reviews_${productId}`)
const helpfulDeltaKey = computed(() => `product_review_helpful_delta_${productId}`)
const votedKey = computed(() => `product_review_helpful_voted_${productId}`)

const migratedBaseIds = computed(() =>
  new Set(reviewStorageRef.value.filter(r => r.id <= 100).map(r => r.id))
)

const hydratedBaseReviews = computed<ReviewItem[]>(() =>
  baseReviews
    .filter(r => !migratedBaseIds.value.has(r.id))
    .map((review) => ({
      ...review,
      helpful: (review.helpful ?? 0) + (helpfulDeltaRef.value[review.id] ?? 0)
    }))
)

const mergedReviews = computed<ReviewItem[]>(() => [...reviewStorageRef.value, ...hydratedBaseReviews.value])

const filteredReviews = computed<ReviewItem[]>(() => {
  let list = [...mergedReviews.value]
  if (reviewFilter.value !== 'all') {
    const rating = Number(reviewFilter.value)
    list = list.filter(r => r.rating === rating)
  }
  if (onlyWithImages.value) {
    list = list.filter(r => (r.images?.length ?? 0) > 0)
  }
  const keyword = reviewSearch.value.trim().toLowerCase()
  if (keyword) {
    list = list.filter((r) =>
      r.user.toLowerCase().includes(keyword) ||
      r.content.toLowerCase().includes(keyword)
    )
  }
  if (reviewSort.value === 'most-helpful') {
    list.sort((a, b) => (b.helpful ?? 0) - (a.helpful ?? 0))
  } else if (reviewSort.value === 'top') {
    list.sort((a, b) => b.rating - a.rating)
  } else {
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }
  return list
})

function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 0) return dateStr
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function isOwnReview(review: ReviewItem): boolean {
  return !!authStore.user && review.user === authStore.user.name
}

const visibleReviews = computed<ReviewItem[]>(() => {
  return filteredReviews.value.slice(0, reviewPage.value * reviewPageSize)
})

const hasMoreReviews = computed(() => visibleReviews.value.length < filteredReviews.value.length)

const reviewAvg = computed(() => {
  if (!mergedReviews.value.length) return 0
  const sum = mergedReviews.value.reduce((acc, item) => acc + item.rating, 0)
  return sum / mergedReviews.value.length
})
const reviewCharCount = computed(() => reviewContent.value.length)

function getInitials(name: string) {
  return name
    .split(' ')
    .map(p => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function loadPersistedReviews() {
  try {
    const raw = localStorage.getItem(reviewStorageKey.value)
    reviewStorageRef.value = raw ? (JSON.parse(raw) as ReviewItem[]) : []
  } catch {
    reviewStorageRef.value = []
  }

  try {
    const raw = localStorage.getItem(helpfulDeltaKey.value)
    helpfulDeltaRef.value = raw ? (JSON.parse(raw) as Record<number, number>) : {}
  } catch {
    helpfulDeltaRef.value = {}
  }

  try {
    const raw = localStorage.getItem(votedKey.value)
    votedReviewIds.value = raw ? (JSON.parse(raw) as number[]) : []
  } catch {
    votedReviewIds.value = []
  }
}

function persistReviews() {
  try {
    localStorage.setItem(reviewStorageKey.value, JSON.stringify(reviewStorageRef.value))
  } catch {}
}

function persistHelpfulMeta() {
  try {
    localStorage.setItem(helpfulDeltaKey.value, JSON.stringify(helpfulDeltaRef.value))
    localStorage.setItem(votedKey.value, JSON.stringify(votedReviewIds.value))
  } catch {}
}

function isReviewVoted(reviewId: number) {
  return votedReviewIds.value.includes(reviewId)
}

function toggleHelpful(reviewId: number) {
  if (isReviewVoted(reviewId)) {
    toast({ title: 'Already marked helpful', description: 'You can vote once per review.' })
    return
  }

  const persistedIdx = reviewStorageRef.value.findIndex(r => r.id === reviewId)
  if (persistedIdx >= 0) {
    reviewStorageRef.value[persistedIdx].helpful = (reviewStorageRef.value[persistedIdx].helpful ?? 0) + 1
    persistReviews()
  } else {
    helpfulDeltaRef.value[reviewId] = (helpfulDeltaRef.value[reviewId] ?? 0) + 1
  }

  votedReviewIds.value.push(reviewId)
  persistHelpfulMeta()
}

async function handleReviewImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files?.length) return

  const remain = 3 - reviewImages.value.length
  if (remain <= 0) {
    toast({ title: 'Up to 3 images only', variant: 'destructive' })
    input.value = ''
    return
  }

  const selected = Array.from(files).slice(0, remain)
  for (const file of selected) {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Only image files are supported', variant: 'destructive' })
      continue
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Image must be <= 2MB', variant: 'destructive' })
      continue
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('read_error'))
      reader.readAsDataURL(file)
    }).catch(() => '')
    if (dataUrl) reviewImages.value.push(dataUrl)
  }

  input.value = ''
}

function removeReviewImage(index: number) {
  reviewImages.value.splice(index, 1)
}

function openImagePreview(url: string) {
  previewImageUrl.value = url
}

function closeImagePreview() {
  previewImageUrl.value = ''
}

const heroCardRef = ref<HTMLElement | null>(null)
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

function getCurrentUserInfo() {
  const u = authStore.user
  if (u) return { name: u.name, avatar: u.avatar || '' }
  return { name: 'Anonymous User', avatar: '' }
}

async function submitReview() {
  if (!authStore.isAuthenticated) {
    toast({ title: 'Please sign in', description: 'You need to log in to write a review.', variant: 'destructive' })
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  const content = reviewContent.value.trim()
  if (!content) {
    toast({ title: 'Please write your review', variant: 'destructive' })
    return
  }
  if (content.length > reviewMaxChars) {
    toast({ title: `Review must be <= ${reviewMaxChars} characters`, variant: 'destructive' })
    return
  }
  reviewSubmitting.value = true
  try {
    const userInfo = getCurrentUserInfo()
    const item: ReviewItem = {
      id: Date.now(),
      user: userInfo.name,
      rating: reviewRating.value,
      date: new Date().toISOString().slice(0, 10),
      content,
      avatar: userInfo.avatar,
      images: [...reviewImages.value],
      helpful: 0,
      replies: []
    }
    reviewStorageRef.value.unshift(item)
    persistReviews()
    reviewContent.value = ''
    reviewRating.value = 5
    reviewImages.value = []
    reviewFormOpen.value = false
    reviewPage.value = 1
    toast({ title: 'Review submitted', description: 'Thanks for your feedback!', variant: 'success' })
    activeTab.value = 'reviews'
    await nextTick()
    document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } finally {
    reviewSubmitting.value = false
  }
}

function openReply(reviewId: number) {
  if (!authStore.isAuthenticated) {
    toast({ title: 'Please sign in', description: 'You need to log in to reply.', variant: 'destructive' })
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  replyingToId.value = replyingToId.value === reviewId ? null : reviewId
  replyContent.value = ''
}

function deleteReview(reviewId: number) {
  const idx = reviewStorageRef.value.findIndex(r => r.id === reviewId)
  if (idx >= 0) {
    reviewStorageRef.value.splice(idx, 1)
    persistReviews()
    toast({ title: 'Review deleted', variant: 'success' })
  }
}

async function submitReply(reviewId: number) {
  const content = replyContent.value.trim()
  if (!content) {
    toast({ title: 'Please write your reply', variant: 'destructive' })
    return
  }
  replySubmitting.value = true
  try {
    const userInfo = getCurrentUserInfo()
    const reply: ReviewReply = {
      id: Date.now(),
      user: userInfo.name,
      avatar: userInfo.avatar,
      date: new Date().toISOString().slice(0, 10),
      content
    }
    let inStorage = reviewStorageRef.value.find(r => r.id === reviewId)
    if (!inStorage) {
      const base = baseReviews.find(r => r.id === reviewId)
      if (base) {
        const clone: ReviewItem = { ...base, replies: [...(base.replies ?? [])] }
        reviewStorageRef.value.push(clone)
        inStorage = clone
      }
    }
    if (inStorage) {
      if (!inStorage.replies) inStorage.replies = []
      inStorage.replies.push(reply)
      persistReviews()
    }
    replyContent.value = ''
    replyingToId.value = null
    toast({ title: 'Reply posted', variant: 'success' })
  } finally {
    replySubmitting.value = false
  }
}

function loadMoreReviews() {
  if (hasMoreReviews.value) {
    reviewPage.value += 1
  }
}

function resetReviewFilters() {
  reviewFilter.value = 'all'
  reviewSort.value = 'latest'
  reviewSearch.value = ''
  onlyWithImages.value = false
  reviewPage.value = 1
}

const shareProduct = async () => {
  try {
    const shareData = {
      title: productRef.value?.title || 'Product',
      text: productRef.value?.description || 'Check this product',
      url: window.location.href
    }
    if (navigator.share) {
      await navigator.share(shareData)
      toast({ title: 'Shared', description: 'Product link shared successfully', variant: 'success' })
    } else {
      await navigator.clipboard.writeText(window.location.href)
      toast({ title: 'Link copied', description: 'Product link copied to clipboard', variant: 'success' })
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
    reviews: reviewsSectionRef.value,
    qa: qaSectionRef.value
  }
  const target = sectionMap[tab]
  if (!target) return

  const headerOffset = Number.parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--app-header-offset') || '64',
    10
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
  const nextButton = tabSwitcherRef.value?.querySelector<HTMLButtonElement>(`button[data-tab="${nextTab}"]`)
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
    10
  )
  const tabHeight = tabSwitcherRef.value?.offsetHeight ?? 52
  const anchorLine = headerOffset + tabHeight + 28

  const sections: Array<{ tab: 'details' | 'specs' | 'reviews' | 'qa'; el: HTMLElement | null }> = [
    { tab: 'details', el: detailsSectionRef.value },
    { tab: 'specs', el: specsSectionRef.value },
    { tab: 'reviews', el: reviewsSectionRef.value },
    { tab: 'qa', el: qaSectionRef.value }
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
  try {
    isLoadingRef.value = true
    errorRef.value = ''
    productRef.value = await getProductById(productId)

    // record browsing history
    browsingHistory.recordView({
      id: productRef.value.id,
      title: productRef.value.title,
      price: productRef.value.price,
      image: productRef.value.image ?? productRef.value.images?.[0] ?? '',
      category: productRef.value.category,
      rating: productRef.value.rating,
    })

    selectedColor.value = null
    selectedSize.value = ''

    // 商品加载完成后(此时才有真实 shopId)再加载商家信息,避免 onMounted 竞态取到假 id
    loadMerchant()
    // 并行加载推荐板块
    loadRecommendations()
  } catch (e: any) {
    errorRef.value = e?.message || 'Failed to load product'
  } finally {
    isLoadingRef.value = false
  }
}

// ── Recommendations (阶段 1.1) ──
const relatedProducts = ref<Product[]>([])
const boughtTogether = ref<Product[]>([])
const boughtTogetherSelected = ref<Set<number>>(new Set())
const recLoading = ref(false)

async function loadRecommendations() {
  recLoading.value = true
  try {
    const [related, together] = await Promise.all([
      getRelatedProducts(productId, 6),
      getBoughtTogether(productId, 3),
    ])
    relatedProducts.value = related
    boughtTogether.value = together
    // 默认全部选中搭配购买
    boughtTogetherSelected.value = new Set(together.map(p => p.id))
  } catch {
    relatedProducts.value = []
    boughtTogether.value = []
  } finally {
    recLoading.value = false
  }
}

const boughtTogetherTotal = computed(() => {
  const ids = boughtTogetherSelected.value
  return boughtTogether.value
    .filter(p => ids.has(p.id))
    .reduce((sum, p) => sum + Number(p.price), Number(productRef.value?.price ?? 0))
})

function toggleBoughtTogether(id: number) {
  const next = new Set(boughtTogetherSelected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  boughtTogetherSelected.value = next
}

function addBoughtTogetherToCart() {
  if (!productRef.value) return
  const ids = boughtTogetherSelected.value
  // 主商品
  cartStore.addItem(productRef.value, { color: selectedColor.value?.name ?? 'Default', size: selectedSize.value || 'Standard', quantity: quantity.value })
  // 搭配商品
  boughtTogether.value.forEach(p => {
    if (ids.has(p.id)) {
      cartStore.addItem(p, { color: 'Default', size: 'Standard', quantity: 1 })
    }
  })
  toast({
    title: 'Bundle Added to Cart',
    description: `${ids.size + 1} items added`,
    variant: 'success',
  })
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
  } catch {}
  finally { merchantLoading.value = false }
}

// ── Review rating distribution ──
const ratingDistribution = computed(() => {
  const dist = [0, 0, 0, 0, 0]
  const all = mergedReviews.value
  all.forEach(r => {
    if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++
  })
  const max = Math.max(...dist, 1)
  return [5, 4, 3, 2, 1].map(star => ({
    star,
    count: dist[star - 1],
    percentage: Math.round((dist[star - 1] / max) * 100)
  }))
})

// ── Stock status (mock) ──
const stockStatus = computed(() => {
  if (!productRef.value) return { text: '', type: '' }
  const id = productRef.value.id
  const stock = ((id * 7 + 13) % 100)
  if (stock > 20) return { text: 'In Stock', type: 'success' }
  if (stock > 0) return { text: `Only ${stock} left`, type: 'warning' }
  return { text: 'Out of Stock', type: 'danger' }
})

onMounted(fetchDetail)
onMounted(loadPersistedReviews)
onMounted(() => stockAlertStore.load())
onMounted(() => {
  window.addEventListener('scroll', syncActiveTabByScroll, { passive: true })
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
      topFailed
    })
  }

  window.removeEventListener('scroll', syncActiveTabByScroll)
  if (tabScrollUnlockTimer) {
    clearTimeout(tabScrollUnlockTimer)
    tabScrollUnlockTimer = null
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

watch([reviewFilter, reviewSort, reviewSearch, onlyWithImages], () => {
  reviewPage.value = 1
})

watch(currentImageIndex, () => {
  warmupNearbyGalleryImages()
  scheduleIdleWarmup()
})

watch(galleryItems, () => {
  imageFailoverCursor.value = {}
  warmupNearbyGalleryImages()
  scheduleIdleWarmup()
})

watch(quantity, () => {
  qtyBadgePulse.value = true
  window.setTimeout(() => {
    qtyBadgePulse.value = false
  }, 150)
})

watch(selectedColor, () => { highlightColorMissing.value = false })
watch(() => selectedSize.value, () => { highlightSizeMissing.value = false })
</script>

<template>
  <div class="product-detail-page min-h-screen bg-background pb-36 md:pb-0">
    <!-- Main Content Area -->
    <div class="max-w-[1440px] mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-12">

      <!-- Breadcrumb -->
      <Breadcrumb
        :items="[
          { label: productRef?.category || 'Products', to: productRef?.category ? `/search?category=${productRef.category}` : undefined },
          { label: productRef?.title || 'Loading...' }
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
        
        <!-- Left: Visual Experience (narrower column — product frame reads smaller) -->
        <div class="lg:col-span-5 space-y-3 md:space-y-4 lg:sticky lg:top-24 relative w-full">
          <div
            ref="heroCardRef"
            class="product-hero-card relative aspect-[4/3] rounded-2xl md:rounded-3xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-border/50"
          >
            <!-- 演示视频：与图片混排相册，原生 controls 支持播放/暂停/全屏（阶段 4.1） -->
            <video
              v-if="isCurrentVideo"
              :key="`gallery-video-${currentImageIndex}`"
              :src="currentGalleryItem?.src"
              class="w-full h-full object-contain p-3 md:p-5"
              controls
              playsinline
              preload="metadata"
              :poster="videoPoster"
            ></video>
            <img
              v-else
              :src="resolveImageSrc(`main-${selectedColor?.name || 'default'}-${currentImageIndex}`, currentImage || imageFallback)"
              class="w-full h-full object-contain p-3 md:p-5"
              :alt="productRef?.title"
              @error="onImageError($event, `main-${selectedColor?.name || 'default'}-${currentImageIndex}`, currentImage || imageFallback)"
              fetchpriority="high"
              loading="eager"
              decoding="async"
              draggable="false"
            />
            <!-- Zoom capture layer: sits above image, below buttons（视频时禁用，避免遮挡播放控件） -->
            <div
              v-if="!isCurrentVideo"
              class="hidden lg:block absolute inset-0 z-[1]"
              :class="zoomActive ? 'cursor-crosshair' : 'cursor-zoom-in'"
              @mousemove="onHeroMouseMove"
              @mouseleave="onHeroMouseLeave"
            />
            <!-- Zoom Lens Indicator -->
            <div
              v-if="!isCurrentVideo && zoomActive"
              class="hidden lg:block absolute pointer-events-none border-2 border-primary/40 bg-primary/10 rounded-sm z-[2]"
              :style="{
                width: `${LENS_SIZE}px`,
                height: `${LENS_SIZE}px`,
                left: `${zoomLensX}px`,
                top: `${zoomLensY}px`
              }"
            />
            <span
              v-if="isDevMode && isUsingBackupSource(`main-${selectedColor?.name || 'default'}-${currentImageIndex}`)"
              class="absolute top-4 right-16 md:top-6 md:right-20 px-2 py-1 rounded-full bg-black/50 text-white text-[10px] font-semibold tracking-wide z-[3]"
            >
              Backup image
            </span>
            <button
              v-if="galleryItems.length > 1"
              class="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/60 transition z-[3]"
              :disabled="!canPrevImage"
              :class="!canPrevImage ? 'opacity-40 cursor-not-allowed' : ''"
              @click="prevImage"
            >
              <ChevronLeft class="w-5 h-5" />
            </button>
            <button
              v-if="galleryItems.length > 1"
              class="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/60 transition z-[3]"
              :disabled="!canNextImage"
              :class="!canNextImage ? 'opacity-40 cursor-not-allowed' : ''"
              @click="nextImage"
            >
              <ChevronRight class="w-5 h-5" />
            </button>
            <!-- Badges -->
            <div class="absolute top-4 left-4 md:top-6 md:left-6 flex flex-col gap-1.5 md:gap-2 z-[3] pointer-events-none">
              <span class="px-2.5 md:px-3 py-1 md:py-1.5 bg-white/90 dark:bg-black/90 backdrop-blur-md rounded-full text-[9px] md:text-[10px] font-bold tracking-wider md:tracking-widest uppercase shadow-sm">New Arrival</span>
              <span v-if="Number(productRef?.rating ?? 0) >= 4.8" class="px-2.5 md:px-3 py-1 md:py-1.5 bg-primary text-primary-foreground rounded-full text-[9px] md:text-[10px] font-bold tracking-wider md:tracking-widest uppercase shadow-sm">Top Rated</span>
            </div>
            <!-- Actions -->
            <div class="absolute top-4 right-4 md:top-6 md:right-6 z-[3]">
              <button 
                @click="shareProduct"
                class="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/90 dark:bg-black/90 backdrop-blur-md flex items-center justify-center text-foreground hover:bg-primary hover:text-white transition-all shadow-md active:scale-95"
              >
                <Share2 class="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
          </div>
          
          <!-- Thumbnail Strip（图片与演示视频混排，视频缩略图带播放角标） -->
          <div v-if="galleryItems.length > 1" ref="thumbnailStripRef" class="flex gap-2 md:gap-3 overflow-x-auto pb-2 no-scrollbar px-0.5 md:px-1 snap-x snap-mandatory scroll-px-1 md:scroll-px-2 [-webkit-overflow-scrolling:touch] justify-center lg:justify-start">
            <button
              v-for="(item, idx) in galleryItems"
              :key="idx"
              @click="selectImage(idx)"
              :data-thumb-index="idx"
              :data-thumb-kind="item.kind"
              class="relative flex-shrink-0 snap-start w-14 h-14 md:w-16 md:h-16 rounded-lg md:rounded-xl overflow-hidden border-2 transition-all duration-300 group"
              :class="currentImageIndex === idx ? 'border-primary p-1 scale-105' : 'border-transparent opacity-60 hover:opacity-100'"
            >
              <template v-if="item.kind === 'video'">
                <img
                  :src="resolveImageSrc(`thumb-${idx}`, videoPoster)"
                  class="w-full h-full object-cover rounded-xl"
                  :alt="`${productRef?.title || 'Product'} demo video`"
                  @error="onImageError($event, `thumb-${idx}`, videoPoster)"
                  :loading="idx <= 2 ? 'eager' : 'lazy'"
                  decoding="async"
                />
                <span class="absolute inset-0 flex items-center justify-center rounded-xl bg-black/35">
                  <span class="flex items-center justify-center w-6 h-6 rounded-full bg-white/95 text-foreground shadow-sm">
                    <Play class="w-3.5 h-3.5 ml-0.5" />
                  </span>
                </span>
              </template>
              <img
                v-else
                :src="resolveImageSrc(`thumb-${idx}`, item.src || imageFallback)"
                class="w-full h-full object-cover rounded-xl"
                :alt="`${productRef?.title || 'Product'} thumbnail ${idx + 1}`"
                @error="onImageError($event, `thumb-${idx}`, item.src || imageFallback)"
                :loading="idx <= 2 ? 'eager' : 'lazy'"
                :fetchpriority="idx === currentImageIndex ? 'high' : 'low'"
                decoding="async"
              />
            </button>
          </div>

        </div>

        <!-- Right: Commerce & Configuration -->
        <div class="lg:col-span-7 flex flex-col space-y-5 md:space-y-10 lg:pt-2">
          <!-- Header -->
          <div class="space-y-3 md:space-y-4">
            <div class="flex items-center gap-1.5 md:gap-2 text-primary text-xs md:text-sm font-bold tracking-tight">
              <Zap class="w-4 h-4 fill-current" />
              <span>FLASH SALE - LIMITED TIME</span>
            </div>
            <h1 class="product-title text-[30px] md:text-5xl font-black tracking-tight leading-[1.1]">{{ productRef?.title }}</h1>
            <div class="flex items-center gap-x-3 gap-y-1 md:gap-6 flex-wrap">
              <div class="flex items-center gap-1.5">
                <div class="flex text-amber-400">
                  <Star v-for="i in 5" :key="i" class="w-4 h-4" :class="i <= Math.floor(productRef?.rating || 0) ? 'fill-current' : 'opacity-20'" />
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
              <span class="text-3xl md:text-4xl font-black text-primary">${{ formatPrice(productRef?.price) }}</span>
              <span class="text-lg md:text-xl text-muted-foreground line-through opacity-50">${{ formatPrice(comparePrice) }}</span>
            </div>
          </div>

          <!-- Configuration -->
          <div class="space-y-5 md:space-y-8 rounded-2xl border border-border/60 bg-card/50 p-3 md:p-0 md:rounded-none md:border-0 md:bg-transparent">
            <!-- Colors -->
            <div
              v-if="productRef?.colors?.length"
              ref="colorSectionRef"
              class="space-y-3 md:space-y-4 rounded-2xl p-2 transition-colors duration-300"
              :class="highlightColorMissing ? 'ring-2 ring-destructive/50 bg-destructive/5' : ''"
            >
              <div class="flex items-center justify-between gap-2">
                <label class="inline-flex items-center gap-2 text-[11px] md:text-xs font-black tracking-[0.08em] md:tracking-widest uppercase">
                  <span class="h-3.5 w-1 rounded-full bg-primary/80"></span>
                  <span>Color{{ selectedColor?.name ? ` — ${selectedColor.name}` : '' }}</span>
                </label>
              </div>
              <div class="flex flex-wrap gap-2 md:gap-2.5">
                <button 
                  v-for="color in visibleColors" 
                  :key="color.name"
                  @click="selectedColor = selectedColor?.name === color.name ? null : color"
                  class="flex items-center gap-2 rounded-full border-2 px-2.5 py-1.5 transition-all relative group"
                  :class="selectedColor?.name === color.name ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/30'"
                  :title="color.name"
                >
                  <div class="relative w-6 h-6 rounded-full shadow-inner flex-shrink-0" :style="{ backgroundColor: color.value }">
                    <Check v-if="selectedColor?.name === color.name" class="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow-md" />
                  </div>
                  <span class="text-xs font-semibold pr-0.5" :class="selectedColor?.name === color.name ? 'text-primary' : 'text-muted-foreground'">{{ color.name }}</span>
                </button>
                <button
                  v-if="hasHiddenColors"
                  @click="colorExpanded = !colorExpanded"
                  class="flex items-center gap-1 rounded-full border-2 border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                >
                  {{ colorExpanded ? 'Collapse' : `+${productRef!.colors!.length - COLLAPSE_THRESHOLD_COLORS} more` }}
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
                <label class="inline-flex items-center gap-2 text-[11px] md:text-xs font-black tracking-[0.08em] md:tracking-widest uppercase">
                  <span class="h-3.5 w-1 rounded-full bg-primary/80"></span>
                  <span>{{ productRef.specLabel || 'Size' }}{{ selectedSize ? ` — ${selectedSize}` : '' }}</span>
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
                  @click="selectedSize = selectedSize === size ? '' : size"
                  class="min-h-[44px] md:h-12 rounded-xl px-2 text-sm leading-tight text-center font-bold transition-all border-2 flex items-center justify-center relative"
                  :class="selectedSize === size ? 'border-primary bg-primary/5 text-primary shadow-sm shadow-primary/10' : 'border-border hover:border-foreground'"
                >
                  <Check v-if="selectedSize === size" class="absolute top-1 right-1 w-3 h-3 text-primary" />
                  {{ size }}
                </button>
                <button
                  v-if="hasHiddenSpecs"
                  @click="specExpanded = !specExpanded"
                  class="min-h-[44px] md:h-12 rounded-xl px-2 text-sm leading-tight text-center font-semibold border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                >
                  {{ specExpanded ? 'Collapse' : `+${productRef!.sizes!.length - COLLAPSE_THRESHOLD_SPECS} more` }}
                </button>
              </div>
            </div>

            <!-- 尺码指南弹窗（阶段 4.2） -->
            <SizeGuide
              v-if="productRef?.hasSizeGuide && productRef?.sizes?.length"
              v-model="showSizeGuide"
              :sizes="productRef.sizes"
              :selected-size="selectedSize"
              @select="(size: string) => { selectedSize = size; showSizeGuide = false }"
            />

            <!-- Quantity & CTA -->
            <div class="space-y-3 md:space-y-4 pt-2 md:pt-4">
              <div class="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4">
                <!-- Quantity Picker -->
                <div class="inline-flex w-fit self-start items-center gap-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl p-1 border border-border">
                  <button
                    @click="decrement"
                    class="w-10 h-10 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all duration-150 active:scale-95"
                    :class="qtyButtonPulse === 'minus' ? 'bg-primary/10 text-primary scale-95' : ''"
                  >
                    <Minus class="w-4 h-4" />
                  </button>
                  <span class="min-w-[2.75rem] px-1 text-center font-bold">{{ quantity }}</span>
                  <button
                    @click="increment"
                    class="w-10 h-10 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all duration-150 active:scale-95"
                    :class="qtyButtonPulse === 'plus' ? 'bg-primary/10 text-primary scale-95' : ''"
                  >
                    <Plus class="w-4 h-4" />
                  </button>
                </div>
                <!-- Add to Cart -->
                <Button
                  size="lg"
                  class="flex-1 h-12 md:h-14 rounded-2xl text-sm md:text-base font-black tracking-tight transition-all duration-300"
                  :class="addToBagSuccessPulse ? 'ring-2 ring-primary/40 shadow-[0_0_0_4px_rgba(124,58,237,0.18)]' : ''"
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
                :class="buyNowPulse ? 'border-primary/40 bg-primary/5 text-primary shadow-[0_0_0_3px_rgba(124,58,237,0.12)] scale-[0.99]' : ''"
                @click="buyNow"
              >
                BUY IT NOW
              </Button>
              <!-- Wishlist -->
              <Button
                variant="ghost"
                class="w-full h-10 rounded-xl text-sm font-semibold transition-all"
                :class="productRef && wishlistStore.isInWishlist(productRef.id) ? 'text-red-500 bg-red-50 dark:bg-red-950/20' : ''"
                @click="productRef && wishlistStore.toggleItem({ id: productRef.id, title: productRef.title, price: productRef.price, image: productRef.image ?? productRef.images?.[0] ?? '', category: productRef.category, rating: productRef.rating, reviews: productRef.reviews })"
              >
                <Heart class="w-4 h-4 mr-2" :class="{ 'fill-current': productRef && wishlistStore.isInWishlist(productRef.id) }" />
                {{ productRef && wishlistStore.isInWishlist(productRef.id) ? 'SAVED TO WISHLIST' : 'ADD TO WISHLIST' }}
              </Button>
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <span v-if="productRef?.colors?.length" class="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 font-semibold text-primary">
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
                  :class="qtyBadgePulse ? 'border-primary/40 bg-primary/10 text-primary scale-[1.03]' : ''"
                >
                  <Hash class="mr-1 h-3 w-3 opacity-70" />
                  Qty {{ quantity }}
                </span>
              </div>
              <button @click="contactSeller" class="w-full py-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2">
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
                'bg-red-500': stockStatus.type === 'danger'
              }"
            ></span>
            <span
              class="text-xs font-bold"
              :class="{
                'text-emerald-600': stockStatus.type === 'success',
                'text-amber-600': stockStatus.type === 'warning',
                'text-red-600': stockStatus.type === 'danger'
              }"
            >{{ stockStatus.text }}</span>

            <!-- Notify when back in stock -->
            <button
              v-if="stockStatus.type === 'danger' && productRef"
              @click="stockAlertStore.isSubscribed(productRef.id) ? stockAlertStore.unsubscribe(productRef.id) : stockAlertStore.subscribe({ id: productRef.id, title: productRef.title, image: productRef.image ?? productRef.images?.[0] ?? '' }, authStore.user?.email || '')"
              class="text-xs font-bold px-2.5 py-1 rounded-full border transition-colors"
              :class="stockAlertStore.isSubscribed(productRef.id) ? 'bg-primary/10 border-primary/30 text-primary' : 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400 hover:bg-amber-100'"
            >
              {{ stockAlertStore.isSubscribed(productRef.id) ? '✓ Notified on Restock' : '🔔 Notify Me' }}
            </button>
          </div>

          <!-- Trust Badges -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 p-4 md:p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl md:rounded-[2rem] border border-border/50">
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
          <div v-if="merchantLoading" class="rounded-2xl border border-border p-4 flex items-center gap-3">
            <Skeleton class="w-12 h-12 rounded-full flex-shrink-0" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4 w-28" />
              <Skeleton class="h-3 w-40" />
            </div>
          </div>
          <div v-else-if="merchantProfile" class="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div class="flex items-center gap-3">
              <router-link :to="`/store/${merchantProfile.id}`" class="flex-shrink-0">
                <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-border bg-secondary">
                  <img :src="merchantProfile.avatar" :alt="merchantProfile.storeName" class="w-full h-full object-cover" />
                </div>
              </router-link>
              <div class="flex-1 min-w-0">
                <router-link :to="`/store/${merchantProfile.id}`" class="hover:text-primary transition-colors">
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold text-sm truncate">{{ merchantProfile.storeName }}</span>
                    <ShieldCheck v-if="merchantProfile.verified" class="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  </div>
                </router-link>
                <div class="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span class="flex items-center gap-0.5"><Star class="w-3 h-3 text-amber-500 fill-amber-500" /> {{ merchantProfile.stats.rating }}</span>
                  <span>•</span>
                  <span>{{ (merchantProfile.stats.totalProducts) }} products</span>
                  <span>•</span>
                  <span class="flex items-center gap-0.5"><Clock class="w-3 h-3" /> {{ merchantProfile.responseTime }}</span>
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
              <Button variant="outline" size="sm" class="flex-1 text-xs gap-1.5 h-8" @click="contactSeller">
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
                left: `calc(0.25rem + ${activeTabIndex} * ((100% - 0.5rem) / 4))`
              }"
            />
            <button 
              v-for="(tab, idx) in tabKeys"
              :key="tab"
              @click="switchTab(tab as 'details' | 'specs' | 'reviews' | 'qa')"
              @keydown="onTabKeydown($event, idx)"
              :data-tab="tab"
              class="relative z-10 flex-1 py-3 rounded-xl text-[10px] sm:text-xs font-black tracking-[0.08em] sm:tracking-widest uppercase transition-all duration-300 ease-out transform-gpu"
              :class="activeTab === tab ? 'text-primary -translate-y-0.5' : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-zinc-800/50'"
              role="tab"
              :aria-selected="activeTab === tab"
              :aria-controls="`${tab}-section`"
              :tabindex="activeTab === tab ? 0 : -1"
            >
              {{ tab }}
            </button>
          </div>

          <!-- Tab Content Area -->
          <div class="min-h-[400px] space-y-12">
            <!-- Details -->
            <section ref="detailsSectionRef" id="details-section" class="scroll-mt-40 space-y-8">
              <div class="prose prose-zinc dark:prose-invert max-w-none">
                <h3 class="text-2xl font-black mb-6">Designed for the future.</h3>
                <p class="text-lg leading-relaxed text-muted-foreground">{{ productRef.description }}</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-12 mt-12">
                  <div class="space-y-4">
                    <div class="w-12 h-1 bg-primary rounded-full"></div>
                    <h4 class="font-bold text-xl">Premium Materials</h4>
                    <p class="text-sm text-muted-foreground leading-relaxed">Crafted with aerospace-grade materials ensuring durability without compromising on the elegant aesthetic.</p>
                  </div>
                  <div class="space-y-4">
                    <div class="w-12 h-1 bg-primary rounded-full"></div>
                    <h4 class="font-bold text-xl">Intuitive Design</h4>
                    <p class="text-sm text-muted-foreground leading-relaxed">Every curve and button is meticulously placed for the most natural user experience possible.</p>
                  </div>
                </div>
              </div>
            </section>

            <!-- Specs -->
            <section ref="specsSectionRef" id="specs-section" class="scroll-mt-40 space-y-1">
              <div v-for="(val, key) in { 'Brand': 'Nexus', 'Category': productRef.category, 'Model': '2024 Gen 2', 'Warranty': '2 Years', 'Origin': 'Imported', 'In Box': 'Device, Cable, Manual' }" :key="key" 
                class="flex justify-between py-5 border-b border-border group hover:bg-zinc-50 dark:hover:bg-zinc-900/50 px-4 transition-colors rounded-lg">
                <span class="text-sm font-bold tracking-widest uppercase text-muted-foreground">{{ key }}</span>
                <span class="text-sm font-black">{{ val }}</span>
              </div>
            </section>

            <!-- Reviews -->
            <section ref="reviewsSectionRef" id="reviews-section" class="scroll-mt-40 space-y-10">
              <!-- Review Summary Header -->
              <div class="flex flex-col md:flex-row gap-6 md:gap-10 p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-border/50">
                <!-- Average Score -->
                <div class="flex flex-col items-center justify-center gap-1 min-w-[120px]">
                  <span class="text-5xl font-black text-primary">{{ reviewAvg.toFixed(1) }}</span>
                  <div class="flex text-amber-400 gap-0.5">
                    <Star v-for="i in 5" :key="i" class="w-4 h-4" :class="i <= Math.round(reviewAvg) ? 'fill-current' : 'opacity-20'" />
                  </div>
                  <span class="text-xs text-muted-foreground mt-1">{{ mergedReviews.length }} reviews</span>
                </div>
                <!-- Rating Distribution -->
                <div class="flex-1 space-y-1.5">
                  <div v-for="item in ratingDistribution" :key="item.star" class="flex items-center gap-2">
                    <span class="text-xs font-bold w-4 text-right text-muted-foreground">{{ item.star }}</span>
                    <Star class="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                    <div class="flex-1 h-2.5 bg-border/50 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-amber-400 rounded-full transition-all duration-500"
                        :style="{ width: `${item.percentage}%` }"
                      ></div>
                    </div>
                    <span class="text-xs text-muted-foreground w-6 text-right">{{ item.count }}</span>
                  </div>
                </div>
                <!-- Write Review CTA -->
                <div class="flex flex-col items-center justify-center gap-2">
                  <Button variant="outline" class="rounded-full px-6 font-bold" @click="reviewFormOpen = !reviewFormOpen">
                    {{ reviewFormOpen ? 'CLOSE' : 'WRITE A REVIEW' }}
                  </Button>
                  <span class="text-[10px] text-muted-foreground">Share your experience</span>
                </div>
              </div>

              <div class="flex flex-wrap gap-2">
                <Button v-for="star in ['all','5','4','3','2','1']" :key="star" size="sm" variant="outline" class="rounded-full" :class="reviewFilter===star ? 'bg-primary text-primary-foreground' : ''" @click="reviewFilter=star">
                  {{ star === 'all' ? 'All' : `${star}★` }}
                </Button>
                <Button size="sm" variant="outline" class="rounded-full" :class="onlyWithImages ? 'bg-primary text-primary-foreground' : ''" @click="onlyWithImages = !onlyWithImages">
                  With Images
                </Button>
                <Button size="sm" variant="outline" class="rounded-full" @click="resetReviewFilters">Reset</Button>
                <div class="min-w-[220px] flex-1 sm:flex-none">
                  <input
                    v-model="reviewSearch"
                    type="text"
                    placeholder="Search reviews..."
                    class="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div class="ml-auto">
                  <select v-model="reviewSort" class="h-9 rounded-xl border border-border bg-background px-3 text-sm">
                    <option value="latest">Latest</option>
                    <option value="top">Top Rating</option>
                    <option value="most-helpful">Most Helpful</option>
                  </select>
                </div>
              </div>

              <!-- Write Review Form -->
              <div v-if="reviewFormOpen" class="rounded-2xl border border-border bg-card p-5 space-y-4">
                <div class="flex items-center gap-3 pb-2 border-b border-border">
                  <template v-if="authStore.isAuthenticated && authStore.user">
                    <img v-if="authStore.user.avatar" :src="authStore.user.avatar" class="w-9 h-9 rounded-full object-cover" />
                    <div v-else class="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                      {{ getInitials(authStore.user.name) }}
                    </div>
                    <div>
                      <p class="text-sm font-bold">{{ authStore.user.name }}</p>
                      <p class="text-[10px] text-muted-foreground">Posting as yourself</p>
                    </div>
                  </template>
                  <template v-else>
                    <div class="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs text-muted-foreground">?</div>
                    <p class="text-sm text-muted-foreground">Sign in to post a review</p>
                  </template>
                  <div class="ml-auto flex items-center gap-1.5">
                    <button
                      v-for="n in 5"
                      :key="n"
                      type="button"
                      class="text-amber-400 hover:scale-110 transition-transform"
                      @click="reviewRating = n"
                    >
                      <Star class="w-5 h-5" :class="n <= reviewRating ? 'fill-current' : 'opacity-25'" />
                    </button>
                  </div>
                </div>
                <textarea
                  v-model="reviewContent"
                  rows="3"
                  placeholder="Share your experience with this product..."
                  class="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary resize-none"
                ></textarea>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <label class="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                      <input type="file" accept="image/*" multiple @change="handleReviewImageUpload" class="hidden" />
                      <Package class="w-4 h-4" />
                      Add Photos
                    </label>
                    <span class="text-[10px] text-muted-foreground">{{ reviewCharCount }}/{{ reviewMaxChars }}</span>
                  </div>
                  <Button size="sm" :disabled="reviewSubmitting || !reviewContent.trim()" @click="submitReview">
                    {{ reviewSubmitting ? 'Posting...' : 'Post Review' }}
                  </Button>
                </div>
                <div v-if="reviewImages.length" class="flex gap-2 flex-wrap">
                  <div v-for="(img, idx) in reviewImages" :key="idx" class="relative">
                    <img :src="img" class="w-14 h-14 rounded-lg object-cover border border-border cursor-zoom-in" @click="openImagePreview(img)" />
                    <button
                      type="button"
                      class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center"
                      @click="removeReviewImage(idx)"
                    >
                      <X class="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Empty state -->
              <div v-if="filteredReviews.length === 0" class="py-12 text-center text-muted-foreground">
                <p class="text-sm">No reviews match your filters.</p>
                <button @click="resetReviewFilters" class="text-xs text-primary hover:underline mt-1">Clear filters</button>
              </div>

              <!-- Review Cards -->
              <div class="space-y-4">
                <div v-for="review in visibleReviews" :key="review.id" class="rounded-xl border border-border bg-card overflow-hidden">
                  <div class="p-4 sm:p-5">
                    <!-- Review Header -->
                    <div class="flex items-start justify-between gap-3 mb-3">
                      <div class="flex items-center gap-2.5">
                        <img v-if="review.avatar" :src="review.avatar" class="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        <div v-else class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {{ getInitials(review.user) }}
                        </div>
                        <div>
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-sm font-bold">{{ review.user }}</span>
                            <span v-if="review.verified" class="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <BadgeCheck class="w-3 h-3" />Verified Purchase
                            </span>
                            <span class="text-[10px] text-muted-foreground">{{ formatRelativeDate(review.date) }}</span>
                          </div>
                          <div class="flex text-amber-400 gap-0.5 mt-0.5">
                            <Star v-for="i in 5" :key="i" class="w-3 h-3" :class="i <= review.rating ? 'fill-current' : 'opacity-20'" />
                          </div>
                        </div>
                      </div>
                      <button
                        v-if="isOwnReview(review)"
                        type="button"
                        class="text-muted-foreground hover:text-destructive transition-colors p-1"
                        title="Delete your review"
                        @click="deleteReview(review.id)"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <!-- Review Content -->
                    <p class="text-sm text-foreground/80 leading-relaxed mb-3">{{ review.content }}</p>
                    <!-- Review Images -->
                    <div v-if="review.images?.length" class="flex gap-2 flex-wrap mb-3">
                      <img
                        v-for="(img, idx) in review.images"
                        :key="idx"
                        :src="img"
                        class="w-16 h-16 rounded-lg object-cover border border-border cursor-zoom-in hover:opacity-80 transition-opacity"
                        @click="openImagePreview(img)"
                      />
                    </div>
                    <!-- Actions -->
                    <div class="flex items-center gap-4">
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        :class="isReviewVoted(review.id) ? 'text-primary' : ''"
                        @click="toggleHelpful(review.id)"
                      >
                        <ThumbsUp class="w-3.5 h-3.5" :class="isReviewVoted(review.id) ? 'fill-current' : ''" />
                        {{ review.helpful ?? 0 }}
                      </button>
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        @click="openReply(review.id)"
                      >
                        <Reply class="w-3.5 h-3.5" />
                        Reply{{ review.replies?.length ? ` (${review.replies.length})` : '' }}
                      </button>
                    </div>
                  </div>

                  <!-- Replies -->
                  <div v-if="review.replies?.length" class="border-t border-border bg-secondary/20">
                    <div v-for="reply in review.replies" :key="reply.id" class="px-4 sm:px-5 py-3 flex gap-2.5 border-b border-border/50 last:border-0">
                      <CornerDownRight class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-0.5">
                          <img v-if="reply.avatar" :src="reply.avatar" class="w-5 h-5 rounded-full object-cover" />
                          <div v-else class="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold">
                            {{ getInitials(reply.user) }}
                          </div>
                          <span class="text-xs font-bold">{{ reply.user }}</span>
                          <span class="text-[10px] text-muted-foreground">{{ formatRelativeDate(reply.date) }}</span>
                        </div>
                        <p class="text-xs text-foreground/70 leading-relaxed">{{ reply.content }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Reply Input -->
                  <div v-if="replyingToId === review.id" class="border-t border-border px-4 sm:px-5 py-3 flex gap-2 items-start bg-secondary/10">
                    <div class="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold flex-shrink-0 mt-0.5">
                      {{ authStore.user ? getInitials(authStore.user.name) : '?' }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <textarea
                        v-model="replyContent"
                        rows="2"
                        placeholder="Write a reply..."
                        class="w-full rounded-lg border border-border bg-background p-2 text-xs outline-none focus:border-primary resize-none"
                      ></textarea>
                      <div class="flex justify-end gap-2 mt-1.5">
                        <Button variant="ghost" size="sm" class="h-7 text-xs px-3" @click="replyingToId = null">Cancel</Button>
                        <Button size="sm" class="h-7 text-xs px-3" :disabled="replySubmitting || !replyContent.trim()" @click="submitReply(review.id)">
                          {{ replySubmitting ? 'Posting...' : 'Reply' }}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                v-if="hasMoreReviews"
                variant="outline"
                class="w-full h-12 rounded-2xl font-black tracking-wide"
                @click="loadMoreReviews"
              >
                Load More Reviews ({{ filteredReviews.length - visibleReviews.length }})
              </Button>
            </section>

            <!-- Q&A -->
            <section ref="qaSectionRef" id="qa-section" class="scroll-mt-40 space-y-10">
              <div>
                <h3 class="text-2xl font-black mb-2">Questions & Answers</h3>
                <p class="text-muted-foreground text-sm">Ask the seller or other buyers about this product.</p>
              </div>
              <ProductQA v-if="productRef" :product-id="productRef.id" :product-title="productRef.title" />
            </section>
          </div>
        </div>
      </div>

      <!-- ══════════ 商品推荐（阶段 1.1）══════════ -->
      <div v-if="productRef" class="mt-16 border-t border-border pt-10">
        <div class="container px-4 mx-auto">
          <!-- Frequently Bought Together -->
          <section v-if="!recLoading && boughtTogether.length > 0" class="mb-12">
            <h2 class="text-xl sm:text-2xl font-black mb-6 flex items-center gap-2">
              <ShoppingBag class="w-5 h-5 text-primary" />
              Frequently Bought Together
            </h2>
            <div class="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div class="flex flex-wrap items-center gap-3 sm:gap-4">
                <!-- 主商品 -->
                <div class="w-28 sm:w-32">
                  <div class="aspect-square rounded-xl overflow-hidden border border-border bg-secondary/30">
                    <img :src="productRef.image ?? productRef.images?.[0]" :alt="productRef.title" class="w-full h-full object-cover" loading="lazy" @error="(e) => (e.target as HTMLImageElement).src = imageFallback" />
                  </div>
                  <p class="text-[11px] font-semibold line-clamp-1 mt-1.5 text-center">{{ productRef.title }}</p>
                  <p class="text-xs font-bold text-primary text-center mt-0.5">${{ formatPrice(productRef.price) }}</p>
                </div>

                <template v-for="(p, i) in boughtTogether" :key="p.id">
                  <Plus class="w-5 h-5 text-muted-foreground shrink-0" v-if="i > 0 || boughtTogether.length > 1" />
                  <div class="w-28 sm:w-32 cursor-pointer select-none" @click="toggleBoughtTogether(p.id)">
                    <div class="relative aspect-square rounded-xl overflow-hidden border bg-secondary/30" :class="boughtTogetherSelected.has(p.id) ? 'border-primary ring-2 ring-primary/30' : 'border-border opacity-60'">
                      <img :src="p.image" :alt="p.title" class="w-full h-full object-cover" loading="lazy" />
                      <span class="absolute top-1.5 left-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-white"
                        :class="boughtTogetherSelected.has(p.id) ? 'bg-primary border-primary' : 'bg-background/80 border-border'">
                        <Check v-if="boughtTogetherSelected.has(p.id)" class="w-3 h-3" />
                      </span>
                    </div>
                    <p class="text-[11px] font-semibold line-clamp-1 mt-1.5 text-center">{{ p.title }}</p>
                    <p class="text-xs font-bold text-primary text-center mt-0.5">${{ formatPrice(p.price) }}</p>
                  </div>
                </template>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-border/60">
                <div class="text-sm">
                  <span class="text-muted-foreground">Total for selected:</span>
                  <span class="ml-2 text-2xl font-black text-primary">${{ formatPrice(boughtTogetherTotal) }}</span>
                </div>
                <Button size="sm" class="rounded-full px-6 h-10" @click="addBoughtTogetherToCart">
                  <ShoppingBag class="w-4 h-4 mr-1.5" />
                  Add Bundle to Cart
                </Button>
              </div>
            </div>
          </section>

          <!-- You May Also Like -->
          <section v-if="!recLoading && relatedProducts.length > 0" class="mb-4">
            <h2 class="text-xl sm:text-2xl font-black mb-6 flex items-center gap-2">
              <Zap class="w-5 h-5 text-primary" />
              You May Also Like
            </h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
              <ProductCard v-for="p in relatedProducts" :key="p.id" :product="p" class="h-full" />
            </div>
          </section>
        </div>
      </div>

    </div>

    <!-- Mobile Sticky Purchase Bar -->
      <div
      v-if="productRef"
      class="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div class="px-3 sm:px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.6rem)]">
        <div class="flex items-end justify-between gap-3 mb-2">
          <div class="min-w-0 flex-1">
            <div class="text-[11px] leading-4 text-muted-foreground truncate">
              <template v-if="productRef?.colors?.length">{{ selectedColor?.name }} · </template><template v-if="productRef?.sizes?.length">{{ selectedSize }} · </template>Qty {{ quantity }}
            </div>
            <div class="text-[31px] sm:text-[33px] font-black text-primary leading-none mt-0.5">${{ formatPrice(productRef?.price) }}</div>
          </div>
          <button
            @click="contactSeller"
            class="h-9 mb-0.5 shrink-0 px-3 rounded-lg border border-primary/20 bg-primary/5 text-xs font-bold text-primary hover:bg-primary/10 transition-colors flex items-center gap-1.5"
          >
            <MessageSquare class="w-3.5 h-3.5" />
            Chat
          </button>
          <button
            v-if="productRef"
            @click="wishlistStore.toggleItem({ id: productRef.id, title: productRef.title, price: productRef.price, image: productRef.image ?? productRef.images?.[0] ?? '', category: productRef.category, rating: productRef.rating, reviews: productRef.reviews })"
            class="h-9 mb-0.5 shrink-0 w-9 rounded-lg border flex items-center justify-center transition-colors"
            :class="wishlistStore.isInWishlist(productRef.id) ? 'border-red-200 bg-red-50 dark:bg-red-950/20 text-red-500' : 'border-border bg-card text-muted-foreground'"
          >
            <Heart class="w-4 h-4" :class="{ 'fill-current': wishlistStore.isInWishlist(productRef.id) }" />
          </button>
        </div>
        <div class="mobile-buy-actions grid grid-cols-2 gap-2">
          <Button size="sm" class="h-11 rounded-xl text-sm font-black" @click="addToCart">
            Add to Bag
          </Button>
          <Button size="sm" variant="outline" class="h-11 rounded-xl text-sm font-black border-2" @click="buyNow">
            Buy Now
          </Button>
        </div>
      </div>
    </div>

    <!-- Zoom Preview Panel (teleported to body for correct stacking) -->
    <Teleport to="body">
      <div
        v-if="zoomActive"
        class="hidden lg:block fixed rounded-2xl border border-border bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden pointer-events-none"
        :style="{
          width: `${ZOOM_PANEL_SIZE}px`,
          height: `${ZOOM_PANEL_SIZE}px`,
          left: `${zoomPanelLeft}px`,
          top: `${zoomPanelTop}px`,
          zIndex: 9999,
          backgroundImage: `url(${resolvedMainImage})`,
          backgroundSize: `${ZOOM_SCALE * 100}%`,
          backgroundPosition: zoomBgPos,
          backgroundRepeat: 'no-repeat'
        }"
      />
    </Teleport>

    <!-- Review image lightbox -->
    <div
      v-if="previewImageUrl"
      class="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      @click="closeImagePreview"
    >
      <img
        :src="previewImageUrl"
        class="max-w-[92vw] max-h-[88vh] rounded-xl shadow-2xl object-contain"
        @click.stop
      />
      <button
        class="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
        @click="closeImagePreview"
      >
        <X class="w-5 h-5" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}


@media (max-width: 390px) {
  .product-detail-page .product-title {
    font-size: 1.65rem;
    line-height: 1.15;
  }

  .product-detail-page .product-price-row {
    gap: 0.35rem;
  }

  .product-detail-page .product-hero-card {
    border-radius: 1.1rem;
  }

  .product-detail-page .mobile-buy-actions {
    grid-template-columns: 1fr;
  }
}
</style>
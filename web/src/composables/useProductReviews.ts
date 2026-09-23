import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import {
  getSeedReviews,
  loadReviewStore,
  saveReviewItems,
  saveHelpfulMeta,
  type ReviewItem,
  type ReviewReply,
} from '@/api/modules/reviews'

export interface UseProductReviewsOptions {
  productId: number
  /**
   * 提交成功后由调用方接手「切到评价 tab + 滚到评价区」。
   *
   * 为什么做成回调而不是在这里直接做：那两件事一件是**页面的**状态（activeTab）、
   * 一件是**视图的** DOM 操作，都不属于逻辑层（规范 §16：composable 负责逻辑，
   * 不承担 UI）。调用方 await 它 —— 里面要等 nextTick 才能滚。
   */
  onSubmitted?: () => void | Promise<void>
}

/**
 * 商品评价：筛选 / 排序 / 搜索 / 分页 / 投票 / 提交 / 回复 / 删除。
 *
 * 数据只有两个来源，都在 `api/modules/reviews.ts`：内置种子评价，与按商品 id 分键的
 * localStorage。**种子与用户数据分开存** —— 用户对种子评价只能产生两种改动（投 helpful、
 * 追加回复），两种都通过「把种子克隆进用户区再改」表达，种子本身永不被写。
 */
export function useProductReviews(options: UseProductReviewsOptions) {
  const { productId, onSubmitted } = options
  const { toast } = useToast()
  const authStore = useAuthStore()
  const router = useRouter()
  const route = useRoute()

  // ── 持久化状态 ──
  /** 用户新增或被改过的评价 */
  const storedReviews = ref<ReviewItem[]>([])
  /** 种子评价的 helpful 增量（种子不可变，只能记差值） */
  const helpfulDelta = ref<Record<number, number>>({})
  /** 已投过 helpful 的评价 id */
  const votedReviewIds = ref<number[]>([])

  // ── 筛选 / 排序 / 分页 ──
  const reviewFilter = ref<string>('all')
  const reviewSort = ref<'latest' | 'top' | 'most-helpful'>('latest')
  const reviewSearch = ref('')
  const onlyWithImages = ref(false)
  const reviewPage = ref(1)
  const reviewPageSize = 6

  // ── 表单 ──
  const reviewFormOpen = ref(false)
  const reviewSubmitting = ref(false)
  const reviewRating = ref(5)
  const reviewContent = ref('')
  const reviewImages = ref<string[]>([])
  const reviewMaxChars = 500

  // ── 回复 ──
  const replyingToId = ref<number | null>(null)
  const replyContent = ref('')
  const replySubmitting = ref(false)

  // ── 图片预览 ──
  const previewImageUrl = ref('')

  const seedReviews = getSeedReviews()

  /**
   * 用户区里已经「顶掉」的种子 id —— 用户回复过某条种子评价时，会把种子克隆进用户区，
   * 此后渲染克隆件、跳过原件，否则同一条评价会出现两次。
   */
  const migratedSeedIds = computed(
    () => new Set(storedReviews.value.filter((r) => r.id <= 100).map((r) => r.id)),
  )

  /** 种子评价 + 各自累积的 helpful 增量 */
  const hydratedSeedReviews = computed<ReviewItem[]>(() =>
    seedReviews
      .filter((r) => !migratedSeedIds.value.has(r.id))
      .map((review) => ({
        ...review,
        helpful: (review.helpful ?? 0) + (helpfulDelta.value[review.id] ?? 0),
      })),
  )

  const mergedReviews = computed<ReviewItem[]>(() => [
    ...storedReviews.value,
    ...hydratedSeedReviews.value,
  ])

  const filteredReviews = computed<ReviewItem[]>(() => {
    let list = [...mergedReviews.value]
    if (reviewFilter.value !== 'all') {
      const rating = Number(reviewFilter.value)
      list = list.filter((r) => r.rating === rating)
    }
    if (onlyWithImages.value) {
      list = list.filter((r) => (r.images?.length ?? 0) > 0)
    }
    const keyword = reviewSearch.value.trim().toLowerCase()
    if (keyword) {
      list = list.filter(
        (r) => r.user.toLowerCase().includes(keyword) || r.content.toLowerCase().includes(keyword),
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

  const visibleReviews = computed<ReviewItem[]>(() =>
    filteredReviews.value.slice(0, reviewPage.value * reviewPageSize),
  )

  const hasMoreReviews = computed(() => visibleReviews.value.length < filteredReviews.value.length)

  const reviewAvg = computed(() => {
    if (!mergedReviews.value.length) return 0
    const sum = mergedReviews.value.reduce((acc, item) => acc + item.rating, 0)
    return sum / mergedReviews.value.length
  })

  const reviewCharCount = computed(() => reviewContent.value.length)

  /** 五档星级分布（按最大值归一化，画横条用） */
  const ratingDistribution = computed(() => {
    const dist = [0, 0, 0, 0, 0]
    mergedReviews.value.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++
    })
    const max = Math.max(...dist, 1)
    return [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: dist[star - 1],
      percentage: Math.round((dist[star - 1] / max) * 100),
    }))
  })

  // 筛选条件一变就回到第一页 —— 否则在第 3 页改筛选会看到一片空白
  watch([reviewFilter, reviewSort, reviewSearch, onlyWithImages], () => {
    reviewPage.value = 1
  })

  // ── 工具 ──
  function getInitials(name: string) {
    return name
      .split(' ')
      .map((p) => p.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }

  function formatRelativeDate(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diff / 86400000)
    if (days < 0) return dateStr
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`
    if (days < 365)
      return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  function isOwnReview(review: ReviewItem): boolean {
    return !!authStore.user && review.user === authStore.user.name
  }

  function isReviewVoted(reviewId: number) {
    return votedReviewIds.value.includes(reviewId)
  }

  function getCurrentUserInfo() {
    const u = authStore.user
    if (u) return { name: u.name, avatar: u.avatar || '' }
    return { name: 'Anonymous User', avatar: '' }
  }

  /** 未登录时提示并跳登录页（带 redirect 回本页），返回 false 表示调用方应中止 */
  function requireLogin(action: string): boolean {
    if (authStore.isAuthenticated) return true
    toast({
      title: 'Please sign in',
      description: `You need to log in to ${action}.`,
      variant: 'destructive',
    })
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return false
  }

  // ── 持久化 ──
  function loadPersistedReviews() {
    const store = loadReviewStore(productId)
    storedReviews.value = store.items
    helpfulDelta.value = store.helpfulDelta
    votedReviewIds.value = store.voted
  }

  function persistReviews() {
    saveReviewItems(productId, storedReviews.value)
  }

  function persistHelpfulMeta() {
    saveHelpfulMeta(productId, helpfulDelta.value, votedReviewIds.value)
  }

  // ── 动作 ──
  function toggleHelpful(reviewId: number) {
    if (isReviewVoted(reviewId)) {
      toast({ title: 'Already marked helpful', description: 'You can vote once per review.' })
      return
    }

    const persistedIdx = storedReviews.value.findIndex((r) => r.id === reviewId)
    if (persistedIdx >= 0) {
      storedReviews.value[persistedIdx].helpful =
        (storedReviews.value[persistedIdx].helpful ?? 0) + 1
      persistReviews()
    } else {
      helpfulDelta.value[reviewId] = (helpfulDelta.value[reviewId] ?? 0) + 1
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

  async function submitReview() {
    if (!requireLogin('write a review')) return
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
        replies: [],
      }
      storedReviews.value.unshift(item)
      persistReviews()
      reviewContent.value = ''
      reviewRating.value = 5
      reviewImages.value = []
      reviewFormOpen.value = false
      reviewPage.value = 1
      toast({
        title: 'Review submitted',
        description: 'Thanks for your feedback!',
        variant: 'success',
      })
      await onSubmitted?.()
    } finally {
      reviewSubmitting.value = false
    }
  }

  function openReply(reviewId: number) {
    if (!requireLogin('reply')) return
    replyingToId.value = replyingToId.value === reviewId ? null : reviewId
    replyContent.value = ''
  }

  function deleteReview(reviewId: number) {
    const idx = storedReviews.value.findIndex((r) => r.id === reviewId)
    if (idx >= 0) {
      storedReviews.value.splice(idx, 1)
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
        content,
      }
      // 回复种子评价：把种子克隆进用户区再追加，种子本身不动
      let target = storedReviews.value.find((r) => r.id === reviewId)
      if (!target) {
        const seed = seedReviews.find((r) => r.id === reviewId)
        if (seed) {
          const clone: ReviewItem = { ...seed, replies: [...(seed.replies ?? [])] }
          storedReviews.value.push(clone)
          target = clone
        }
      }
      if (target) {
        if (!target.replies) target.replies = []
        target.replies.push(reply)
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
    if (hasMoreReviews.value) reviewPage.value += 1
  }

  function resetReviewFilters() {
    reviewFilter.value = 'all'
    reviewSort.value = 'latest'
    reviewSearch.value = ''
    onlyWithImages.value = false
    reviewPage.value = 1
  }

  return {
    // 持久化状态
    storedReviews,
    // 筛选 / 排序 / 分页
    reviewFilter,
    reviewSort,
    reviewSearch,
    onlyWithImages,
    reviewPage,
    reviewMaxChars,
    // 表单
    reviewFormOpen,
    reviewSubmitting,
    reviewRating,
    reviewContent,
    reviewImages,
    // 回复
    replyingToId,
    replyContent,
    replySubmitting,
    // 预览
    previewImageUrl,
    // 派生
    mergedReviews,
    filteredReviews,
    visibleReviews,
    hasMoreReviews,
    reviewAvg,
    reviewCharCount,
    ratingDistribution,
    // 工具
    getInitials,
    formatRelativeDate,
    isOwnReview,
    isReviewVoted,
    // 生命周期 + 动作
    loadPersistedReviews,
    toggleHelpful,
    handleReviewImageUpload,
    removeReviewImage,
    openImagePreview,
    closeImagePreview,
    submitReview,
    openReply,
    deleteReview,
    submitReply,
    loadMoreReviews,
    resetReviewFilters,
  }
}

/**
 * 商品评价的数据源。
 *
 * 评价**没有后端** —— 这个模块就是它唯一的数据来源：一份内置种子评价，加上按商品 id
 * 分键的 localStorage。把它从 `ProductDetail.vue` 里独立出来，原因有两条：
 *   1. 规范 §11：页面不该同时扮演数据源与视图；
 *   2. 原先 107 行种子数据内联在一个 2686 行的页面中部，从外面完全看不出它在哪。
 *
 * 调用方只看到函数，看不到 localStorage —— 与 `address.ts` / `cart.ts` 等模块同一形状。
 *
 * ⚠️ 已知张力：阶段 8 的靶子之一是「`api/modules/*` 自己写 localStorage（传输层替 store
 * 干持久化）」，本模块属于同一类。这里**刻意保持与其它模块一致的形状**，好让阶段 8
 * 一次性统一处理，而不是现在单独发明一套 —— 那只会让阶段 8 多一种特例要认。
 */

export interface ReviewReply {
  id: number
  user: string
  avatar: string
  date: string
  content: string
}

export interface ReviewItem {
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

/**
 * 内置种子评价。
 *
 * id 全部 ≤ 100 —— 用户新写的评价用 `Date.now()`，恒大于 100。这个分界是后面
 * 「哪些是种子、哪些是用户加的」判定的依据，改种子时**不要动 id 区间**。
 */
const SEED_REVIEWS: ReviewItem[] = [
  {
    id: 1,
    user: 'Alex Chen',
    rating: 5,
    date: '2026-03-25',
    verified: true,
    content:
      'Absolutely amazing quality. The build is solid and it feels premium in hand. Exceeded all my expectations.',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100',
    helpful: 12,
    replies: [
      {
        id: 101,
        user: 'Store Support',
        avatar: '',
        date: '2026-03-26',
        content: "Thank you for your kind words! We're glad you love it.",
      },
    ],
  },
  {
    id: 2,
    user: 'Sarah Miller',
    rating: 4,
    date: '2026-03-20',
    verified: true,
    content:
      'Great product overall, though shipping took a day longer than expected. The quality itself is top-notch.',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100',
    helpful: 8,
  },
  {
    id: 3,
    user: 'Jordan Wang',
    rating: 5,
    date: '2026-03-15',
    verified: true,
    content:
      'Best purchase this year. Highly recommend to anyone looking for quality gear. Worth every penny.',
    avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=100',
    helpful: 15,
  },
  {
    id: 4,
    user: 'Emily Zhang',
    rating: 3,
    date: '2026-03-10',
    content:
      'Decent product for the price. Nothing spectacular but gets the job done. Packaging could be better.',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=100',
    helpful: 4,
  },
  {
    id: 5,
    user: 'Michael Brown',
    rating: 5,
    date: '2026-02-28',
    verified: true,
    content:
      "Incredible value! I've tried many similar products and this one stands out. The attention to detail is superb.",
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100',
    helpful: 20,
    images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=200'],
  },
  {
    id: 6,
    user: 'Lisa Park',
    rating: 2,
    date: '2026-02-15',
    content:
      'Not what I expected from the photos. The color was slightly off and it arrived with a minor scratch. Returning it.',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=100',
    helpful: 6,
  },
  {
    id: 7,
    user: 'David Kim',
    rating: 4,
    date: '2026-02-01',
    verified: true,
    content:
      'Solid build quality and looks great on my desk. Took one star off because the manual was hard to follow.',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=100',
    helpful: 3,
  },
  {
    id: 8,
    user: 'Rachel Torres',
    rating: 1,
    date: '2026-01-20',
    content:
      'Stopped working after two weeks. Very disappointing. Customer service was slow to respond.',
    avatar: '',
    helpful: 9,
    replies: [
      {
        id: 102,
        user: 'Store Support',
        avatar: '',
        date: '2026-01-22',
        content: "We're sorry about your experience. Please contact us directly for a replacement.",
      },
    ],
  },
]

/**
 * 返回种子评价的**深副本**。
 *
 * 必须复制：调用方会把种子的回复 push 进去（当用户回复一条种子评价时，代码会把种子
 * 克隆进用户区再改）。直接给引用的话，改动会跨商品、跨会话泄漏。
 */
export function getSeedReviews(): ReviewItem[] {
  return SEED_REVIEWS.map((r) => ({
    ...r,
    images: r.images ? [...r.images] : undefined,
    replies: r.replies ? r.replies.map((x) => ({ ...x })) : undefined,
  }))
}

export interface ReviewStore {
  /** 用户新增或被改过的评价 */
  items: ReviewItem[]
  /** 对种子评价的 helpful 增量 —— 种子不可变，所以只能记差值 */
  helpfulDelta: Record<number, number>
  /** 已投过 helpful 的评价 id（同一评价只能投一次） */
  voted: number[]
}

const reviewsKey = (productId: number) => `product_reviews_${productId}`
const helpfulDeltaKey = (productId: number) => `product_review_helpful_delta_${productId}`
const votedKey = (productId: number) => `product_review_helpful_voted_${productId}`

/**
 * 读三个键。每个键各自 try/catch：localStorage 里被手改坏的数据只该废掉它自己那部分，
 * 不该让整个评价区读不出来。
 */
export function loadReviewStore(productId: number): ReviewStore {
  return {
    items: readJson<ReviewItem[]>(reviewsKey(productId), []),
    helpfulDelta: readJson<Record<number, number>>(helpfulDeltaKey(productId), {}),
    voted: readJson<number[]>(votedKey(productId), []),
  }
}

export function saveReviewItems(productId: number, items: ReviewItem[]): void {
  writeJson(reviewsKey(productId), items)
}

export function saveHelpfulMeta(
  productId: number,
  helpfulDelta: Record<number, number>,
  voted: number[],
): void {
  writeJson(helpfulDeltaKey(productId), helpfulDelta)
  writeJson(votedKey(productId), voted)
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    // 坏数据（被手改过 / 版本不兼容）→ 当作没有，而不是让调用方炸
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 配额满或隐私模式禁止写入。写不进去只该丢持久化，不该让提交评价失败
  }
}

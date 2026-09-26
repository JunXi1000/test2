import { USE_MOCK } from '@/config/env'
import { post } from '@/api/http'
import { computeCouponDiscount, findRedeemableCoupon } from '@/api/modules/coupons'
import type { CartItem } from '@/stores/cart'

export interface OrderSummary {
  subtotal: number
  shipping: number
  tax: number
  /** 满减自动折扣 + 手动优惠码之和 */
  discount: number
  total: number
}

// ── 满减规则引擎（阶段 3.2） ──────────────────────────────────────────
export interface DiscountTier {
  threshold: number // 消费门槛（subtotal）
  discount: number // 减免金额
  label: string // 展示文案
}

export const DISCOUNT_TIERS: readonly DiscountTier[] = [
  { threshold: 100, discount: 10, label: 'Spend $100, save $10' },
  { threshold: 200, discount: 30, label: 'Spend $200, save $30' },
  { threshold: 300, discount: 60, label: 'Spend $300, save $60' },
]

/** 最优满减档：subtotal 达到门槛即享受对应减免（取减免额最大的档） */
export function getTieredDiscount(subtotal: number): { discount: number; tier?: DiscountTier } {
  const best = DISCOUNT_TIERS.filter((t) => subtotal >= t.threshold).reduce<
    DiscountTier | undefined
  >((acc, t) => (!acc || t.discount > acc.discount ? t : acc), undefined)
  return best ? { discount: best.discount, tier: best } : { discount: 0, tier: undefined }
}

/** 下一个满减档（用于进度条提示："再买 $X 可减 $Y"），已满最高档返回 null */
export function getNextTier(subtotal: number): { remaining: number; tier: DiscountTier } | null {
  const next = DISCOUNT_TIERS.filter((t) => subtotal < t.threshold).sort(
    (a, b) => a.threshold - b.threshold,
  )[0]
  return next ? { remaining: +(next.threshold - subtotal).toFixed(2), tier: next } : null
}

export async function calculateOrderSummary(
  items: CartItem[],
  zip?: string,
): Promise<OrderSummary> {
  if (USE_MOCK) {
    const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0)
    const shipping = subtotal > 200 ? 0 : 12
    const tax = +(subtotal * 0.08).toFixed(2)
    // 自动匹配最优满减（阶段 3.2）
    const { discount } = getTieredDiscount(subtotal)
    const total = +(subtotal + shipping + tax - discount).toFixed(2)
    return Promise.resolve({ subtotal, shipping, tax, discount, total })
  }
  return post<OrderSummary>('/checkout/summary', { items, zip })
}

export async function applyPromoCode(
  code: string,
  currentSubtotal: number,
): Promise<{ discount: number }> {
  if (USE_MOCK) {
    // 规则从券码的唯一来源取（api/modules/coupons.ts）—— 原先这里手写了一张只认
    // SAVE10 / VIP15 的比率表，而券包与积分商城能领到 10 个码，于是 9 个领了用不了。
    const rule = findRedeemableCoupon(code)
    const discount = rule ? computeCouponDiscount(rule, currentSubtotal) : 0
    return Promise.resolve({ discount })
  }
  return post<{ discount: number }>('/checkout/promo', { code, subtotal: currentSubtotal })
}

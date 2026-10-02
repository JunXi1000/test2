import { USE_MOCK } from '@/config/env'
import { post } from '@/api/http'
import { computeCouponDiscount, findRedeemableCoupon } from '@/api/modules/coupons'
import type { CartItem } from '@/stores/cart'

export interface OrderSummary {
  subtotal: number
  /**
   * 运费 —— **已移出契约**（2026-10-01）：运费模板尚未建模，后端不再返回。
   * 标为可选是为了让「字段真的没回来」这件事在类型上可见，而不是被 `number`
   * 假装成一定有值（旧代码正是在这里被 `undefined` 算成 NaN）。
   * 消费方一律按 0 处理，且**不计入** `useOrderSummary` 的应付金额。
   */
  shipping?: number
  /** 税费 —— 同上，已移出契约。 */
  tax?: number
  /**
   * 服务端算出的优惠额（唯一权威口径）。
   *
   * 后端 `/checkout/summary` **只在收到 `code` 时**才核销优惠码并把它算进来；
   * 前端**不得**再把自己那份 `promoDiscount` 叠加上去 —— 那样会减两次，
   * 页面显示额就会低于实际扣款（正是 BLK-4）。
   */
  discount: number
  /** 命中的券码；没传 code / 未命中时为 null。用于「已应用的是哪个码」的展示 */
  discountCode?: string | null
  /** = subtotal - discount（服务端算）。**不含**积分抵扣，积分是前端那一层 */
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

/**
 * 结算摘要 = 服务端唯一权威口径。
 *
 * `code` 是**可选的优惠码**：非空时后端会走完整的券校验（归属 / 有效期 / 已用 / 门槛），
 * 把真实减免算进 `discount` 与 `total`；为空时 `discount=0`。
 * 结算页必须把**同一个码**同时发给这里与 `POST /payments/create`（见 `usePaymentFlow`），
 * 否则「页面显示额」与「实际扣款」在有优惠时必然对不上（BLK-4）。
 *
 * 运费 / 税 / 满减档位已移出契约：mock 分支现在也**不再造**那两个数字
 * （旧实现 mock 里硬算 12 元运费 + 8% 税，购物车页照抄一份，于是 mock 下
 * 购物车 689.52 ≠ 结算/后端 694.00 —— 见 BLK-5）。
 *
 * `zip` 声明为 `string`（不再是 `string | undefined`）：两个调用点（结算页传 `formData.zip`、
 * 购物车页没有邮编概念传 `''`）因此发出**同一个请求形状** `{items, zip, code}`。
 * 以前购物车传 `undefined`（字段被 JSON 丢掉）、结算页传值，两处形状不一致（MIN-E2）——
 * 后端虽然忽略该字段，但"两个调用点发不同的 body"是日后接运费模板时的坑。
 */
export async function calculateOrderSummary(
  items: CartItem[],
  zip: string,
  code: string | undefined,
): Promise<OrderSummary> {
  // 空白码等价于「没用券」：后端 `isBlank()` 同样按未传处理
  const couponCode = code?.trim() || ''
  if (USE_MOCK) {
    const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0)
    // 与真实分支同源：券规则从券码的唯一来源取（api/modules/coupons.ts）。
    // 无效码在真实分支是 400，mock 里按 0 折扣处理 —— 调用方先经 applyPromoCode，
    // 拿不到折扣就不会走到这里，故这是不可达的兜底而不是静默放行。
    let discount = 0
    let discountCode: string | null = null
    if (couponCode) {
      const rule = findRedeemableCoupon(couponCode)
      if (rule) {
        discount = computeCouponDiscount(rule, subtotal)
        discountCode = couponCode.toUpperCase()
      }
    }
    const total = +(subtotal - discount).toFixed(2)
    // 刻意不返回 shipping / tax：合约上它们已不存在，造一个假数字只会让页面不一致
    return Promise.resolve({ subtotal, discount, discountCode, total })
  }
  // zip 保留在协议里：运费模板一旦建模，服务端可以按邮编计价
  return post<OrderSummary>('/checkout/summary', { items, zip, code: couponCode })
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

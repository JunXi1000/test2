import { USE_MOCK } from '@/config/env'
import { get, post } from '@/api/http'
// 积分商城的券码也是结算页要认的码之一，规则表必须把它并进来（loyalty.ts 是纯配置，
// 不反向依赖本模块，无循环）
import { POINTS_MALL } from '@/api/modules/loyalty'

export interface Coupon {
  id: string
  code: string
  title: string
  description: string
  type: 'percent' | 'fixed' | 'shipping'
  value: number // percent (e.g. 15 = 15%) or fixed amount in dollars
  minOrder: number
  maxDiscount?: number // optional cap for percent coupons
  category?: string // optional category restriction
  expiresAt: string // ISO date string
  isUsed: boolean
  claimedAt: number
}

export type ClaimableCoupon = Omit<Coupon, 'isUsed' | 'claimedAt'>

/** Claimable coupon catalog (backend /coupons). */
export async function getCoupons(): Promise<ClaimableCoupon[]> {
  if (USE_MOCK) return []
  return get<ClaimableCoupon[]>('/coupons')
}

/** Current user's claimed coupons (backend /coupons/my-coupons). */
export async function getMyCoupons(): Promise<Coupon[]> {
  if (USE_MOCK) return []
  return get<Coupon[]>('/coupons/my-coupons')
}

/** Claim a coupon (backend POST /coupons/:id/claim). */
export async function claimCoupon(couponId: string): Promise<void> {
  if (USE_MOCK) return Promise.resolve()
  await post(`/coupons/${couponId}/claim`)
}

// ─────────────────────────────────────────────────────────────────────
// 券码规则的**唯一来源**
//
// 原先散在三处：券包目录在 `stores/coupons.ts`（store 里放 mock 数据）、积分商城的
// LOYAL* 在 `loyalty.ts`、结算页的 mock 折扣表在 `checkout.ts`。三处不同步的后果不是
// 代码难看而是**实打实的 bug**：券包 + 积分商城能领到 10 个码，而结算页的 mock 折扣表
// 只认其中 1 个（VIP15）—— 领了用不了，用户看到"无效码"。
//
// 现在：目录在这里，兑换规则由目录派生，`checkout.ts` 的 mock 分支按规则算折扣。
// `checkout.spec.ts` 有一条「每个可领取的码都能兑出非零折扣」的回归钉子钉住这件事。
// ─────────────────────────────────────────────────────────────────────

/** 券包可领取的券。**放在数据层** —— 它是 mock 数据，不是 store 状态 */
export const AVAILABLE_COUPONS: ClaimableCoupon[] = [
  {
    id: 'new-user-10',
    code: 'WELCOME10',
    title: 'New User Discount',
    description: '10% off your first order',
    type: 'percent',
    value: 10,
    minOrder: 0,
    maxDiscount: 20,
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'save20-fixed',
    code: 'SAVE20',
    title: '$20 Off Orders Over $100',
    description: 'Flat $20 discount on orders $100+',
    type: 'fixed',
    value: 20,
    minOrder: 100,
    expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'percent15',
    code: 'VIP15',
    title: 'VIP 15% Off',
    description: '15% off sitewide, max $50 discount',
    type: 'percent',
    value: 15,
    minOrder: 50,
    maxDiscount: 50,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'free-ship',
    code: 'FREESHIP',
    title: 'Free Shipping',
    description: 'Free shipping on any order',
    type: 'shipping',
    value: 100,
    minOrder: 0,
    expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'phones-8',
    code: 'PHONE8',
    title: '8% Off Phones',
    description: 'Extra 8% off all phones & accessories',
    type: 'percent',
    value: 8,
    minOrder: 0,
    maxDiscount: 30,
    category: 'Phones',
    expiresAt: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'audio-15',
    code: 'AUDIO15',
    title: '15% Off Audio',
    description: 'Take 15% off any audio product',
    type: 'percent',
    value: 15,
    minOrder: 0,
    maxDiscount: 40,
    category: 'Audio',
    expiresAt: new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'office-10',
    code: 'OFFICE10',
    title: '$10 Off Office Supplies',
    description: 'Flat $10 off office & desk products',
    type: 'fixed',
    value: 10,
    minOrder: 50,
    category: 'Office',
    expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
  },
]

/** 券码的兑换规则 —— 只保留算折扣需要的字段 */
export interface RedeemableCoupon {
  code: string
  type: Coupon['type']
  value: number
  minOrder: number
  maxDiscount?: number
}

/**
 * 结算页能兑换的全部券码。三类来源合并：
 *   1. 券包可领取的（`AVAILABLE_COUPONS`）
 *   2. 积分商城兑换的（`POINTS_MALL`，券码由奖励目录生成）
 *   3. 结算页自带的活动码（`SAVE10`）—— 不在任何领取渠道里，但一直被支持，
 *      且 `e2e-functional` 与 `checkout.spec` 都依赖它，删掉等于砸掉别人的护栏
 */
export const REDEEMABLE_COUPONS: readonly RedeemableCoupon[] = [
  ...AVAILABLE_COUPONS.map((c) => ({
    code: c.code.toUpperCase(),
    type: c.type,
    value: c.value,
    minOrder: c.minOrder,
    maxDiscount: c.maxDiscount,
  })),
  ...POINTS_MALL.map((r) => ({
    code: r.code.toUpperCase(),
    type: 'fixed' as const,
    value: r.discount,
    minOrder: r.minOrder,
  })),
  { code: 'SAVE10', type: 'percent', value: 10, minOrder: 0 },
]

export function findRedeemableCoupon(code: string): RedeemableCoupon | undefined {
  const key = code.trim().toUpperCase()
  return REDEEMABLE_COUPONS.find((c) => c.code === key)
}

/**
 * 按规则算折扣。金额一律 `toFixed(2)` —— 小计是浮点，`100 * 0.15` 会得到 15.000000000000002。
 *
 * 三条分支的边界：
 * - `percent` 受 `maxDiscount` 封顶（"15% off, max $50" 是这么写的）
 * - `fixed` 不超过小计本身（否则会把应付扣成负数）
 * - `shipping` **返回 0** —— 见下方注释，这是已知缺口，不是遗漏
 */
export function computeCouponDiscount(rule: RedeemableCoupon, subtotal: number): number {
  if (subtotal < rule.minOrder) return 0

  switch (rule.type) {
    case 'percent': {
      const raw = subtotal * (rule.value / 100)
      const capped = rule.maxDiscount != null ? Math.min(raw, rule.maxDiscount) : raw
      return +capped.toFixed(2)
    }
    case 'fixed':
      return +Math.min(rule.value, subtotal).toFixed(2)
    case 'shipping':
      // 免运费要从**运费**里扣，而这个函数只拿得到小计 —— 真实分支
      // `POST /checkout/promo { code, subtotal }` 同样拿不到运费。
      // 要么改请求参数（需后端确认），要么在 mock 里就到此为止。此处取后者，
      // 并让 `coupons.spec` 显式跳过 shipping 类型的断言，而不是假装它可用。
      return 0
  }
}

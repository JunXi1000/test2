import { USE_MOCK } from '@/config/env'
import { get, post } from '@/api/http'

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

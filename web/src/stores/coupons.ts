import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { onUserScopeChange, scopedKey } from './userScope'
import { RUNTIME_USE_MOCK } from '@/config/env'
import {
  AVAILABLE_COUPONS,
  getCoupons,
  getMyCoupons,
  claimCoupon as apiClaimCoupon,
  type Coupon,
  type ClaimableCoupon,
} from '@/api/modules/coupons'

export type { Coupon } from '@/api/modules/coupons'

const STORAGE_KEY = 'nexus_user_coupons'

function loadClaimedFromStorage(): Coupon[] {
  try {
    const raw = localStorage.getItem(scopedKey(STORAGE_KEY))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(items: Coupon[]) {
  localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(items))
}

export const useCouponStore = defineStore('coupons', () => {
  const myCoupons = ref<Coupon[]>([])
  const catalog = ref<ClaimableCoupon[]>([])

  /** Hydrate from backend (non-mock) or local storage / mock constants. */
  async function load() {
    if (RUNTIME_USE_MOCK.value) {
      catalog.value = AVAILABLE_COUPONS
      myCoupons.value = loadClaimedFromStorage()
      return
    }
    try {
      const [cat, mine] = await Promise.all([getCoupons(), getMyCoupons()])
      catalog.value = cat
      myCoupons.value = mine
    } catch {
      catalog.value = []
      myCoupons.value = []
    }
  }

  onUserScopeChange(() => {
    load()
  })

  const available = computed(() =>
    myCoupons.value.filter((c) => !c.isUsed && new Date(c.expiresAt) > new Date()),
  )
  const used = computed(() => myCoupons.value.filter((c) => c.isUsed))
  const expired = computed(() =>
    myCoupons.value.filter((c) => !c.isUsed && new Date(c.expiresAt) <= new Date()),
  )

  async function claimCoupon(couponId: string): Promise<boolean> {
    if (RUNTIME_USE_MOCK.value) {
      const template = AVAILABLE_COUPONS.find((c) => c.id === couponId)
      if (!template) return false
      if (myCoupons.value.some((c) => c.id === couponId)) return false

      myCoupons.value.push({
        ...template,
        isUsed: false,
        claimedAt: Date.now(),
      })
      saveToStorage(myCoupons.value)
      return true
    }

    try {
      await apiClaimCoupon(couponId)
      myCoupons.value = await getMyCoupons()
      return true
    } catch {
      return false
    }
  }

  /** 积分商城兑换的奖励入账（阶段 5.1）：生成一张 90 天有效的固定额度优惠券 */
  function addRedeemedCoupon(reward: {
    id: string
    code: string
    title: string
    description: string
    type: Coupon['type']
    value: number
    minOrder: number
  }): boolean {
    if (myCoupons.value.some((c) => c.id === reward.id)) return false
    const coupon: Coupon = {
      id: reward.id,
      code: reward.code,
      title: reward.title,
      description: reward.description,
      type: reward.type,
      value: reward.value,
      minOrder: reward.minOrder,
      expiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
      isUsed: false,
      claimedAt: Date.now(),
    }
    myCoupons.value.push(coupon)
    if (RUNTIME_USE_MOCK.value) saveToStorage(myCoupons.value)
    return true
  }

  /** Calculate discount for a given order subtotal and optional category */
  function calculateDiscount(
    couponId: string,
    subtotal: number,
    categories?: string[],
  ): { discount: number; type: string } | null {
    const coupon = myCoupons.value.find(
      (c) => c.id === couponId && !c.isUsed && new Date(c.expiresAt) > new Date(),
    )
    if (!coupon) return null
    if (subtotal < coupon.minOrder) return null
    // Category restriction
    if (coupon.category && categories && categories.length > 0) {
      if (!categories.includes(coupon.category)) return null
    }

    if (coupon.type === 'percent') {
      let discount = subtotal * (coupon.value / 100)
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount
      }
      return { discount: Math.round(discount * 100) / 100, type: 'percent' }
    }
    if (coupon.type === 'fixed') {
      return { discount: Math.min(coupon.value, subtotal), type: 'fixed' }
    }
    // shipping — handled separately
    return { discount: 0, type: 'shipping' }
  }

  function hasClaimed(couponId: string): boolean {
    return myCoupons.value.some((c) => c.id === couponId)
  }

  return {
    myCoupons,
    catalog,
    available,
    used,
    expired,
    claimCoupon,
    addRedeemedCoupon,
    calculateDiscount,
    hasClaimed,
    load,
  }
})

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { onUserScopeChange, scopedKey } from './userScope'
import { RUNTIME_USE_MOCK } from '@/config/env'
import { toErrorMessage } from '@/utils/error'
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

  /**
   * 取数失败的原因（空串 = 没出错）。与 stores/returns.ts、stockAlerts.ts 同一处置：
   * 原先 catch 里清空两个列表，于是**接口挂了**与**一张券都没有**在界面上没有区别。
   */
  const error = ref('')

  /** Hydrate from backend (non-mock) or local storage / mock constants. */
  async function load() {
    error.value = ''
    if (RUNTIME_USE_MOCK.value) {
      catalog.value = AVAILABLE_COUPONS
      myCoupons.value = loadClaimedFromStorage()
      return
    }
    try {
      const [cat, mine] = await Promise.all([getCoupons(), getMyCoupons()])
      catalog.value = cat
      myCoupons.value = mine
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to load coupons')
      // 不清空两个列表 —— 见 error 的说明
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

  // 已删：`calculateDiscount(couponId, subtotal, categories)` —— 零引用的死代码，
  // 而且是**券码数学的第四处实现**（另三处：券包目录、积分商城、结算页的 mock 折扣表）。
  // 它的算法与 `api/modules/coupons.ts` 的 `computeCouponDiscount` 重复且会分叉
  // （比如它不认识 `shipping`，直接返回 0）。真要用券码折扣，用后者。

  function hasClaimed(couponId: string): boolean {
    return myCoupons.value.some((c) => c.id === couponId)
  }

  return {
    myCoupons,
    catalog,
    error,
    available,
    used,
    expired,
    claimCoupon,
    addRedeemedCoupon,
    hasClaimed,
    load,
  }
})

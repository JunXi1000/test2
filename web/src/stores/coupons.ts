import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { onUserScopeChange, scopedKey } from './userScope'
import { RUNTIME_USE_MOCK } from '@/config/env'
import {
  getCoupons,
  getMyCoupons,
  claimCoupon as apiClaimCoupon,
  type Coupon,
  type ClaimableCoupon,
} from '@/api/modules/coupons'

export type { Coupon } from '@/api/modules/coupons'

const STORAGE_KEY = 'nexus_user_coupons'

// ── Available coupons to claim (mock fallback) ───────────────────────
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

  const available = computed(() => myCoupons.value.filter(c => !c.isUsed && new Date(c.expiresAt) > new Date()))
  const used = computed(() => myCoupons.value.filter(c => c.isUsed))
  const expired = computed(() => myCoupons.value.filter(c => !c.isUsed && new Date(c.expiresAt) <= new Date()))

  async function claimCoupon(couponId: string): Promise<boolean> {
    if (RUNTIME_USE_MOCK.value) {
      const template = AVAILABLE_COUPONS.find(c => c.id === couponId)
      if (!template) return false
      if (myCoupons.value.some(c => c.id === couponId)) return false

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

  function markUsed(couponId: string) {
    const c = myCoupons.value.find(c => c.id === couponId)
    if (c) {
      c.isUsed = true
      if (RUNTIME_USE_MOCK.value) saveToStorage(myCoupons.value)
    }
  }

  /** Calculate discount for a given order subtotal and optional category */
  function calculateDiscount(couponId: string, subtotal: number, categories?: string[]): { discount: number; type: string } | null {
    const coupon = myCoupons.value.find(c => c.id === couponId && !c.isUsed && new Date(c.expiresAt) > new Date())
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
    return myCoupons.value.some(c => c.id === couponId)
  }

  return { myCoupons, catalog, available, used, expired, claimCoupon, markUsed, calculateDiscount, hasClaimed, load }
})

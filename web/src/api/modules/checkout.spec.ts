import { describe, expect, it, vi } from 'vitest'
import type { CartItem } from '@/stores/cart'

// 这些 mock 会被 vitest 提升到 import 之前：checkout.ts 顶层就要读 USE_MOCK、
// 并 import http（会创建 axios 实例）。锁成 mock 分支，测试才不碰网络。
vi.mock('@/config/env', () => ({ USE_MOCK: true }))
vi.mock('@/api/http', () => ({ get: vi.fn(), post: vi.fn() }))

import {
  applyPromoCode,
  calculateOrderSummary,
  DISCOUNT_TIERS,
  getNextTier,
  getTieredDiscount,
} from './checkout'

function cartItem(price: number, quantity = 1): CartItem {
  return {
    id: 1,
    cartItemId: 'row-1',
    title: 'Test Item',
    price,
    image: 'test.jpg',
    color: 'Default',
    size: 'Standard',
    quantity,
  }
}

describe('DISCOUNT_TIERS：档位表本身的不变量', () => {
  it('门槛与减免额都严格递增——getTieredDiscount 的 reduce 依赖这一点', () => {
    for (let i = 1; i < DISCOUNT_TIERS.length; i++) {
      expect(DISCOUNT_TIERS[i].threshold).toBeGreaterThan(DISCOUNT_TIERS[i - 1].threshold)
      expect(DISCOUNT_TIERS[i].discount).toBeGreaterThan(DISCOUNT_TIERS[i - 1].discount)
    }
  })
})

describe('getTieredDiscount：门槛是闭区间（>=）', () => {
  it('未达最低门槛不给折扣', () => {
    expect(getTieredDiscount(99.99)).toEqual({ discount: 0, tier: undefined })
    expect(getTieredDiscount(0)).toEqual({ discount: 0, tier: undefined })
  })

  it('恰好等于门槛即生效——差一分钱就没有', () => {
    expect(getTieredDiscount(100).discount).toBe(10)
    expect(getTieredDiscount(199.99).discount).toBe(10)
    expect(getTieredDiscount(200).discount).toBe(30)
    expect(getTieredDiscount(300).discount).toBe(60)
  })

  it('取减免额最大的档，而不是第一个匹配的档', () => {
    expect(getTieredDiscount(350).discount).toBe(60)
    expect(getTieredDiscount(9999).discount).toBe(60)
  })

  it('返回的 tier 是档位表里的同一个对象（label 供 UI 展示）', () => {
    expect(getTieredDiscount(200).tier).toBe(DISCOUNT_TIERS[1])
  })
})

describe('getNextTier：进度条提示', () => {
  it('起点指向第一档', () => {
    expect(getNextTier(0)).toEqual({ remaining: 100, tier: DISCOUNT_TIERS[0] })
  })

  it('恰好到档时指向下一档，而不是当前档', () => {
    expect(getNextTier(100)).toEqual({ remaining: 100, tier: DISCOUNT_TIERS[1] })
  })

  it('差一分钱时指向当前档', () => {
    expect(getNextTier(99.99)).toEqual({ remaining: 0.01, tier: DISCOUNT_TIERS[0] })
    expect(getNextTier(299.99)).toEqual({ remaining: 0.01, tier: DISCOUNT_TIERS[2] })
  })

  it('已满最高档返回 null', () => {
    expect(getNextTier(300)).toBeNull()
    expect(getNextTier(9999)).toBeNull()
  })

  it('浮点残差会被四舍五入成 remaining: 0（进度条会显示"再买 $0 可减"）', () => {
    // 这是 toFixed(2) 的既有行为，不是崩溃，但文案上是个小瑕疵——先钉住，改动时会被发现
    expect(getNextTier(99.999)).toEqual({ remaining: 0, tier: DISCOUNT_TIERS[0] })
  })
})

describe('applyPromoCode：优惠码（mock 分支）', () => {
  it('SAVE10 减 10%', async () => {
    await expect(applyPromoCode('SAVE10', 100)).resolves.toEqual({ discount: 10 })
  })

  it('VIP15 减 15%', async () => {
    await expect(applyPromoCode('VIP15', 100)).resolves.toEqual({ discount: 15 })
  })

  it('大小写不敏感', async () => {
    await expect(applyPromoCode('save10', 100)).resolves.toEqual({ discount: 10 })
  })

  it('无效码不打折', async () => {
    await expect(applyPromoCode('NOPE', 100)).resolves.toEqual({ discount: 0 })
    await expect(applyPromoCode('', 100)).resolves.toEqual({ discount: 0 })
  })

  it('金额四舍五入到分', async () => {
    // 33.33 * 0.1 = 3.333
    await expect(applyPromoCode('SAVE10', 33.33)).resolves.toEqual({ discount: 3.33 })
  })
})

describe('calculateOrderSummary：mock 分支的算账规则', () => {
  it('subtotal / shipping / tax / discount / total 逐项可复算', async () => {
    await expect(calculateOrderSummary([cartItem(50)])).resolves.toEqual({
      subtotal: 50,
      shipping: 12,
      tax: 4,
      discount: 0,
      total: 66,
    })
  })

  it('金额按 quantity 累加', async () => {
    // 30 * 3 = 90，未达 100 门槛
    await expect(calculateOrderSummary([cartItem(30, 3)])).resolves.toEqual({
      subtotal: 90,
      shipping: 12,
      tax: 7.2,
      discount: 0,
      total: 109.2,
    })
  })

  it('运费门槛是严格大于 200——恰好 200 仍收运费', async () => {
    const at200 = await calculateOrderSummary([cartItem(200)])
    const at201 = await calculateOrderSummary([cartItem(201)])
    expect(at200.shipping).toBe(12)
    expect(at201.shipping).toBe(0)
  })

  it('多买 1 元反而少付 10.92 元（运费断崖与满减档叠加）', async () => {
    const at200 = await calculateOrderSummary([cartItem(200)])
    const at201 = await calculateOrderSummary([cartItem(201)])
    expect(at200.total).toBe(198)
    expect(at201.total).toBe(187.08)
    // 两个"已四舍五入到分"的数相减，结果本身并不精确（198 - 187.08 = 10.919999…）
    expect(at200.total - at201.total).toBeCloseTo(10.92, 2)
  })

  it('最高档账单', async () => {
    await expect(calculateOrderSummary([cartItem(300)])).resolves.toEqual({
      subtotal: 300,
      shipping: 0,
      tax: 24,
      discount: 60,
      total: 264,
    })
  })

  it('空购物车仍会算出一笔 12 元运费（调用方需自行拦空车）', async () => {
    await expect(calculateOrderSummary([])).resolves.toEqual({
      subtotal: 0,
      shipping: 12,
      tax: 0,
      discount: 0,
      total: 12,
    })
  })
})

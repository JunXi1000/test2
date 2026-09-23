import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import { useOrderSummary } from './useOrderSummary'
import { useAuthStore, type User } from '@/stores/auth'
import { useLoyaltyStore } from '@/stores/loyalty'
import { useToast } from './useToast'
import { POINTS_PER_DOLLAR } from '@/api/modules/loyalty'
import type { CartItem } from '@/stores/cart'
import type { OrderSummary } from '@/api/modules/checkout'

/**
 * 订单摘要的钉子在这里。三层折扣叠加的口径（满减 / 优惠码 / 积分）与积分的夹逼规则
 * 都是纯计算，但算错了用户看到的是**金额不对** —— 这种 bug 在 E2E 里只会表现为
 * 「总价断言不过」，查起来比单测贵得多。
 */

const mocks = vi.hoisted(() => ({
  calculateOrderSummary: vi.fn(),
  applyPromoCode: vi.fn(),
}))

vi.mock('@/api/modules/checkout', () => ({
  calculateOrderSummary: mocks.calculateOrderSummary,
  applyPromoCode: mocks.applyPromoCode,
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const ITEMS: CartItem[] = [
  {
    id: 1,
    cartItemId: 'c1',
    title: 'Widget',
    price: 50,
    image: '/w.png',
    color: 'Default',
    size: 'Standard',
    quantity: 2,
  },
]

const BASE_SUMMARY: OrderSummary = { subtotal: 100, shipping: 10, tax: 5, discount: 0, total: 115 }

/** 建一个实例；zip 可变，用来验证 getZip 是取数时才读 */
function setup() {
  const zip = { value: '12345' }
  const api = useOrderSummary({ items: ref(ITEMS), getZip: () => zip.value })
  return { api, zip }
}

function login(points = 0) {
  const auth = useAuthStore()
  auth.user = { id: '1', name: 'Alex', email: 'a@b.c', role: 'user' } as User
  auth.token = 'tok'
  useLoyaltyStore().state.points = points
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  useToast().toasts.value.splice(0)
  mocks.calculateOrderSummary.mockResolvedValue({ ...BASE_SUMMARY })
  mocks.applyPromoCode.mockResolvedValue({ discount: 10 })
})

describe('useOrderSummary — 金额口径', () => {
  it('取数成功后 total = 小计 + 运费 + 税 - 满减（无优惠码无积分）', async () => {
    const { api } = setup()
    expect(api.total.value).toBe(0) // 取数前是空的，不是 NaN

    await api.fetchSummary()

    expect(api.summary.value.subtotal).toBe(100)
    expect(api.total.value).toBe(115)
  })

  it('满减走 summary.discount，单独暴露成 tieredDiscount', async () => {
    mocks.calculateOrderSummary.mockResolvedValue({ ...BASE_SUMMARY, discount: 15 })
    const { api } = setup()
    await api.fetchSummary()

    expect(api.tieredDiscount.value).toBe(15)
    expect(api.total.value).toBe(100)
  })

  it('优惠码与满减**可叠加**，两者都从应付里扣', async () => {
    mocks.calculateOrderSummary.mockResolvedValue({ ...BASE_SUMMARY, discount: 15 })
    const { api } = setup()
    await api.fetchSummary()
    api.promoCode.value = 'SAVE10'
    await api.applyPromo()

    expect(api.promoDiscount.value).toBe(10)
    expect(api.total.value).toBe(90) // 115 - 15 - 10
  })

  it('积分再叠一层：100 分 = $1，向下取整', async () => {
    login(10_000)
    const { api } = setup()
    await api.fetchSummary()

    api.pointsToUse.value = 5_000
    await nextTick()

    expect(api.pointsDiscount.value).toBe(50)
    expect(api.total.value).toBe(65) // 115 - 50
  })

  it('积分不满一个兑换单位时向下取整（不四舍五入）', async () => {
    login(10_000)
    const { api } = setup()
    await api.fetchSummary()

    api.pointsToUse.value = 199
    await nextTick()

    // 199 → 夹逼里先向下取到 100 的整数倍 = 100，再折算 $1
    expect(api.pointsToUse.value).toBe(POINTS_PER_DOLLAR)
    expect(api.pointsDiscount.value).toBe(1)
  })
})

describe('useOrderSummary — 积分夹逼', () => {
  it('未登录：可用积分为 0（即使本地存着余额）', async () => {
    useLoyaltyStore().state.points = 99_999
    const { api } = setup()
    await api.fetchSummary()

    expect(api.maxPointsToUse.value).toBe(0)
    expect(api.pointsUsable.value).toBe(false)
  })

  it('上限受余额约束', async () => {
    login(3_000)
    const { api } = setup()
    await api.fetchSummary()

    expect(api.maxPointsToUse.value).toBe(3_000)
  })

  it('上限也受应付金额约束 —— 不能抵扣出负数', async () => {
    login(9_999_999)
    mocks.calculateOrderSummary.mockResolvedValue({
      subtotal: 50,
      shipping: 0,
      tax: 0,
      discount: 0,
      total: 50,
    })
    const { api } = setup()
    await api.fetchSummary()

    expect(api.maxPointsToUse.value).toBe(50 * POINTS_PER_DOLLAR)
  })

  it('手打超出余额的数字会被夹回上限', async () => {
    login(3_000)
    const { api } = setup()
    await api.fetchSummary()

    api.pointsToUse.value = 999_999
    await nextTick()

    expect(api.pointsToUse.value).toBe(3_000)
  })

  it('余额不足一个兑换单位时整块不可用', async () => {
    login(POINTS_PER_DOLLAR - 1)
    const { api } = setup()
    await api.fetchSummary()

    expect(api.pointsUsable.value).toBe(false)
  })

  it('清空输入归零，不会留着上一次的抵扣', async () => {
    login(10_000)
    const { api } = setup()
    await api.fetchSummary()
    api.pointsToUse.value = 5_000
    await nextTick()

    api.pointsToUse.value = 0
    await nextTick()

    expect(api.pointsToUse.value).toBe(0)
    expect(api.pointsDiscount.value).toBe(0)
    expect(api.total.value).toBe(115)
  })
})

describe('useOrderSummary — 取数', () => {
  it('把邮编传下去 —— getZip 是取数时才读，用户改了邮编要重算', async () => {
    const { api, zip } = setup()
    await api.fetchSummary()
    expect(mocks.calculateOrderSummary).toHaveBeenLastCalledWith(ITEMS, '12345')

    zip.value = '99999'
    await api.fetchSummary()
    expect(mocks.calculateOrderSummary).toHaveBeenLastCalledWith(ITEMS, '99999')
  })

  it('失败：写 error（右栏 ErrorState 靠它渲染）并 toast，摘要保持上一次的值', async () => {
    const { api } = setup()
    await api.fetchSummary()
    mocks.calculateOrderSummary.mockRejectedValue(new Error('boom'))

    await api.fetchSummary()

    expect(api.error.value).toBe('boom')
    expect(useToast().toasts.value.length).toBeGreaterThan(0)
    expect(api.summary.value.subtotal).toBe(100) // 没被清成 0
  })
})

describe('useOrderSummary — 优惠码', () => {
  it('空码：只提示，不请求', async () => {
    const { api } = setup()
    await api.fetchSummary()
    api.promoCode.value = '   '

    await api.applyPromo()

    expect(mocks.applyPromoCode).not.toHaveBeenCalled()
    expect(api.promoApplied.value).toBe(false)
  })

  it('折扣为 0（无效码）：不标记为已应用', async () => {
    mocks.applyPromoCode.mockResolvedValue({ discount: 0 })
    const { api } = setup()
    await api.fetchSummary()
    api.promoCode.value = 'NOPE'

    await api.applyPromo()

    expect(api.promoApplied.value).toBe(false)
    expect(api.promoDiscount.value).toBe(0)
  })

  it('重复应用：提示但不重复请求', async () => {
    const { api } = setup()
    await api.fetchSummary()
    api.promoCode.value = 'SAVE10'
    await api.applyPromo()

    await api.applyPromo()

    expect(mocks.applyPromoCode).toHaveBeenCalledTimes(1)
  })

  it('请求抛出：原因取自异常对象，不标记为已应用', async () => {
    mocks.applyPromoCode.mockRejectedValue(new Error('expired'))
    const { api } = setup()
    await api.fetchSummary()
    api.promoCode.value = 'OLD'

    await api.applyPromo()

    const toasts = useToast().toasts.value
    expect(api.promoApplied.value).toBe(false)
    expect(toasts[toasts.length - 1]?.description).toBe('expired')
  })

  it('移除：三个字段一起清，折扣跟着回退', async () => {
    const { api } = setup()
    await api.fetchSummary()
    api.promoCode.value = 'SAVE10'
    await api.applyPromo()
    expect(api.total.value).toBe(105)

    api.removePromo()

    expect(api.promoApplied.value).toBe(false)
    expect(api.promoDiscount.value).toBe(0)
    expect(api.promoCode.value).toBe('')
    expect(api.total.value).toBe(115)
  })
})

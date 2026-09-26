import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePromoCode } from './usePromoCode'
import { useToast } from './useToast'

/**
 * 促销码组合式的钉子。它现在被购物车页与结算页共用，而原先两侧各写了一份**逐字重复**的
 * 分支（空码 / 已应用 / 折扣为 0 / 请求抛出）—— 这条 spec 钉的就是那四条分支，
 * 以及两处**文案不同**这件事没有被"顺手统一"掉。
 */

const mocks = vi.hoisted(() => ({ applyPromoCode: vi.fn() }))

vi.mock('@/api/modules/checkout', () => ({ applyPromoCode: mocks.applyPromoCode }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

function setup(subtotal = 100, alreadyAppliedDesc = 'CART_TEXT') {
  return usePromoCode({ getSubtotal: () => subtotal, alreadyAppliedDesc })
}

beforeEach(() => {
  useToast().toasts.value.splice(0)
  mocks.applyPromoCode.mockResolvedValue({ discount: 10 })
})

describe('usePromoCode', () => {
  it('空码（含纯空格）：提示且不请求', async () => {
    const promo = setup()
    promo.promoCode.value = '   '

    await promo.applyPromo()

    expect(mocks.applyPromoCode).not.toHaveBeenCalled()
    expect(promo.promoApplied.value).toBe(false)
  })

  it('已应用时用**调用方传进来的**那句文案，不是写死的', async () => {
    const promo = setup(100, '结算页自己的那句')
    promo.promoCode.value = 'X'
    await promo.applyPromo()

    await promo.applyPromo()

    const toasts = useToast().toasts.value
    expect(toasts[toasts.length - 1]?.description).toBe('结算页自己的那句')
    expect(mocks.applyPromoCode).toHaveBeenCalledTimes(1)
  })

  it('折扣为 0（无效码）：不标记为已应用', async () => {
    mocks.applyPromoCode.mockResolvedValue({ discount: 0 })
    const promo = setup()
    promo.promoCode.value = 'NOPE'

    await promo.applyPromo()

    expect(promo.promoApplied.value).toBe(false)
    expect(promo.promoDiscount.value).toBe(0)
  })

  it('成功：记折扣、标记已应用，并按折扣金额提示', async () => {
    const promo = setup()
    promo.promoCode.value = 'save10'

    await promo.applyPromo()

    expect(promo.promoDiscount.value).toBe(10)
    expect(promo.promoApplied.value).toBe(true)
  })

  it('请求抛出：原因取自异常对象，且不标记为已应用', async () => {
    mocks.applyPromoCode.mockRejectedValue(new Error('expired'))
    const promo = setup()
    promo.promoCode.value = 'OLD'

    await promo.applyPromo()

    const toasts = useToast().toasts.value
    expect(promo.promoApplied.value).toBe(false)
    expect(toasts[toasts.length - 1]?.description).toBe('expired')
  })

  it('小计用 getter 取 —— 每次应用都读「此刻」的值，不是构造时的快照', async () => {
    let subtotal = 100
    const promo = usePromoCode({ getSubtotal: () => subtotal, alreadyAppliedDesc: 'X' })
    promo.promoCode.value = 'A'
    await promo.applyPromo()
    expect(mocks.applyPromoCode).toHaveBeenLastCalledWith('A', 100)

    subtotal = 250
    promo.promoApplied.value = false
    promo.promoCode.value = 'B'
    await promo.applyPromo()
    expect(mocks.applyPromoCode).toHaveBeenLastCalledWith('B', 250)
  })

  it('removePromo：清三个字段并提示；reset：只清不提示（清空购物车时用）', async () => {
    const promo = setup()
    promo.promoCode.value = 'X'
    await promo.applyPromo()
    useToast().toasts.value.splice(0)

    promo.removePromo()
    expect(promo.promoCode.value).toBe('')
    expect(promo.promoApplied.value).toBe(false)
    expect(promo.promoDiscount.value).toBe(0)
    expect(useToast().toasts.value).toHaveLength(1)

    useToast().toasts.value.splice(0)
    promo.promoCode.value = 'Y'
    await promo.applyPromo()
    useToast().toasts.value.splice(0)

    promo.reset()
    expect(promo.promoApplied.value).toBe(false)
    expect(useToast().toasts.value).toHaveLength(0)
  })
})

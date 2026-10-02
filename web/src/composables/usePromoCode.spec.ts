import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
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

/**
 * `onApplied` 钩子的三种触发情形。
 *
 * 为什么值得单独钉：减免额由**服务端摘要**给出（`/checkout/summary` 要收到 code 才算），
 * 所以「生效状态变了」必须让上层重取摘要。调用方若只 `watch(promoApplied)` 会漏掉
 * 「移除」那一半；若只在 applyPromo 里回调，会漏掉「输入偏离导致作废」那一半。
 * 漏掉任一情形，页面就会留着一个与实扣不符的减免 —— 即 BLK-4 的反方向。
 */
describe('usePromoCode — onApplied 钩子（三种触发情形）', () => {
  it('应用成功：回调一次', async () => {
    const onApplied = vi.fn()
    const promo = usePromoCode({ getSubtotal: () => 100, alreadyAppliedDesc: 'X', onApplied })

    promo.promoCode.value = 'SAVE10'
    await promo.applyPromo()

    expect(promo.promoApplied.value).toBe(true)
    expect(onApplied).toHaveBeenCalledTimes(1)
  })

  it('折扣为 0（无效码）：不触发（没生效就没有要重取的减免）', async () => {
    mocks.applyPromoCode.mockResolvedValue({ discount: 0 })
    const onApplied = vi.fn()
    const promo = usePromoCode({ getSubtotal: () => 100, alreadyAppliedDesc: 'X', onApplied })

    promo.promoCode.value = 'NOPE'
    await promo.applyPromo()

    expect(promo.promoApplied.value).toBe(false)
    expect(onApplied).not.toHaveBeenCalled()
  })

  it('用户移除：回调一次（漏了它页面会一直显示已作废的减免）', async () => {
    const onApplied = vi.fn()
    const promo = usePromoCode({ getSubtotal: () => 100, alreadyAppliedDesc: 'X', onApplied })

    promo.promoCode.value = 'SAVE10'
    await promo.applyPromo()
    onApplied.mockClear()

    promo.removePromo()

    expect(promo.promoApplied.value).toBe(false)
    expect(promo.promoDiscount.value).toBe(0)
    expect(onApplied).toHaveBeenCalledTimes(1)
  })

  it('已生效后改写输入框（未重点 Apply）：作废生效状态并回调一次，避免"显示旧码、后端按新码核销"', async () => {
    const onApplied = vi.fn()
    const promo = usePromoCode({ getSubtotal: () => 100, alreadyAppliedDesc: 'X', onApplied })

    promo.promoCode.value = 'SAVE10'
    await promo.applyPromo()
    expect(promo.promoApplied.value).toBe(true)
    onApplied.mockClear()

    // 把输入改成另一个码 —— 没点 Apply，所以它**没有生效**
    promo.promoCode.value = 'SAVE20'
    await nextTick()

    expect(promo.promoApplied.value).toBe(false)
    expect(promo.promoDiscount.value).toBe(0)
    expect(onApplied).toHaveBeenCalledTimes(1)
    // 输入框里那个「没生效的码」不是页面应该显示的已应用码
    expect(promo.promoCode.value).toBe('SAVE20')
  })

  it('未生效时改写输入框：不回调（没有生效状态可作废）', async () => {
    const onApplied = vi.fn()
    const promo = usePromoCode({ getSubtotal: () => 100, alreadyAppliedDesc: 'X', onApplied })

    promo.promoCode.value = 'A'
    await nextTick()
    promo.promoCode.value = 'B'
    await nextTick()

    expect(onApplied).not.toHaveBeenCalled()
  })

  /**
   * D-2 回归钉子（2026-10-01，G1b）。
   *
   * 旧 watcher 走 `reset()`，会把 `promoCode` 一起清空 —— 而触发它的是**用户在打字**，
   * 于是每敲一个字符就被清一次，输入框永远填不进新码。D 阶段 vitest 实测到的就是这条：
   * `expected '' to be 'SAVE20'`。
   *
   * 这里逐字符改写，断言"输入留在输入框里"，同时生效状态已作废（用户必须重按 Apply）。
   */
  it('逐字符改写输入框：字符不会被吞掉（D-2）', async () => {
    const onApplied = vi.fn()
    const promo = usePromoCode({ getSubtotal: () => 100, alreadyAppliedDesc: 'X', onApplied })

    promo.promoCode.value = 'SAVE10'
    await promo.applyPromo()
    expect(promo.promoApplied.value).toBe(true)
    onApplied.mockClear()

    promo.promoCode.value = 'S'
    await nextTick()
    expect(promo.promoCode.value).toBe('S') // 不是 ''

    promo.promoCode.value = 'SA'
    await nextTick()
    expect(promo.promoCode.value).toBe('SA') // 仍然不是 ''

    // 生效状态只作废一次（后续字符不再重复回调）
    expect(promo.promoApplied.value).toBe(false)
    expect(onApplied).toHaveBeenCalledTimes(1)
    expect(promo.promoDiscount.value).toBe(0)
  })
})

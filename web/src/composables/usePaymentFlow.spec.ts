import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { usePaymentFlow, type UsePaymentFlowOptions } from './usePaymentFlow'
import { useToast } from './useToast'
import type { SavedPaymentMethod } from '@/api/modules/payment'
import type { CartItem } from '@/stores/cart'

/**
 * 支付状态机的钉子在这里，而不是只靠 E2E。
 *
 * 原因：这条流程的 E2E 在 `tests/e2e-functional.spec.ts` 里，那一片有约 130 处固定
 * `waitForTimeout`，本来就飘（`tests/main-flow.spec.ts` 才是确定性的那一档）。
 * 拆 `usePaymentFlow` 时如果只有那一档护栏，"红了"到底是改坏了还是它自己飘，判不出来。
 * 这里把网关返回值当注入点，三条分支（成功 / 拒付 / 3DS）都是确定性的。
 */

const mocks = vi.hoisted(() => ({
  createPaymentIntent: vi.fn(),
  confirmPayment: vi.fn(),
  completePaymentAction: vi.fn(),
}))

vi.mock('@/api/modules/payment', () => ({
  createPaymentIntent: mocks.createPaymentIntent,
  confirmPayment: mocks.confirmPayment,
  completePaymentAction: mocks.completePaymentAction,
}))

// t 直接返回 key：断言里写的 'checkout.declinedCard' 就是页面会渲染的那条文案的来源。
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

const CART_ITEM: CartItem = {
  id: 7,
  cartItemId: 'c1',
  title: 'Widget',
  price: 50,
  image: '/w.png',
  color: 'Default',
  size: 'Standard',
  quantity: 2,
  serverId: 99,
}

function makeOptions() {
  const options: UsePaymentFlowOptions = {
    items: ref<CartItem[]>([CART_ITEM]),
    formData: {
      firstName: 'Alex',
      lastName: 'Doe',
      address: '1 Main St',
      city: 'Springfield',
      zip: '12345',
      country: 'United States',
      cardNumber: '4242 4242 4242 4242',
    },
    total: ref(100),
    /**
     * 生效的优惠码。默认空串 = 没用券 —— **必填**：漏传就等于「页面显示了优惠、
     * 后端不核销」（BLK-4），所以让它成为编译期就能抓住的错。
     */
    discountCode: ref(''),
    savedCard: ref<SavedPaymentMethod | null>(null),
    currentStep: ref(2),
    isCompletingOrder: ref(false),
    finalize: vi.fn(async () => {}),
  }
  return options
}

beforeEach(() => {
  mocks.createPaymentIntent.mockResolvedValue({ paymentId: 'p1', orderId: 'o1' })
  mocks.confirmPayment.mockResolvedValue({ status: 'succeeded', orderId: 'o1' })
  mocks.completePaymentAction.mockResolvedValue({ status: 'succeeded', orderId: 'o1' })
  useToast().toasts.value.splice(0)
})

describe('usePaymentFlow', () => {
  it('成功：confirmPayment 返回 succeeded → 用返回的 orderId 落单', async () => {
    const options = makeOptions()
    const flow = usePaymentFlow(options)

    await flow.handlePayment()

    expect(options.finalize).toHaveBeenCalledTimes(1)
    expect(options.finalize).toHaveBeenCalledWith('o1')
    expect(flow.paymentErrorRef.value).toBe('')
    expect(flow.show3ds.value).toBe(false)
  })

  it('payload 的商品项只传 id + 数量（金额由服务端重算）、券码照发；带 serverId 的行才进 cartItemIds', async () => {
    const options = makeOptions()
    const flow = usePaymentFlow(options)

    await flow.handlePayment()

    const payload = mocks.createPaymentIntent.mock.calls[0][0]
    expect(payload.items).toEqual([{ productId: 7, quantity: 2 }])
    expect(payload.amount).toBe(100)
    expect(payload.cartItemIds).toEqual([99])
    expect(payload.shipping).toMatchObject({ name: 'Alex Doe', zip: '12345' })
    // 没用券时也要把这个字段发出去（空串 = 不核销），后端 `isBlank()` 同样当未传
    expect(payload.code).toBe('')
    // 价格不由前端算：payload 里不能出现单价
    expect(payload.items[0]).not.toHaveProperty('price')
  })

  it('用券：把生效的码发给 /payments/create（后端据此核销，BLK-4）', async () => {
    const options = makeOptions()
    options.discountCode.value = 'SAVE10'
    const flow = usePaymentFlow(options)

    await flow.handlePayment()

    expect(mocks.createPaymentIntent.mock.calls[0][0].code).toBe('SAVE10')
  })

  it('无 serverId 的 guest 行不产生 cartItemIds 项（后端无从清除购物车行）', async () => {
    const options = makeOptions()
    options.items.value = [{ ...CART_ITEM, serverId: undefined }]
    const flow = usePaymentFlow(options)

    await flow.handlePayment()

    expect(mocks.createPaymentIntent.mock.calls[0][0].cartItemIds).toEqual([])
  })

  it('requires_action：开 3DS 弹窗、记下 intent 与 txn，**不落单**', async () => {
    mocks.confirmPayment.mockResolvedValue({
      status: 'requires_action',
      action: { transactionId: 'txn-1' },
    })
    const options = makeOptions()
    const flow = usePaymentFlow(options)

    await flow.handlePayment()

    expect(flow.show3ds.value).toBe(true)
    expect(flow.pendingIntent.value).toEqual({ paymentId: 'p1', orderId: 'o1' })
    expect(flow.last3dsTxn.value).toBe('txn-1')
    expect(options.finalize).not.toHaveBeenCalled()
  })

  it('拒付：错误码映射成文案、退回支付步、不落单', async () => {
    mocks.confirmPayment.mockResolvedValue({ status: 'failed', errorCode: 'card_declined' })
    const options = makeOptions()
    const flow = usePaymentFlow(options)

    await flow.handlePayment()

    expect(flow.paymentErrorRef.value).toBe('checkout.declinedCard')
    expect(options.currentStep.value).toBe(1)
    expect(options.finalize).not.toHaveBeenCalled()
  })

  it('余额不足走另一条文案，不是笼统的通用提示', async () => {
    mocks.confirmPayment.mockResolvedValue({ status: 'failed', errorCode: 'insufficient_funds' })
    const flow = usePaymentFlow(makeOptions())

    await flow.handlePayment()

    expect(flow.paymentErrorRef.value).toBe('checkout.declinedInsufficient')
  })

  it('未知错误码退回网关给的 errorMessage，没有才用兜底文案', async () => {
    mocks.confirmPayment.mockResolvedValue({
      status: 'failed',
      errorCode: 'weird_code',
      errorMessage: '网关自己的话',
    })
    const flow = usePaymentFlow(makeOptions())

    await flow.handlePayment()

    expect(flow.paymentErrorRef.value).toBe('网关自己的话')
  })

  it('请求抛出（网络/解析）：原因取自异常对象，且两个在途标记都复位', async () => {
    mocks.createPaymentIntent.mockRejectedValue(new Error('boom'))
    const options = makeOptions()
    const flow = usePaymentFlow(options)

    await flow.handlePayment()

    expect(flow.paymentErrorRef.value).toBe('boom')
    expect(flow.isProcessing.value).toBe(false)
    expect(options.isCompletingOrder.value).toBe(false)
    expect(options.finalize).not.toHaveBeenCalled()
  })

  it('连点：第一次还在途时第二次直接返回，不会发第二笔', async () => {
    const options = makeOptions()
    const flow = usePaymentFlow(options)

    // 故意不 await 第一次：isProcessing 是同步置位的
    const first = flow.handlePayment()
    const second = flow.handlePayment()
    await Promise.all([first, second])

    expect(mocks.createPaymentIntent).toHaveBeenCalledTimes(1)
    expect(options.finalize).toHaveBeenCalledTimes(1)
  })

  it('干净成功也把 isCompletingOrder 复位（它守护的是页面的空购物车 watcher）', async () => {
    const options = makeOptions()
    options.isCompletingOrder.value = true
    const flow = usePaymentFlow(options)

    await flow.handlePayment()

    // finalizeOrder 会把它置回 true 并保持到跳转完成；这里模拟的 finalize 没置位，
    // 所以只能断言 finally 确实碰了它 —— 复位是 finally 的职责，不是 finalize 的。
    expect(options.isCompletingOrder.value).toBe(false)
  })

  describe('3DS 回调', () => {
    /** 先走到 requires_action，让 pendingIntent 有值 —— on3dsComplete 依赖它 */
    async function reach3ds(options: UsePaymentFlowOptions) {
      mocks.confirmPayment.mockResolvedValue({
        status: 'requires_action',
        action: { transactionId: 'txn-1' },
      })
      const flow = usePaymentFlow(options)
      await flow.handlePayment()
      return flow
    }

    it('认证成功：completePaymentAction 后落单，并关掉弹窗、清空 pendingIntent', async () => {
      const options = makeOptions()
      const flow = await reach3ds(options)

      await flow.on3dsComplete()

      expect(mocks.completePaymentAction).toHaveBeenCalledWith({
        paymentId: 'p1',
        transactionId: 'txn-1',
      })
      expect(options.finalize).toHaveBeenCalledWith('o1')
      expect(flow.show3ds.value).toBe(false)
      expect(flow.pendingIntent.value).toBeNull()
    })

    it('认证后仍失败：退回支付步、不落单', async () => {
      const options = makeOptions()
      const flow = await reach3ds(options)
      mocks.completePaymentAction.mockResolvedValue({
        status: 'failed',
        errorCode: 'insufficient_funds',
      })

      await flow.on3dsComplete()

      expect(flow.paymentErrorRef.value).toBe('checkout.declinedInsufficient')
      expect(options.currentStep.value).toBe(1)
      expect(options.finalize).not.toHaveBeenCalled()
    })

    it('没有 pendingIntent 时是空操作（弹窗被重复回调不该炸）', async () => {
      const options = makeOptions()
      const flow = usePaymentFlow(options)

      await flow.on3dsComplete()

      expect(mocks.completePaymentAction).not.toHaveBeenCalled()
      expect(options.finalize).not.toHaveBeenCalled()
    })

    it('银行拒绝：写认证失败文案、退回支付步', () => {
      const options = makeOptions()
      const flow = usePaymentFlow(options)
      flow.show3ds.value = true

      flow.on3dsReject()

      expect(flow.paymentErrorRef.value).toBe('checkout.authFailed')
      expect(options.currentStep.value).toBe(1)
      expect(flow.show3ds.value).toBe(false)
    })

    it('用户主动关闭：只收弹窗，**不写错误**（放弃认证不是失败）', () => {
      const flow = usePaymentFlow(makeOptions())
      flow.show3ds.value = true

      flow.on3dsCancel()

      expect(flow.show3ds.value).toBe(false)
      expect(flow.paymentErrorRef.value).toBe('')
    })
  })

  describe('已保存卡（一键下单）', () => {
    const SAVED: SavedPaymentMethod = {
      id: 'm1',
      brand: 'Visa',
      last4: '4242',
      expMonth: '12',
      expYear: '30',
      createdAt: 1_700_000_000_000,
    }

    it('选中保存卡时走 token 扣款，不传卡号', async () => {
      const options = makeOptions()
      options.savedCard.value = SAVED
      const flow = usePaymentFlow(options)

      await flow.handlePayment()

      const confirmation = mocks.confirmPayment.mock.calls[0][0]
      expect(confirmation.savedMethodId).toBe('m1')
      expect(confirmation.cardLast4).toBe('4242')
      expect(confirmation).not.toHaveProperty('cardNumber')
    })

    it('没选保存卡时传卡号（去空格）与后四位', async () => {
      const options = makeOptions()
      const flow = usePaymentFlow(options)

      await flow.handlePayment()

      const confirmation = mocks.confirmPayment.mock.calls[0][0]
      expect(confirmation.cardNumber).toBe('4242424242424242')
      expect(confirmation.cardLast4).toBe('4242')
      expect(confirmation).not.toHaveProperty('savedMethodId')
    })
  })
})

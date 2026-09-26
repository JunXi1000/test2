import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { toErrorMessage } from '@/utils/error'
import {
  createPaymentIntent,
  confirmPayment,
  completePaymentAction,
  type SavedPaymentMethod,
} from '@/api/modules/payment'
import type { CartItem } from '@/stores/cart'

/**
 * 支付流程用到的收货信息子集。刻意不引 formData 的整体类型 —— 组合式只该声明它真正读的字段，
 * 页面往 formData 里加字段不该牵动这里。
 */
export interface PaymentShippingForm {
  firstName: string
  lastName: string
  address: string
  city: string
  zip: string
  country: string
  cardNumber: string
}

export interface UsePaymentFlowOptions {
  /** 结算行。金额不在这里算 —— payload 只传商品 id + 数量，价格由服务端按 DB 重算 */
  items: Ref<CartItem[]>
  formData: PaymentShippingForm
  /** 实付金额（已扣积分） */
  total: Ref<number>
  /** 选中的已保存卡；非空走 token 扣款并跳过卡号 */
  savedCard: Ref<SavedPaymentMethod | null>
  /** 步骤游标。网关拒付 / 3DS 失败时由本组合式置回 1（支付步） */
  currentStep: Ref<number>
  /**
   * 「落单中」标记，与 isProcessing 是一对。
   *
   * 为什么必须由页面持有、组合式只借用：它守的是**页面**那个 checkoutItems watcher
   * （见 Checkout.vue 里那段注释 —— 清空购物车会把页面重定向回 /cart）。而置位它的
   * finalizeOrder 留在页面里，因为建单、积分、清购物车、跳转是页面级编排，不是网关的事。
   * 两边都碰它，所以显式传进来，而不是让组合式自己造一个。
   */
  isCompletingOrder: Ref<boolean>
  /** 支付成功后的收尾（建单 → 积分 → 清购物车 → 跳 ThankYou）。留在页面，由这里回调 */
  finalize: (orderId: string) => Promise<void>
}

/**
 * 支付网关状态机：发起支付 → 成功 / 拒付重试 / 3DS 认证三条分支。
 *
 * 边界是「网关」而不是「下单」：`finalize`（落单 + 收尾）留在页面。这样组合式只依赖
 * 启动支付必需的四个值 + 一个回调，而不是把整页的 state 都拖进来。
 *
 * 顺带消掉了一处逐字重复：原先 handlePayment 与 on3dsComplete 各自抄了一份
 * 「拒付 → 写错误 → toast → 退回支付步」和一份 catch，只有变量名不同。
 */
export function usePaymentFlow(options: UsePaymentFlowOptions) {
  const { items, formData, total, savedCard, currentStep, isCompletingOrder, finalize } = options
  const { toast } = useToast()
  const { t } = useI18n()

  const isProcessing = ref(false)
  const paymentErrorRef = ref('')

  // ── 3DS 银行验证弹窗 ──
  const show3ds = ref(false)
  const pendingIntent = ref<{ paymentId: string; orderId: string } | null>(null)
  const last3dsTxn = ref('')

  /** 拒付错误码 → 本地化提示 */
  function paymentErrorMessage(code: string | undefined, fallback?: string) {
    switch (code) {
      case 'card_declined':
        return t('checkout.declinedCard')
      case 'insufficient_funds':
        return t('checkout.declinedInsufficient')
      default:
        return fallback || t('checkout.paymentNotCompleted')
    }
  }

  /** 网关**返回**失败（拒付/余额不足）：写错误、提示、退回支付步，允许改卡重试 */
  function settleGatewayFailure(code: string | undefined, message: string | undefined) {
    const msg = paymentErrorMessage(code, message)
    paymentErrorRef.value = msg
    toast({ title: t('checkout.paymentFailed'), description: msg, variant: 'destructive' })
    currentStep.value = 1
  }

  /** 请求**抛出**失败（网络/解析）：原因来自异常对象而非错误码 */
  function settleThrown(e: unknown) {
    paymentErrorRef.value = toErrorMessage(e, t('checkout.paymentFailedDesc'))
    toast({
      title: t('checkout.paymentFailed'),
      description: paymentErrorRef.value,
      variant: 'destructive',
    })
  }

  /**
   * 两次网关调用的共同外壳：捕获抛出 → 统一收尾，并在 finally 复位两个在途标记。
   *
   * 不在内部置 isProcessing —— 两个调用点的置位时机不同（handlePayment 先清 error 再置位，
   * on3dsComplete 只置位），把它挪进来会改变行为。调用方各自置位，这里只保证复位。
   */
  async function inFlight(fn: () => Promise<void>): Promise<void> {
    try {
      await fn()
    } catch (e) {
      settleThrown(e)
    } finally {
      isCompletingOrder.value = false
      isProcessing.value = false
    }
  }

  /** 发起支付：网关返回 requires_action 则转 3DS，failed 则退回支付步，否则直接落单 */
  const handlePayment = async () => {
    if (isProcessing.value) return
    paymentErrorRef.value = ''
    isProcessing.value = true

    await inFlight(async () => {
      const payload = {
        // 只传商品 id + 数量;金额由服务端按 DB 价格重算(/checkout/summary 已同源)
        items: items.value.map((it) => ({ productId: it.id, quantity: it.quantity })),
        amount: total.value,
        currency: 'USD',
        // 模拟银行卡网关;cartItemIds 让后端下单成功后清除对应购物车行(仅登录态有 serverId)
        channel: 'card',
        cartItemIds: items.value.map((it) => it.serverId).filter((id): id is number => !!id),
        shipping: {
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          address: formData.address,
          city: formData.city,
          zip: formData.zip,
          country: formData.country,
        },
      }
      const intent = await createPaymentIntent(payload)
      // 已选保存卡：以 token 扣款；否则走完整卡号网关路由
      const used = savedCard.value
      const digits = used ? '' : formData.cardNumber.replace(/\s/g, '')
      const result = await confirmPayment({
        paymentId: intent.paymentId,
        method: 'card',
        ...(used
          ? { savedMethodId: used.id, cardLast4: used.last4 }
          : { cardNumber: digits, cardLast4: digits.slice(-4) }),
      })

      if (result.status === 'requires_action') {
        // 3DS：打开银行验证弹窗，等待用户完成认证（流程在 on3dsComplete 继续）
        pendingIntent.value = { paymentId: intent.paymentId, orderId: intent.orderId }
        last3dsTxn.value = result.action?.transactionId || ''
        show3ds.value = true
        return
      }

      if (result.status === 'failed') {
        settleGatewayFailure(result.errorCode, result.errorMessage)
        return
      }

      await finalize(result.orderId || intent.orderId)
    })
  }

  /** 3DS 认证成功：银行回调确认后完成下单 */
  const on3dsComplete = async () => {
    const intent = pendingIntent.value
    const txn = last3dsTxn.value
    pendingIntent.value = null
    show3ds.value = false
    if (!intent) return
    isProcessing.value = true

    await inFlight(async () => {
      const res = await completePaymentAction({
        paymentId: intent.paymentId,
        transactionId: txn,
      })
      if (res.status === 'failed') {
        settleGatewayFailure(res.errorCode, res.errorMessage)
        return
      }
      await finalize(res.orderId || intent.orderId)
    })
  }

  /** 3DS 认证失败（银行拒绝） */
  const on3dsReject = () => {
    pendingIntent.value = null
    show3ds.value = false
    paymentErrorRef.value = t('checkout.authFailed')
    toast({
      title: t('checkout.paymentFailed'),
      description: paymentErrorRef.value,
      variant: 'destructive',
    })
    currentStep.value = 1
  }

  /** 用户主动关闭 3DS 弹窗：放弃认证，留在当前步骤，可重新发起支付 */
  const on3dsCancel = () => {
    pendingIntent.value = null
    show3ds.value = false
  }

  return {
    isProcessing,
    paymentErrorRef,
    show3ds,
    pendingIntent,
    last3dsTxn,
    handlePayment,
    on3dsComplete,
    on3dsReject,
    on3dsCancel,
  }
}

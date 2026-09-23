import { computed, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { useAsyncTask } from '@/composables/useAsyncTask'
import { toErrorMessage } from '@/utils/error'
import { useAuthStore } from '@/stores/auth'
import { useLoyaltyStore } from '@/stores/loyalty'
import { calculateOrderSummary, applyPromoCode, type OrderSummary } from '@/api/modules/checkout'
import { POINTS_PER_DOLLAR } from '@/api/modules/loyalty'
import type { CartItem } from '@/stores/cart'

export interface UseOrderSummaryOptions {
  /** 结算行。金额不由前端算 —— 传给 `calculateOrderSummary` 由服务端同源口径计算 */
  items: Ref<CartItem[]>
  /**
   * 邮编影响运费与税率。**用 getter 而不是值**：一是取数时才读（用户改邮编要重算），
   * 二是 `formData` 是 reactive 不是 ref，传值就断了响应性。
   */
  getZip: () => string
}

/**
 * 订单摘要：服务端算的小计/运费/税 + 手动优惠码 + 积分抵扣，三者叠加出实付金额。
 *
 * 三层折扣的口径（别合并）：
 *   summary.discount —— 后端/mock 算的满减自动折扣
 *   promoDiscount    —— 手动优惠码，**可与之叠加**
 *   pointsDiscount   —— 积分抵扣，100 分 = $1，向下取整
 *
 * 注意 `total` 与 `summary.total` 不是一回事：前者扣掉积分，后者是后端给的未扣积分金额。
 * 页面的支付 payload 与 finalizeOrder 用的都是 `total`。
 */
export function useOrderSummary(options: UseOrderSummaryOptions) {
  const { items, getZip } = options
  const { t } = useI18n()
  const { toast } = useToast()
  const authStore = useAuthStore()
  const loyaltyStore = useLoyaltyStore()

  // ── 摘要与优惠码 ──
  const summary = ref<OrderSummary>({ subtotal: 0, shipping: 0, tax: 0, discount: 0, total: 0 })
  const promoCode = ref('')
  const promoApplied = ref(false)
  const promoDiscount = ref(0)
  const tieredDiscount = computed(() => summary.value.discount)

  // ── 积分抵扣 ──
  /** 未使用积分前的应付金额（subtotal + shipping + tax - 满减 - 优惠码） */
  const prePointsTotal = computed(
    () =>
      +(
        summary.value.subtotal +
        summary.value.shipping +
        summary.value.tax -
        summary.value.discount -
        promoDiscount.value
      ).toFixed(2),
  )
  const pointsToUse = ref(0)
  /** 100 积分 = $1，向下取整 */
  const pointsDiscount = computed(() => Math.floor(pointsToUse.value / POINTS_PER_DOLLAR))
  /** 最大可用积分：不超过余额，且抵扣额不超过应付金额 */
  const maxPointsToUse = computed(() => {
    if (!authStore.isAuthenticated) return 0
    const byOrder = Math.floor(Math.max(0, prePointsTotal.value) * POINTS_PER_DOLLAR)
    return Math.min(loyaltyStore.state.points, byOrder)
  })
  const pointsUsable = computed(
    () => authStore.isAuthenticated && loyaltyStore.state.points >= POINTS_PER_DOLLAR,
  )

  // 夹逼在输入处做，而不是在计算处：用户在输入框里手打超出余额的数字时，
  // 要看到它被改掉（而不是显示一个和实际抵扣不一致的值）。
  watch(pointsToUse, (v) => {
    if (!v) {
      pointsToUse.value = 0
      return
    }
    let next = v
    if (next > maxPointsToUse.value) next = maxPointsToUse.value
    next = Math.floor(next / POINTS_PER_DOLLAR) * POINTS_PER_DOLLAR
    if (next !== v) pointsToUse.value = next
  })

  const total = computed(() => +(prePointsTotal.value - pointsDiscount.value).toFixed(2))

  // ── 取数 ──
  const { isLoading, error, run } = useAsyncTask({
    fallbackMessage: t('checkout.calcFailedDesc'),
    initialLoading: true,
  })

  async function fetchSummary() {
    const result = await run(() => calculateOrderSummary(items.value, getZip()))
    if (result.ok) {
      summary.value = result.value
    } else {
      // useAsyncTask 默认 reportError，所以这里 toast 的同时 error ref 也被写上了，
      // 右栏那个 ErrorState（带「重试」）由此渲染 —— 两者是配套的，不是二选一。
      toast({ title: t('checkout.calcFailed'), description: result.error, variant: 'destructive' })
    }
  }

  async function applyPromo() {
    const code = promoCode.value.trim()
    if (!code) {
      toast({
        title: t('cart.enterCode'),
        description: t('cart.enterCodeDesc'),
        variant: 'destructive',
      })
      return
    }
    if (promoApplied.value) {
      toast({
        title: t('cart.alreadyApplied'),
        description: t('checkout.alreadyAppliedDesc'),
        variant: 'destructive',
      })
      return
    }
    try {
      const { discount } = await applyPromoCode(code, summary.value.subtotal)
      if (discount <= 0) {
        toast({
          title: t('cart.invalidCode'),
          description: t('cart.invalidCodeDesc'),
          variant: 'destructive',
        })
        return
      }
      promoApplied.value = true
      promoDiscount.value = discount
      toast({
        title: t('cart.promoApplied'),
        description: t('cart.promoAppliedDesc', { discount: discount.toFixed(2) }),
        variant: 'success',
      })
    } catch (e) {
      toast({
        title: t('cart.invalidCode'),
        description: toErrorMessage(e, t('cart.tryAnotherCode')),
        variant: 'destructive',
      })
    }
  }

  function removePromo() {
    promoApplied.value = false
    promoDiscount.value = 0
    promoCode.value = ''
    toast({ title: t('cart.promoRemoved'), description: t('cart.promoRemovedDesc') })
  }

  return {
    summary,
    isLoading,
    error,
    fetchSummary,
    promoCode,
    promoApplied,
    promoDiscount,
    tieredDiscount,
    pointsToUse,
    pointsUsable,
    maxPointsToUse,
    pointsDiscount,
    prePointsTotal,
    total,
    applyPromo,
    removePromo,
  }
}

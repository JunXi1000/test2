import { computed, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { useAsyncTask } from '@/composables/useAsyncTask'
import { usePromoCode } from '@/composables/usePromoCode'
import { calculateOrderSummary, type OrderSummary } from '@/api/modules/checkout'
// amount() 与购物车页**共用同一个函数**：应付额的口径不允许有两份"看起来一样"的实现
// （BLK-4 / BLK-E1 都是副本漂移出来的），见 utils/amount.ts 的注释
import { amount } from '@/utils/amount'
import type { CartItem } from '@/stores/cart'

export interface UseOrderSummaryOptions {
  /** 结算行。金额不由前端算 —— 传给 `calculateOrderSummary` 由服务端同源口径计算 */
  items: Ref<CartItem[]>
  /**
   * 邮编影响运费与税率。**用 getter 而不是值**：一是取数时才读（用户改邮编要重算），
   * 二是 `formData` 是 reactive 不是 ref，传值就断了响应性。
   */
  getZip: () => string
  /**
   * 要发给 `/checkout/summary` 的优惠码：**只有已生效的码**，否则空串。
   *
   * 用 getter 而不是值：取数时（含重试）读「此刻」的码，避免闭包里留个过期快照。
   * 摘要收到码才会返回真实减免；这也是 `summary.total == /payments/create 的 amount`
   * 的前提（同一个码发两处，见 Checkout.vue 与 usePaymentFlow）。
   */
  getCode: () => string
  /**
   * items 变化触发重取时的**额外闸门**（默认恒真，即"只要 items 变了就重取"）。
   *
   * 结算页在**落单收尾**期间传 `() => !isCompletingOrder.value`：那时清空购物车 / 清掉
   * directBuyItem 不是"用户改了订单"，不该再发一次摘要请求（直接购买模式下 `checkoutItems`
   * 会回落到购物车，否则会白跑一次）。
   */
  shouldRefetch?: () => boolean
}

/**
 * 订单摘要：**应付总额只消费服务端权威值** `summary.total`。
 *
 * 口径只有一层（别再加回去）：
 *   summary.discount —— 服务端按已生效的 `code` 核销出的减免
 *   summary.total    —— 服务端算的应付额（= subtotal − discount）
 *
 * ⚠️ **积分已退出应付口径**（2026-10-01，BLK-E1 —— 与 BLK-4 同形的资损缺陷，
 * 只是通道从「券」换成了「积分」）：后端 `src/main` 里**没有任何积分/抵扣概念**
 * （`StorefrontCheckoutDTO` 只有 `code`，`ProductOrderServiceImpl` 只按 `code` 核销），
 * 也就是说积分在扣款侧根本不存在。旧代码 `total = subtotal − discount − pointsDiscount`
 * 会让**页面显示额低于实际扣款**。现在积分不参与任何一步算术，UI 入口也随之下线
 * （见 `pages/Checkout.vue`，并在那里说明理由）。
 *
 * ⚠️ `/checkout/promo` 的只读回包（`promoDiscount`）同样**不进算术**：它与
 * `summary.discount` 是同一笔券优惠的两个来源，加两次就是 BLK-4。
 */
export function useOrderSummary(options: UseOrderSummaryOptions) {
  const { items, getZip, getCode, shouldRefetch } = options
  const { t } = useI18n()
  const { toast } = useToast()

  // ── 摘要与优惠码 ──
  const summary = ref<OrderSummary>({ subtotal: 0, shipping: 0, tax: 0, discount: 0, total: 0 })
  // 优惠码的输入/校验/应用整块交给 usePromoCode（与购物车页共用）。这里只喂三个参数：
  // 小计从摘要取，「已应用」那句用结算页自己的文案，`onApplied` 让摘要在码生效/移除/失效后重取。
  const { promoCode, promoApplied, promoDiscount, applyPromo, removePromo } = usePromoCode({
    getSubtotal: () => summary.value.subtotal,
    alreadyAppliedDesc: t('checkout.alreadyAppliedDesc'),
    // fetchSummary 是函数声明，这里只是引用 —— 真正调用发生在应用成功之后
    onApplied: () => fetchSummary(),
  })
  /**
   * 服务端算出的减免，也是**唯一**要展示/参与算术的减免：后端收到 code 后已把它算进
   * `subtotal - discount`。名字里保留 tiered 是历史叫法（满减档位已移出契约，
   * 现在这里既可能来自券，也可能为空），模板改用它而不是 `promoDiscount`，
   * 否则页面会把同一笔减免展示两次、金额也要被减两次（BLK-4）。
   */
  const tieredDiscount = computed(() => summary.value.discount)
  /** 命中的券码（服务端回的）。输入框里的码没生效时不该冒充「已应用」 */
  const appliedDiscountCode = computed(() => summary.value.discountCode || '')

  /**
   * 应付总额 —— **只消费服务端给的 `summary.total`**，前端不再自己算一步。
   *
   * 这是 BLK-E1 的修复点。旧实现在这里做 `subtotal − discount − pointsDiscount`，
   * 而服务端只认「subtotal − 券减免」⇒ 用了积分就比实扣少。
   * 现在无论页面上发生什么（改邮编、试券、看积分余额），这个数都只来自最近一次
   * `/checkout/summary` 的回包 —— 与 `POST /payments/create` 的 amount 真正同源。
   *
   * 刻意**没有**任何 fallback 算式：连 `subtotal − discount` 这种"看起来一样"的兜底都不写，
   * 因为那正是两条口径重新分叉的入口。`amount()` 只把「字段缺失/NaN」折成 0；
   * 契约里 `total` 是必填字段，后端控制器无条件返回（`StorefrontCheckoutController:107-113`）。
   */
  const total = computed(() => amount(summary.value.total))

  // ── 取数 ──
  const { isLoading, error, run } = useAsyncTask({
    fallbackMessage: t('checkout.calcFailedDesc'),
    initialLoading: true,
  })

  /**
   * 只接受**最新一次**请求的结果。
   *
   * 为什么需要：`items` 一变就会重取（见下面的 watcher），而两次重取的响应**可能乱序到达**
   * （慢的那次后到）。若不设防，旧 items 算出的金额会覆盖新值 —— 又是"显示额 ≠ 实扣"
   * 的一种形状。这里用单调递增的序号把过期响应丢掉。
   */
  let fetchSeq = 0

  async function fetchSummary() {
    const seq = ++fetchSeq
    const result = await run(() => calculateOrderSummary(items.value, getZip(), getCode()))
    // 期间又发起了更新的请求 ⇒ 这次的结果已经过期，丢弃（连 toast 都不发，否则会误导）
    if (seq !== fetchSeq) return
    if (result.ok) {
      summary.value = result.value
    } else {
      // useAsyncTask 默认 reportError，所以这里 toast 的同时 error ref 也被写上了，
      // 右栏那个 ErrorState（带「重试」）由此渲染 —— 两者是配套的，不是二选一。
      toast({ title: t('checkout.calcFailed'), description: result.error, variant: 'destructive' })
    }
  }

  /**
   * **items 一变就重取摘要**（G1d / BLK-I1）。
   *
   * 缺陷形状：结算页内的「Complete the Look → Add to Order」会往购物车加商品
   * （`useCompleteTheLook.addSelected` → `cartStore.addItem`），但摘要是挂载时取的那一次 ——
   * 于是右栏「应付总额」还是旧 items 的值，而下单时服务端按**新** items 重算 ⇒ 显示额 ≠ 实扣。
   * 这是 BLK-4（券）→ BLK-E1（积分）→ BLK-I1（items 未同步）同一条线上的第三处。
   *
   * 为什么用 `watch` 而不是在每个动作后手写一次 `fetchSummary()`：触发点应该是**数据**
   * （items）而不是**动作**（今天只有"加购"一处，明天可能多出改数量/删除行）。绑在数据上
   * 等于按根因关掉这一类；绑在动作上要每次记得补一行 —— 那正是 BLK-I1 的成因。
   *
   * 为什么盯 `pricingSignature` 而不是 `{ deep: true }`：
   * - **避免重复请求**：真实后端 + 登录态时，每次改购物车都会 `syncAfterMutation`
   *   → 服务端回拉 → 用权威列表**整体替换** items（`stores/cart.ts` 的 `syncFromServer`）。
   *   深比较会为同一次用户动作看到两次变化（本地乐观改 + 回拉替换），发两次请求，
   *   而两次的金额构成完全一样。只盯"影响金额的字段"，回拉那次不产生新信号 ⇒ 一次动作一次请求。
   * - **不漏**：行 id / 数量 / 单价任何一个变了都会重取（新增行、删行、改数量、服务端改价）。
   *   ⚠️ 将来若出现**其它**影响明细金额的字段（如变体加价），必须加进这个签名，否则会漏重取。
   * - 颜色/尺码这类不影响价格的改动不再白跑一次请求。
   *
   * 两道闸门：
   * - 空车跳过：没有商品就没有摘要可算（真实后端对空 items 返回 400），而清空购物车正是
   *   **落单收尾**（`finalizeOrder` → `clearCart`）会做的事 —— 那时发请求只会在跳 ThankYou
   *   的路上弹一个假的"计算失败"。
   * - `shouldRefetch()`（页面传 `() => !isCompletingOrder.value`）：直接购买模式落单后
   *   `checkoutItems` 会回落到购物车，清掉 directBuyItem 并不是"用户改了订单"，不该重取。
   */
  const pricingSignature = computed(() =>
    items.value.map((it) => `${it.id}:${it.quantity}:${it.price}`).join('|'),
  )
  watch(pricingSignature, () => {
    if (!items.value.length) return
    if (shouldRefetch && !shouldRefetch()) return
    fetchSummary()
  })

  return {
    summary,
    isLoading,
    error,
    fetchSummary,
    promoCode,
    promoApplied,
    /**
     * 「已省 $X」那条 toast 的来源（`/checkout/promo` 的只读回包）。
     *
     * ⚠️ **不参与算术、不进模板**：减免的权威值是 `summary.discount`（后端收到同一个 code
     * 后算出的同一笔），把它再减一次就是 BLK-4 的「显示额低于实扣」。
     * 保留在返回值里只是为了单测能验证「promo 回包不再影响 total」。
     */
    promoDiscount,
    /** 服务端权威减免（= summary.discount），也是唯一参与算术的减免 */
    tieredDiscount,
    /** 服务端确认命中的券码 */
    appliedDiscountCode,
    /**
     * 应付总额 = 服务端 `summary.total`（BLK-E1 的修复点：前端不再自算一步）。
     * 支付 payload 与 finalizeOrder 都用它，所以「页面显示额 == 实扣」是结构性的。
     */
    total,
    applyPromo,
    removePromo,
  }
}

import { computed, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAsyncTask } from '@/composables/useAsyncTask'
import { useAuthStore } from '@/stores/auth'
import { calculateOrderSummary, type OrderSummary } from '@/api/modules/checkout'
// 与结算页共用同一个 amount()：应付额的口径不允许有两份实现（G1c / BLK-E1 的教训）
import { amount } from '@/utils/amount'
import type { CartItem } from '@/stores/cart'

export interface UseCartSummaryOptions {
  /** 购物车行。金额不由前端算 —— 一律交给 `/checkout/summary`（与结算页同一来源） */
  items: Ref<CartItem[]>
  /**
   * 要带上的优惠码（**已生效**的那个，否则空串）；与结算页的 `getCode` 同形。
   *
   * 只在 `items` 变化触发**自动重取**时被用到。为什么必须有：购物车改了数量/删了行之后
   * 若不带码重取，摘要会从「带券」换回「不带券」，右栏总额凭空反弹 —— 又是显示与实扣分叉。
   */
  getCode?: () => string
}

/**
 * 购物车页的金额口径。
 *
 * **为什么单独一个小组合式，而不是直接用 `useOrderSummary`**：购物车与结算页的差异不在
 * 算法（都走 `calculateOrderSummary` → `/checkout/summary`），而在**鉴权**：
 *
 * ⚠️ **匿名不发请求**。本轮契约把 `/checkout/summary` 移出白名单（C0），匿名调用会 401，
 * 而 `http.ts` 的 401 拦截器会**清 token + 跳登录页** —— 匿名用户只是看了一眼购物车就被
 * 弹去登录，不可接受。所以未登录时 `enabled` 为 false，页面只展示本地小计（纯
 * `Σ 单价×数量`，不含运费/税/满减，不构成第二套业务口径），并说明登录后才看得到应付总额。
 *
 * 于是「购物车 689.52 ≠ 实扣 694.00」（BLK-5）在两种状态下都消失：登录态取的是与结算页
 * 同一个接口的同一个数，匿名态干脆不给一个假的应付总额。
 */
export function useCartSummary(options: UseCartSummaryOptions) {
  const { items } = options
  const { t } = useI18n()
  const authStore = useAuthStore()

  const summary = ref<OrderSummary>({ subtotal: 0, discount: 0, total: 0 })
  /** 是否已经拿到过服务端摘要（决定总额用小计来源：服务端还是本地镜像） */
  const serverLoaded = ref(false)

  /**
   * 本地小计仅供**匿名展示**与「服务端还没回来」的兜底：真实分支的 `/checkout/summary`
   * 也是「DB 价 × 数量」之和，所以它不是自算的业务口径，只是同一个量在拿不到回包时的镜像。
   */
  const localSubtotal = computed(() =>
    items.value.reduce((s, it) => s + it.price * it.quantity, 0),
  )
  /** 服务端权威小计（拿到回包前为 0） */
  const serverSubtotal = computed(() => summary.value.subtotal || 0)
  /** 小计展示值：有回包用回包，没有用本地镜像（两者的定义是同一个） */
  const subtotal = computed(() => (serverLoaded.value ? serverSubtotal.value : localSubtotal.value))
  /** 服务端权威减免（按 code 核销出的券优惠）。匿名/未回包时没有减免 */
  const discount = computed(() => summary.value.discount || 0)
  /**
   * 应付总额 —— **只消费服务端给的 `summary.total`**，与结算页（`useOrderSummary.ts:87`）
   * 同源同形（共用 `@/utils/amount`），**刻意不写任何 fallback**。
   *
   * G1c：这里曾经是 `serverSubtotal − discount`。它当时与服务端 `total` 恒等
   * （后端没有第三层折扣，且把 discount 封顶在 subtotal），所以**没有用户可见缺陷** ——
   * 但它就是"应付额由客户端自算一份"的形态，与 BLK-4（券）、BLK-E1（积分）**同类**。
   * 那一类已经复发过两次，所以按根因消灭：应付额只有服务端一个来源。
   *
   * 连 `subtotal − discount` 这种"看起来一样"的兜底也不写 —— fallback 正是口径重新
   * 分叉的入口。`amount()` 只把「字段缺失/NaN」折成 0（契约里 `total` 必填，
   * 后端控制器无条件返回：`StorefrontCheckoutController:107-113`）。
   */
  const total = computed(() => amount(summary.value.total))
  /** 是否可以取服务端摘要：未登录时不取（401 会被全局拦截器当成会话失效） */
  const enabled = computed(() => authStore.isAuthenticated)

  const { isLoading, error, run, reset } = useAsyncTask({
    fallbackMessage: t('checkout.calcFailedDesc'),
    /**
     * 首帧就渲染骨架屏：取数发生在 onMounted，晚于首屏渲染，初值 false 会先闪出「0 元」
     * 再被顶掉。模板里只在 `enabled` 为真时才用这个标志（匿名永远不取数，否则骨架屏不消失）。
     */
    initialLoading: true,
  })

  /** 只接受最新一次请求的结果：并发重取时旧响应可能后到，覆盖新值（同 useOrderSummary） */
  let fetchSeq = 0

  /** 取摘要。`code` 默认取已生效的码（`getCode`），页面显式传入时以参数为准 */
  async function fetchSummary(code = options.getCode?.() ?? '') {
    const seq = ++fetchSeq
    // zip 传空串而不是 undefined：购物车没有邮编概念，但请求形状必须与结算页一致
    // （都是 `{items, zip, code}`）—— 否则两个调用点发不同的 body（MIN-E2）。
    const result = await run(() => calculateOrderSummary(items.value, '', code))
    if (seq !== fetchSeq) return // 期间又发起了更新的请求 ⇒ 这次结果已过期
    if (result.ok) {
      summary.value = result.value
      serverLoaded.value = true
    }
    // 失败：useAsyncTask 默认 reportError，error ref 已被写入；页面渲染 ErrorState + 重试
  }

  /**
   * **items 一变就重取摘要**（G1d —— 结算页 BLK-I1 的购物车版本）。
   *
   * 购物车页同样会改 items：数量 +/-（`updateQuantity`，**原地**改 quantity）、删除行
   * （`removeItem`，换数组）、清空（`clearCart`）、编辑规格（`updateItemOptions`）。
   * 没有这个 watcher 时，一旦取到过回包（`serverLoaded === true`），右栏金额会一直停在
   * 第一次取数的值。
   *
   * 盯 `pricingSignature`（行 id / 数量 / 单价）而不是 `{ deep: true }`：真实后端 + 登录态下
   * 每次改动都会 `syncAfterMutation` → 服务端回拉并**整体替换** items，深比较会为同一次
   * 用户动作看到两次变化而发两次请求。只盯影响金额的字段 ⇒ 一次动作一次请求，
   * 且新增/删除/改数量/服务端改价仍然都会重取。
   *
   * 空车跳过：没有商品就没有摘要可算（真实后端对空 items 返回 400），且模板在空车时
   * 走 EmptyState、不渲染金额。
   */
  const pricingSignature = computed(() =>
    items.value.map((it) => `${it.id}:${it.quantity}:${it.price}`).join('|'),
  )
  watch(pricingSignature, () => {
    if (!items.value.length) return
    fetchSummary()
  })

  /** 退出登录 / 清空购物车后复位，避免残留上一个会话的金额 */
  function resetSummary() {
    summary.value = { subtotal: 0, discount: 0, total: 0 }
    serverLoaded.value = false
    reset()
  }

  return {
    /**
     * 只暴露**已收敛判据**的值（G1b / MIN-E1）：小计的唯一判据在 `subtotal` 里
     * （serverLoaded ? 服务端 : 本地镜像），不再把 `serverSubtotal` 一起放出去 ——
     * 多放一个"服务端小计"，消费方就又会写出 `serverSubtotal || local` 这种第二条判据。
     */
    enabled,
    isLoading,
    error,
    subtotal,
    discount,
    total,
    fetchSummary,
    resetSummary,
  }
}

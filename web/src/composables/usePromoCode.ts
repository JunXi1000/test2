import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { toErrorMessage } from '@/utils/error'
import { applyPromoCode } from '@/api/modules/checkout'

export interface UsePromoCodeOptions {
  /**
   * 当前小计。用 getter 而不是值 —— 购物车会变，折扣要按「此刻」的小计算。
   */
  getSubtotal: () => number
  /**
   * 「已经有一个码生效」时的说明文案。
   *
   * **刻意做成参数而不是在这里写死**：购物车与结算页的这句话本来就不一样
   * （`cart.alreadyAppliedDesc` 是"先移除它"，`checkout.alreadyAppliedDesc` 是
   * "移除当前的码再应用另一个"）。统一文案是**用户可见的改变**，不该混在结构重构里。
   */
  alreadyAppliedDesc: string
  /**
   * 生效状态变化时回调（应用成功 / 移除 / 因输入被改写而失效）。
   *
   * 存在的理由：折扣额由**服务端摘要**给出（`/checkout/summary` 收到 code 才算），
   * 所以「应用成功」必须触发一次摘要重取。有了这个回调，`useOrderSummary` /
   * 购物车就不必各自 `watch(promoApplied)` —— 两边 watch 会漏掉「移除」那一半。
   */
  onApplied?: () => void
}

/**
 * 促销码的输入 → 校验 → 应用 → 移除。购物车页与结算页共用。
 *
 * 抽出来的原因不是"长得像"，是**两处逐字重复了同一套分支**：空码、已应用、折扣为 0、
 * 请求抛出，四条分支的提示文案与顺序完全一致，只有小计来源与折扣存哪儿不同。
 *
 * ⚠️ 口径变更（2026-10-01，BLK-4）：这里的 `promoDiscount` 只是 `/checkout/promo`
 * 的**只读回包**（用于「You saved $X」的 toast），**不再**与 `summary.discount` 叠加 ——
 * 后端在 `/checkout/summary` 收到同一个 code 时会算出同一笔减免，两边相加就是减两次。
 * 页面展示与应付金额一律取 `summary.discount`：本组合式通过 `onApplied` 触发摘要重取。
 */
export function usePromoCode(options: UsePromoCodeOptions) {
  const { getSubtotal, alreadyAppliedDesc, onApplied } = options
  const { t } = useI18n()
  const { toast } = useToast()

  const promoCode = ref('')
  const promoApplied = ref(false)
  const promoDiscount = ref(0)
  /**
   * 真正生效的那个码（已 trim）。它的唯一用途是**不变式检查**：
   * `promoApplied` 为真时，输入框必须仍然等于它，否则状态作废。
   *
   * 为什么必须有：付款时发出去的 code 取自输入框。用户在「已应用」状态下改动输入框
   * （比如把 SAVE10 改成 SAVE20 却没点 Apply），若状态不重置，页面会继续显示旧的
   * 10 元减免，而后端按 SAVE20 核销 —— 又一处「显示额 ≠ 实扣」。宁可让用户重按 Apply。
   */
  const appliedCode = ref('')

  /**
   * 输入偏离已生效的码 → **只作废生效状态**，并回调一次让上层按「无码」重取摘要。
   *
   * ⚠️ 这里**绝不能**调 `reset()`：`reset()` 会连 `promoCode`（输入框的值）一起清空，
   * 而触发本 watcher 的正是用户在输入框里打字 —— 清空等于把用户刚敲的字符吞掉。
   * 2026-10-01（G1b / D-2）实测到的就是这条：已应用 SAVE10 后把输入改成 SAVE20，
   * 输入框被清成空串（vitest: `expected '' to be 'SAVE20'`），与"让用户重按 Apply"的意图相反。
   *
   * 只有 `removePromo()` / 清空购物车这类**用户显式移除**的动作才该清输入。
   */
  watch(promoCode, (v) => {
    if (!promoApplied.value) return
    if (v.trim() === appliedCode.value) return
    promoDiscount.value = 0
    promoApplied.value = false
    appliedCode.value = ''
    onApplied?.()
  })

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
        description: alreadyAppliedDesc,
        variant: 'destructive',
      })
      return
    }
    try {
      const result = await applyPromoCode(code, getSubtotal())
      if (result.discount <= 0) {
        toast({
          title: t('cart.invalidCode'),
          description: t('cart.invalidCodeDesc'),
          variant: 'destructive',
        })
        return
      }
      promoDiscount.value = result.discount
      appliedCode.value = code
      promoApplied.value = true
      // 折扣额由服务端摘要复核（summary 也收到同一个 code），必须重取
      onApplied?.()
      toast({
        title: t('cart.promoApplied'),
        description: t('cart.promoAppliedDesc', { discount: result.discount.toFixed(2) }),
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

  /** 用户主动移除：清状态并提示 */
  function removePromo() {
    reset()
    onApplied?.()
    toast({ title: t('cart.promoRemoved'), description: t('cart.promoRemovedDesc') })
  }

  /** 只清状态不提示 —— 清空购物车这类"顺带复位"的场合用 */
  function reset() {
    promoDiscount.value = 0
    promoApplied.value = false
    promoCode.value = ''
    appliedCode.value = ''
  }

  return { promoCode, promoApplied, promoDiscount, applyPromo, removePromo, reset }
}

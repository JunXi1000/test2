import { ref } from 'vue'
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
}

/**
 * 促销码的输入 → 校验 → 应用 → 移除。购物车页与结算页共用。
 *
 * 抽出来的原因不是"长得像"，是**两处逐字重复了同一套分支**：空码、已应用、折扣为 0、
 * 请求抛出，四条分支的提示文案与顺序完全一致，只有小计来源与折扣存哪儿不同。
 *
 * 注意 `promoDiscount`（本组合式）与后端/满减的 `summary.discount` 是两回事，**可叠加** ——
 * 那是阶梯折扣，这是手动优惠码。
 */
export function usePromoCode(options: UsePromoCodeOptions) {
  const { getSubtotal, alreadyAppliedDesc } = options
  const { t } = useI18n()
  const { toast } = useToast()

  const promoCode = ref('')
  const promoApplied = ref(false)
  const promoDiscount = ref(0)

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
      promoApplied.value = true
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
    toast({ title: t('cart.promoRemoved'), description: t('cart.promoRemovedDesc') })
  }

  /** 只清状态不提示 —— 清空购物车这类"顺带复位"的场合用 */
  function reset() {
    promoDiscount.value = 0
    promoApplied.value = false
    promoCode.value = ''
  }

  return { promoCode, promoApplied, promoDiscount, applyPromo, removePromo, reset }
}

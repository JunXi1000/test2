import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import {
  getSavedPaymentMethods,
  deleteSavedPaymentMethod,
  type SavedPaymentMethod,
} from '@/api/modules/payment'

/**
 * 已保存的支付方式（阶段 2.2）：token 化保存 → 下次一键下单。
 *
 * **按用户作用域隔离**：guest 不展示任何已存卡，也不允许保存（`scope` 为空即整块禁用）。
 * 这个 scope 就是 userId —— 换账号登录时旧卡不会漏出来。
 *
 * 注意保存（`savePaymentMethod`）不在这个组合式里：它发生在支付成功后的收尾流程中，
 * 由页面的 finalizeOrder 调用。这里只管「读 / 选 / 删」。
 *
 * 不接参数 —— authStore 是全局 store，直接 import。
 */
export function useSavedCards() {
  const { t } = useI18n()
  const { toast } = useToast()
  const authStore = useAuthStore()

  const savedCards = ref<SavedPaymentMethod[]>([])
  const selectedSavedCardId = ref('')
  const saveCardForNextTime = ref(false)

  /** 已保存卡按用户作用域隔离（guest 不展示，仅登录用户可保存/一键下单） */
  function savedCardsScope() {
    return authStore.user?.id ?? ''
  }

  function loadSavedCards() {
    const scope = savedCardsScope()
    savedCards.value = scope ? getSavedPaymentMethods(scope) : []
  }

  function isUsingSavedCard() {
    return !!selectedSavedCardId.value
  }

  /** 当前选中的已保存卡（用于展示与一键下单） */
  const selectedSavedCard = computed(
    () => savedCards.value.find((c) => c.id === selectedSavedCardId.value) ?? null,
  )

  /** 再点一次已选中的卡即取消选中（回到填卡表单） */
  function selectSavedCard(id: string) {
    selectedSavedCardId.value = selectedSavedCardId.value === id ? '' : id
  }

  function removeSavedCard(id: string) {
    const scope = savedCardsScope()
    if (!scope) return
    deleteSavedPaymentMethod(scope, id)
    savedCards.value = savedCards.value.filter((m) => m.id !== id)
    // 删掉的正是当前选中的那张时，要一并取消选中，否则会拿着一张已不存在的卡去支付
    if (selectedSavedCardId.value === id) selectedSavedCardId.value = ''
    toast({ title: t('checkout.savedCardRemoved'), variant: 'success' })
  }

  return {
    savedCards,
    selectedSavedCardId,
    saveCardForNextTime,
    loadSavedCards,
    isUsingSavedCard,
    selectedSavedCard,
    selectSavedCard,
    removeSavedCard,
  }
}

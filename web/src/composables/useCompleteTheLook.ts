import { computed, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { useCartStore } from '@/stores/cart'
import { getCompleteTheLook } from '@/api/modules/product'
import type { Product } from '@/types/product'
import type { CartItem } from '@/stores/cart'

export interface UseCompleteTheLookOptions {
  /** 结算行。推荐以**第一件**商品为种子（后端按它找搭配） */
  items: Ref<CartItem[]>
  /** 一次拉几件。默认 3，与抽取前的调用点一致 */
  limit?: number
}

/**
 * 结算页的「Complete the Look」追加购买推荐。
 *
 * 三个状态（products / selected / adding）本来就是一组 —— 选中集默认**全选**，
 * 因为推荐位的意图是「这几件一起买」，让用户取消而不是逐件勾。
 *
 * 只在页面级持有状态，不碰路由；失败就静默清空（推荐位拉不到不该干扰结算主流程）。
 */
export function useCompleteTheLook(options: UseCompleteTheLookOptions) {
  const { items, limit = 3 } = options
  const { t } = useI18n()
  const { toast } = useToast()
  const cartStore = useCartStore()

  const products = ref<Product[]>([])
  const selected = ref<Set<number>>(new Set())
  const loading = ref(false)
  const adding = ref(false)

  const selectedCount = computed(
    () => products.value.filter((p) => selected.value.has(p.id)).length,
  )

  async function load() {
    const first = items.value[0]
    if (!first) return
    loading.value = true
    try {
      const recommended = await getCompleteTheLook(Number(first.id), limit)
      products.value = recommended
      // 默认全选
      selected.value = new Set(recommended.map((p) => p.id))
    } catch {
      // 推荐位拉不到就空着 —— 它不该让结算页显示错误态
      products.value = []
    } finally {
      loading.value = false
    }
  }

  /** 整块替换 Set 而不是原地增删：模板里 `selected.has(p.id)` 的读取靠引用变化触发 */
  function toggle(id: number) {
    const next = new Set(selected.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selected.value = next
  }

  /** 把选中的推荐加进购物车。颜色/尺码取该商品的第一项（结算页不提供选择器） */
  async function addSelected() {
    if (adding.value) return
    const toAdd = products.value.filter((p) => selected.value.has(p.id))
    if (!toAdd.length) return
    adding.value = true
    try {
      toAdd.forEach((p) => {
        cartStore.addItem(p, {
          color: p.colors?.[0]?.name ?? 'Default',
          size: p.sizes?.[0] ?? 'Standard',
          quantity: 1,
        })
      })
      toast({
        title: t('checkout.addedToOrder'),
        description: `${toAdd.length} ${t('checkout.itemsCount', { count: toAdd.length })}`,
        variant: 'success',
      })
      // 清空选择集：刚加过的不该还能再点一次「加入订单」
      selected.value = new Set()
    } finally {
      adding.value = false
    }
  }

  return { products, selected, selectedCount, loading, adding, load, toggle, addSelected }
}

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Check, Plus, ShoppingBag, Zap } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import ProductCard from '@/components/ui/card/ProductCard.vue'
import { useCartStore } from '@/stores/cart'
import { useToast } from '@/composables/useToast'
import { getBoughtTogether, getRelatedProducts } from '@/api/modules/product'
import { IMAGE_FALLBACK } from '@/utils/imagePlaceholder'
import { formatPricePlain } from '@/utils/format'
import type { Product } from '@/types/product'

/**
 * 商品详情页底部的两个推荐位：Frequently Bought Together（可勾选凑单）与 You May Also Like。
 *
 * 从 `ProductDetail.vue` 整块搬出来（109 行模板 + 约 60 行脚本）。判据同前几块 —— 依赖而非
 * 行数：推荐数据（related / together / 勾选集）只在这块里用，页面别处一次都没读过。
 *
 * 状态自己持有、自己加载（`onMounted`）。原先由页面的 `fetchDetail()` 在商品加载完后调用
 * `loadRecommendations()`；改成组件自己加载是等价的 —— 这个块的模板本来就在
 * `v-if="productRef"` 里，商品没加载出来时组件根本不挂载。
 *
 * **接 5 个 prop 是因为「加入购物车」要用页面当前选中的规格**：主商品按用户选的颜色/尺码/
 * 数量加，搭配商品固定 Default/Standard/1。这是这一块唯一真正依赖外部的东西。
 * （`selectedColor` / `selectedSize` / `quantity` 只出现在脚本里，不在模板里 —— 静态数
 * 「模板绑定」的工具看不到它们，得读脚本。）
 */
const props = defineProps<{
  productId: number
  product: Product | null
  /** 主商品加购时带上的规格 —— 与右栏配置区是同一份状态 */
  selectedColor: { name: string; value?: string } | null
  selectedSize: string
  quantity: number
}>()

const cartStore = useCartStore()
const { toast } = useToast()

const relatedProducts = ref<Product[]>([])
const boughtTogether = ref<Product[]>([])
const boughtTogetherSelected = ref<Set<number>>(new Set())
const recLoading = ref(false)

async function loadRecommendations() {
  recLoading.value = true
  try {
    const [related, together] = await Promise.all([
      getRelatedProducts(props.productId, 6),
      getBoughtTogether(props.productId, 3),
    ])
    relatedProducts.value = related
    boughtTogether.value = together
    // 默认全部选中搭配购买
    boughtTogetherSelected.value = new Set(together.map((p) => p.id))
  } catch {
    // 推荐位拉不到就整块不渲染 —— 它不该让详情页显示错误态
    relatedProducts.value = []
    boughtTogether.value = []
  } finally {
    recLoading.value = false
  }
}

const boughtTogetherTotal = computed(() => {
  const ids = boughtTogetherSelected.value
  return boughtTogether.value
    .filter((p) => ids.has(p.id))
    .reduce((sum, p) => sum + Number(p.price), Number(props.product?.price ?? 0))
})

/** 整块替换 Set —— 模板里 `has(p.id)` 的读取靠引用变化触发 */
function toggleBoughtTogether(id: number) {
  const next = new Set(boughtTogetherSelected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  boughtTogetherSelected.value = next
}

function addBoughtTogetherToCart() {
  if (!props.product) return
  const ids = boughtTogetherSelected.value
  cartStore.addItem(props.product, {
    color: props.selectedColor?.name ?? 'Default',
    size: props.selectedSize || 'Standard',
    quantity: props.quantity,
  })
  boughtTogether.value.forEach((p) => {
    if (ids.has(p.id)) {
      cartStore.addItem(p, { color: 'Default', size: 'Standard', quantity: 1 })
    }
  })
  toast({
    title: 'Bundle Added to Cart',
    description: `${ids.size + 1} items added`,
    variant: 'success',
  })
}

onMounted(loadRecommendations)
</script>

<template>
  <div v-if="product" class="mt-16 border-t border-border pt-10">
    <div class="container px-4 mx-auto">
      <!-- Frequently Bought Together -->
      <section v-if="!recLoading && boughtTogether.length > 0" class="mb-12">
        <h2 class="text-xl sm:text-2xl font-black mb-6 flex items-center gap-2">
          <ShoppingBag class="w-5 h-5 text-primary" />
          Frequently Bought Together
        </h2>
        <div class="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div class="flex flex-wrap items-center gap-3 sm:gap-4">
            <!-- 主商品 -->
            <div class="w-28 sm:w-32">
              <div
                class="aspect-square rounded-xl overflow-hidden border border-border bg-secondary/30"
              >
                <img
                  :src="product.image ?? product.images?.[0]"
                  :alt="product.title"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  @error="(e) => ((e.target as HTMLImageElement).src = IMAGE_FALLBACK)"
                />
              </div>
              <p class="text-[11px] font-semibold line-clamp-1 mt-1.5 text-center">
                {{ product.title }}
              </p>
              <p class="text-xs font-bold text-primary text-center mt-0.5">
                ${{ formatPricePlain(product.price) }}
              </p>
            </div>

            <template v-for="(p, i) in boughtTogether" :key="p.id">
              <Plus
                v-if="i > 0 || boughtTogether.length > 1"
                class="w-5 h-5 text-muted-foreground shrink-0"
              />
              <div
                class="w-28 sm:w-32 cursor-pointer select-none"
                @click="toggleBoughtTogether(p.id)"
              >
                <div
                  class="relative aspect-square rounded-xl overflow-hidden border bg-secondary/30"
                  :class="
                    boughtTogetherSelected.has(p.id)
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-border opacity-60'
                  "
                >
                  <img
                    :src="p.image"
                    :alt="p.title"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span
                    class="absolute top-1.5 left-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-white"
                    :class="
                      boughtTogetherSelected.has(p.id)
                        ? 'bg-primary border-primary'
                        : 'bg-background/80 border-border'
                    "
                  >
                    <Check v-if="boughtTogetherSelected.has(p.id)" class="w-3 h-3" />
                  </span>
                </div>
                <p class="text-[11px] font-semibold line-clamp-1 mt-1.5 text-center">
                  {{ p.title }}
                </p>
                <p class="text-xs font-bold text-primary text-center mt-0.5">
                  ${{ formatPricePlain(p.price) }}
                </p>
              </div>
            </template>
          </div>

          <div
            class="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-border/60"
          >
            <div class="text-sm">
              <span class="text-muted-foreground">Total for selected:</span>
              <span class="ml-2 text-2xl font-black text-primary"
                >${{ formatPricePlain(boughtTogetherTotal) }}</span
              >
            </div>
            <Button size="sm" class="rounded-full px-6 h-10" @click="addBoughtTogetherToCart">
              <ShoppingBag class="w-4 h-4 mr-1.5" />
              Add Bundle to Cart
            </Button>
          </div>
        </div>
      </section>

      <!-- You May Also Like -->
      <section v-if="!recLoading && relatedProducts.length > 0" class="mb-4">
        <h2 class="text-xl sm:text-2xl font-black mb-6 flex items-center gap-2">
          <Zap class="w-5 h-5 text-primary" />
          You May Also Like
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
          <ProductCard v-for="p in relatedProducts" :key="p.id" :product="p" class="h-full" />
        </div>
      </section>
    </div>
  </div>
</template>

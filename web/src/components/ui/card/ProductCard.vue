<script setup lang="ts">
import { ref } from 'vue'
import type { Product } from '@/types/product'
import { ShoppingCart, ImageOff, Star } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  product: Product
}>()

const router = useRouter()
const imageError = ref(false)
const cartStore = useCartStore()
const { toast } = useToast()

// 快速加入购物车
function quickAddToCart(e: Event) {
  e.stopPropagation() // 阻止事件冒泡，避免触发卡片点击跳转
  cartStore.addItem(props.product, {
    color: 'Default',
    size: 'Standard',
    quantity: 1
  })
  toast({
    title: 'Added to Cart',
    description: `${props.product.title} has been added to your cart`,
    variant: 'success'
  })
}

function formatPrice(price: number) {
  return Number(price).toLocaleString('en-US')
}

function formatReviews(reviews?: number) {
  if (!reviews) return '0'
  if (reviews >= 1000) return `${(reviews / 1000).toFixed(1)}k`
  return String(reviews)
}

function getPromoBadge(product: Product) {
  if (Number(product.price) >= 500) return 'Free Shipping'
  if ((product.reviews ?? 0) >= 200) return 'Popular Choice'
  return 'Fast Dispatch'
}
</script>

<template>
  <div 
    class="group relative rounded-2xl border border-border bg-card overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/40 active:scale-[0.99] flex flex-col cursor-pointer"
    @click="router.push(`/product/${product.id}`)"
    @keyup.enter="router.push(`/product/${product.id}`)"
    tabindex="0"
  >
    <!-- Image -->
    <div class="aspect-video w-full overflow-hidden bg-secondary/30 relative flex items-center justify-center">
      <img 
        v-if="!imageError"
        :src="product.image" 
        :alt="product.title" 
        class="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-110"
        loading="lazy"
        @error="imageError = true"
      />
      
      <!-- Fallback for broken images -->
      <div v-else class="flex flex-col items-center justify-center text-muted-foreground w-full h-full bg-secondary/50">
        <ImageOff class="w-8 h-8 mb-2 opacity-40" />
        <span class="text-xs font-medium opacity-60">No Image</span>
      </div>
      
      <div class="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>

    <!-- Content -->
    <div class="p-4 flex flex-col flex-1 bg-gradient-to-b from-card to-secondary/10">
      <div class="flex justify-between items-start mb-2">
        <div class="min-w-0 flex-1 pr-2">
          <!-- 商品标题 -->
          <h3 class="font-bold text-base leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2" :title="product.title">
            {{ product.title }}
          </h3>
          <!-- 商品分类 -->
          <p class="text-xs text-muted-foreground mt-1 truncate">{{ product.category }}</p>
        </div>
      </div>

      <div class="flex items-center gap-2 mb-3 min-h-5">
        <template v-if="product.rating">
          <span class="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
            <Star class="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            {{ Number(product.rating).toFixed(1) }}
          </span>
          <span class="text-xs text-muted-foreground">({{ formatReviews(product.reviews) }})</span>
        </template>
        <span v-else class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border border-border/60">
          New
        </span>
      </div>
      
      <div class="mb-2.5">
        <span class="inline-flex items-center text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
          {{ getPromoBadge(product) }}
        </span>
      </div>

      <div class="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
        <!-- 商品价格 -->
        <span class="text-3xl leading-none font-black text-primary tracking-tight">${{ formatPrice(product.price) }}</span>
        <Button 
          variant="default" 
          size="sm" 
          class="rounded-full shadow-sm"
          @click="quickAddToCart"
        >
          <ShoppingCart class="w-4 h-4 mr-1.5" />
          Add
        </Button>
      </div>
    </div>
  </div>
</template>
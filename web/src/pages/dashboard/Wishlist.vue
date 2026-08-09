<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ShoppingCart, Trash2, Star, Heart, ArrowRight } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import Card from '@/components/ui/card/Card.vue'
import { useCartStore } from '@/stores/cart'
import { useWishlistStore } from '@/stores/wishlist'
import { useToast } from '@/composables/useToast'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'

const cartStore = useCartStore()
const wishlistStore = useWishlistStore()
const { toast } = useToast()

const isLoadingRef = ref(true)

onMounted(() => {
  // brief delay for skeleton UX
  setTimeout(() => {
    isLoadingRef.value = false
  }, 300)
})

function moveToCart(item: { id: number; title: string; price: number; image: string }) {
  cartStore.addItem(
    { id: item.id, title: item.title, price: item.price, image: item.image },
    { color: 'Default', size: 'Standard', quantity: 1 }
  )
  wishlistStore.removeItem(item.id)
  toast({
    title: 'Moved to Cart',
    description: `${item.title} has been moved to your cart.`,
    variant: 'success'
  })
}

function removeItem(item: { id: number; title: string }) {
  const ok = window.confirm(`Remove "${item.title}" from wishlist?`)
  if (!ok) return
  wishlistStore.removeItem(item.id)
  toast({ title: 'Removed', description: 'Item removed from wishlist.' })
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">My Wishlist</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ wishlistStore.count }} {{ wishlistStore.count === 1 ? 'item' : 'items' }} saved
        </p>
      </div>
      <Button
        v-if="wishlistStore.count > 0"
        variant="outline"
        size="sm"
        @click="wishlistStore.clearAll()"
      >
        Clear All
      </Button>
    </div>

    <!-- Loading -->
    <div v-if="isLoadingRef" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card v-for="i in 6" :key="i" class="overflow-hidden">
        <Skeleton class="aspect-square w-full" />
        <div class="p-4 space-y-3">
          <Skeleton class="h-5 w-3/4 rounded-md" />
          <Skeleton class="h-4 w-1/2 rounded-md" />
          <div class="flex items-center justify-between pt-2">
            <Skeleton class="h-6 w-20 rounded-md" />
            <Skeleton class="h-8 w-28 rounded-lg" />
          </div>
        </div>
      </Card>
    </div>

    <!-- Items -->
    <div v-else-if="wishlistStore.items.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card
        v-for="item in wishlistStore.items"
        :key="item.id"
        class="group overflow-hidden hover:shadow-lg transition-all duration-300 border-border/50"
      >
        <router-link :to="`/product/${item.id}`" class="block aspect-square relative overflow-hidden bg-secondary">
          <img
            :src="item.image"
            :alt="item.title"
            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <button
            @click.prevent="removeItem(item)"
            class="absolute top-2 right-2 p-2 rounded-full bg-background/80 backdrop-blur text-muted-foreground hover:text-destructive hover:bg-background transition-colors"
            title="Remove from wishlist"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </router-link>

        <div class="p-4 space-y-3">
          <div>
            <router-link :to="`/product/${item.id}`" class="hover:text-primary transition-colors">
              <h3 class="font-bold text-lg line-clamp-1">{{ item.title }}</h3>
            </router-link>
            <div v-if="item.rating" class="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <Star class="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{{ item.rating }}</span>
              <span v-if="item.reviews">({{ item.reviews >= 1000 ? (item.reviews / 1000).toFixed(1) + 'k' : item.reviews }})</span>
            </div>
            <p v-if="item.category" class="text-xs text-muted-foreground mt-0.5">{{ item.category }}</p>
          </div>

          <div class="flex items-center justify-between pt-2">
            <span class="font-bold text-lg">${{ Number(item.price).toLocaleString('en-US') }}</span>
            <Button size="sm" @click="moveToCart(item)">
              <ShoppingCart class="w-4 h-4 mr-2" />
              Add to Cart
            </Button>
          </div>
        </div>
      </Card>
    </div>

    <!-- Empty -->
    <div v-else class="py-20 text-center border border-dashed border-border rounded-xl">
      <div class="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
        <Heart class="w-8 h-8" />
      </div>
      <h3 class="text-lg font-medium mb-2">Your wishlist is empty</h3>
      <p class="text-muted-foreground mb-6">Save items you love to revisit later.</p>
      <router-link to="/">
        <Button>
          Explore Products
          <ArrowRight class="w-4 h-4 ml-2" />
        </Button>
      </router-link>
    </div>
  </div>
</template>

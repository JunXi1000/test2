<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ShoppingCart, Trash2, Star } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import Card from '@/components/ui/card/Card.vue'
import { useCartStore } from '@/stores/cart'
import { useToast } from '@/composables/useToast'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'

const cartStore = useCartStore()
const { toast } = useToast()

const wishlist = ref([
  {
    id: 4,
    title: 'Cyber Watch',
    price: 399,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop',
    rating: 4.5,
    reviews: 82
  },
  {
    id: 5,
    title: 'Minimal Desk',
    price: 1299,
    image: 'https://images.unsplash.com/photo-1595515106967-1434857ed8dd?q=80&w=1000&auto=format&fit=crop',
    rating: 4.9,
    reviews: 24
  },
  {
    id: 7,
    title: 'Drone Air',
    price: 799,
    image: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?q=80&w=1000&auto=format&fit=crop',
    rating: 4.7,
    reviews: 156
  }
])

const moveToCart = (product: any) => {
  cartStore.addItem(product, {
    color: 'Default',
    size: 'Standard',
    quantity: 1
  })
  toast({
    title: 'Moved to Cart',
    description: `${product.title} has been moved to your cart.`,
    variant: 'success'
  })
  removeFromWishlist(product.id)
}

const removeFromWishlist = (id: number) => {
  const item = wishlist.value.find(i => i.id === id)
  const ok = window.confirm(`Remove "${item?.title ?? 'this item'}" from wishlist?`)
  if (ok) {
    wishlist.value = wishlist.value.filter(item => item.id !== id)
    toast({ title: 'Removed', description: 'Item removed from wishlist.' })
  }
}

const isLoadingRef = ref<boolean>(true)
onMounted(() => {
  setTimeout(() => {
    isLoadingRef.value = false
  }, 350)
})
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">My Wishlist</h1>

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

    <div v-else-if="wishlist.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card 
        v-for="item in wishlist" 
        :key="item.id"
        class="group overflow-hidden hover:shadow-lg transition-all duration-300 border-border/50"
      >
        <div class="aspect-square relative overflow-hidden bg-secondary">
          <img 
            :src="item.image" 
            :alt="item.title"
            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
            loading="lazy"
          />
          <button 
            @click="removeFromWishlist(item.id)"
            class="absolute top-2 right-2 p-2 rounded-full bg-background/80 backdrop-blur text-muted-foreground hover:text-destructive hover:bg-background transition-colors"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
        
        <div class="p-4 space-y-3">
          <div>
            <h3 class="font-bold text-lg line-clamp-1">{{ item.title }}</h3>
            <div class="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <Star class="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{{ item.rating }}</span>
              <span>({{ item.reviews }})</span>
            </div>
          </div>
          
          <div class="flex items-center justify-between pt-2">
            <span class="font-bold text-lg">${{ item.price }}</span>
            <Button size="sm" @click="moveToCart(item)">
              <ShoppingCart class="w-4 h-4 mr-2" />
              Add to Cart
            </Button>
          </div>
        </div>
      </Card>
    </div>

    <div v-else class="py-20 text-center border border-dashed border-border rounded-xl">
      <div class="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
        <Heart class="w-8 h-8" />
      </div>
      <h3 class="text-lg font-medium mb-2">Your wishlist is empty</h3>
      <p class="text-muted-foreground mb-6">Save items you love to revisit later.</p>
      <router-link to="/products">
        <Button>Explore Products</Button>
      </router-link>
    </div>
  </div>
</template>

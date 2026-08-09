<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCompareStore } from '@/stores/compare'
import { useCartStore } from '@/stores/cart'
import { useToast } from '@/composables/useToast'
import Button from '@/components/ui/button/Button.vue'
import { ShoppingCart, Trash2, Star, X, ArrowLeft } from 'lucide-vue-next'
import { getProductById } from '@/api/modules/product'
import type { Product } from '@/types/product'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'

const router = useRouter()
const compareStore = useCompareStore()
const cartStore = useCartStore()
const { toast } = useToast()

const products = ref<Product[]>([])
const isLoading = ref(true)

onMounted(async () => {
  if (compareStore.items.length < 2) {
    router.replace('/')
    return
  }
  try {
    const results = await Promise.all(
      compareStore.items.map(item => getProductById(item.id))
    )
    products.value = results
  } catch {
    toast({ title: 'Error', description: 'Failed to load some products', variant: 'destructive' })
  } finally {
    isLoading.value = false
  }
})

function removeProduct(id: number) {
  compareStore.removeItem(id)
  products.value = products.value.filter(p => p.id !== id)
  if (compareStore.items.length < 2) {
    router.replace('/')
    toast({ title: 'Need at least 2 products', description: 'Add more products to compare.' })
  }
}

function addToCart(product: Product) {
  cartStore.addItem(product, { color: 'Default', size: 'Standard', quantity: 1 })
  toast({ title: 'Added to Cart', description: product.title, variant: 'success' })
}

// Build a unified spec table from all products
interface SpecRow { label: string; values: string[] }
const specTable = computed(() => {
  const rows: SpecRow[] = []
  if (products.value.length === 0) return rows

  // Price
  rows.push({ label: 'Price', values: products.value.map(p => `$${Number(p.price).toLocaleString('en-US')}`) })
  // Category
  rows.push({ label: 'Category', values: products.value.map(p => p.category || '-') })
  // Rating
  rows.push({ label: 'Rating', values: products.value.map(p => p.rating != null ? `${p.rating} ★ (${p.reviews ?? 0})` : '-') })
  // Features
  if (products.value.some(p => p.features?.length)) {
    const allFeatureKeys = new Set<string>()
    for (const p of products.value) {
      p.features?.forEach(f => allFeatureKeys.add(f))
    }
    for (const key of allFeatureKeys) {
      rows.push({
        label: key,
        values: products.value.map(p => (p.features?.includes(key) ? '✓' : '✗')),
      })
    }
  }
  // Description
  rows.push({ label: 'Description', values: products.value.map(p => p.description || '-') })

  return rows
})
</script>

<template>
  <div class="min-h-screen bg-background pb-20">
    <div class="container mx-auto px-4 py-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <button
            @click="$router.back()"
            class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
            <ArrowLeft class="w-4 h-4" /> Back
          </button>
          <h1 class="text-2xl font-bold">Compare Products</h1>
          <p class="text-sm text-muted-foreground mt-1">{{ products.length }} products side by side</p>
        </div>
        <Button variant="outline" size="sm" @click="compareStore.clearAll(); router.replace('/')">
          Clear All
        </Button>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="space-y-6">
        <div class="flex gap-4 overflow-x-auto pb-4">
          <div v-for="i in compareStore.items.length" :key="i" class="w-56 shrink-0 space-y-3 p-3 border rounded-xl bg-card">
            <Skeleton class="aspect-square w-full rounded-lg" />
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-4 w-1/2" />
          </div>
        </div>
      </div>

      <!-- Comparison Table -->
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[600px] border-collapse">
            <!-- Product headers -->
            <thead>
              <tr>
                <th class="w-40 p-3 text-left text-sm font-semibold text-muted-foreground sticky left-0 bg-background z-10"></th>
                <th
                  v-for="product in products"
                  :key="product.id"
                  class="p-3 text-center min-w-[200px]"
                >
                  <div class="relative inline-block">
                    <img
                      :src="product.image ?? product.images?.[0]"
                      :alt="product.title"
                      class="w-32 h-32 object-cover rounded-lg mx-auto mb-2"
                    />
                    <button
                      @click="removeProduct(product.id)"
                      class="absolute -top-1 -right-1 p-1 rounded-full bg-background border border-border text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X class="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h3 class="font-bold text-sm line-clamp-2">{{ product.title }}</h3>
                  <p class="text-lg font-black text-primary mt-1">${{ Number(product.price).toLocaleString('en-US') }}</p>
                  <div v-if="product.rating" class="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-1">
                    <Star class="w-3 h-3 fill-amber-400 text-amber-400" />
                    {{ product.rating }} ({{ product.reviews }})
                  </div>
                  <Button size="sm" class="mt-3 w-full" @click="addToCart(product)">
                    <ShoppingCart class="w-3.5 h-3.5 mr-1.5" />
                    Add to Cart
                  </Button>
                </th>
              </tr>
            </thead>

            <!-- Spec rows -->
            <tbody>
              <tr
                v-for="row in specTable"
                :key="row.label"
                class="border-t border-border/50"
              >
                <td class="p-3 text-sm font-medium text-muted-foreground sticky left-0 bg-card/80 backdrop-blur z-10">
                  {{ row.label }}
                </td>
                <td
                  v-for="(val, idx) in row.values"
                  :key="idx"
                  class="p-3 text-sm text-center"
                  :class="{
                    'text-emerald-600 font-semibold': val === '✓',
                    'text-muted-foreground/50': val === '✗',
                  }"
                >
                  {{ val }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty comparison -->
        <div v-if="products.length === 0" class="text-center py-20">
          <h3 class="text-lg font-semibold mb-2">Nothing to compare</h3>
          <p class="text-muted-foreground mb-4">Add products to compare them side by side</p>
          <router-link to="/"><Button>Browse Products</Button></router-link>
        </div>
      </template>
    </div>
  </div>
</template>

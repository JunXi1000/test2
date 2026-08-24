<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Star, ShieldCheck, MapPin, Clock, ThumbsUp, Users, Package, Truck, RotateCcw,
  Search, MessageSquare, ChevronLeft, ShoppingCart,
  Loader2, X, UserPlus, UserCheck
} from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import ErrorState from '@/components/ui/state/ErrorState.vue'
import { useToast } from '@/composables/useToast'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { useFollowedStores } from '@/stores/followedStores'
import {
  getMerchantPublicProfile,
  getMerchantStoreProducts,
  type MerchantPublicProfile,
  type MerchantFeaturedProduct,
  type StoreProductQuery
} from '@/api/modules/merchantPublic'
import { debounce } from 'lodash-es'

const route = useRoute()
const router = useRouter()
const { toast } = useToast()
const { t } = useI18n()
const cartStore = useCartStore()
const authStore = useAuthStore()
const followedStores = useFollowedStores()

const merchantId = computed(() => route.params.id as string)
const isFollowing = computed(() => followedStores.isFollowing(merchantId.value))

function toggleFollow() {
  if (!profile.value) return
  const added = followedStores.toggle({
    id: merchantId.value,
    storeName: profile.value.storeName,
    avatar: profile.value.avatar,
    followers: profile.value.stats.followers
  })
  // 乐观更新粉丝数（本地演示用，真实环境由后端统计）
  if (profile.value) {
    profile.value.stats.followers += added ? 1 : -1
  }
  toast({
    title: added ? t('store.followingStore') : t('store.unfollowed'),
    description: added
      ? t('store.followingStoreDesc', { name: profile.value.storeName })
      : t('store.unfollowedDesc', { name: profile.value.storeName }),
    variant: added ? 'success' : 'default'
  })
}

const profile = ref<MerchantPublicProfile | null>(null)
const profileLoading = ref(true)
const profileError = ref('')

const products = ref<MerchantFeaturedProduct[]>([])
const productsLoading = ref(false)
const productsTotal = ref(0)
const categories = ref<string[]>([])

const selectedCategory = ref('All')
const searchQuery = ref('')
const sortBy = ref<StoreProductQuery['sort']>('popular')
const currentPage = ref(1)
const pageSize = 12

const totalPages = computed(() => Math.ceil(productsTotal.value / pageSize))
const hasMore = computed(() => currentPage.value < totalPages.value)

const sortOptions = computed(() => [
  { label: t('store.sortPopular'), value: 'popular' as const },
  { label: t('store.sortNewest'), value: 'newest' as const },
  { label: t('store.sortPriceAsc'), value: 'price-asc' as const },
  { label: t('store.sortPriceDesc'), value: 'price-desc' as const }
])

async function loadProfile() {
  profileLoading.value = true
  profileError.value = ''
  try {
    profile.value = await getMerchantPublicProfile(merchantId.value)
  } catch (e: any) {
    profileError.value = e?.message || t('store.loadProfileFailed')
  } finally {
    profileLoading.value = false
  }
}

async function loadProducts(append = false) {
  productsLoading.value = true
  try {
    const res = await getMerchantStoreProducts(merchantId.value, {
      category: selectedCategory.value === 'All' ? undefined : selectedCategory.value,
      q: searchQuery.value || undefined,
      sort: sortBy.value,
      page: currentPage.value,
      limit: pageSize
    })
    if (append) {
      products.value = [...products.value, ...res.items]
    } else {
      products.value = res.items
    }
    productsTotal.value = res.total
    if (res.categories.length) categories.value = res.categories
  } catch {
    toast({ title: t('common.error'), description: t('store.loadProductsFailed'), variant: 'destructive' })
  } finally {
    productsLoading.value = false
  }
}

function resetAndLoad() {
  currentPage.value = 1
  loadProducts()
}

function loadMore() {
  if (productsLoading.value || !hasMore.value) return
  currentPage.value++
  loadProducts(true)
}

function selectCategory(cat: string) {
  selectedCategory.value = cat
  resetAndLoad()
}

function changeSort(val: StoreProductQuery['sort']) {
  sortBy.value = val
  resetAndLoad()
}

const debouncedSearch = debounce(() => resetAndLoad(), 400)

function clearSearch() {
  searchQuery.value = ''
  resetAndLoad()
}

function quickAddToCart(product: MerchantFeaturedProduct, e: Event) {
  e.stopPropagation()
  cartStore.addItem(
    { id: product.id, title: product.title, price: product.price, image: product.image },
    { color: 'Default', size: 'Standard', quantity: 1 }
  )
  toast({ title: t('product.addedToCart'), description: `${product.title} has been added.`, variant: 'success' })
}

function goToMessages() {
  if (!authStore.isAuthenticated) {
    toast({ title: t('store.loginRequired'), description: t('store.loginRequiredDesc'), variant: 'destructive' })
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  router.push({ name: 'UserMessages' })
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return n.toString()
}

function formatPrice(n: number) {
  return n.toLocaleString('en-US')
}

onMounted(() => {
  loadProfile()
  loadProducts()
})

watch(merchantId, () => {
  loadProfile()
  selectedCategory.value = 'All'
  searchQuery.value = ''
  sortBy.value = 'popular'
  resetAndLoad()
})

watch(searchQuery, () => debouncedSearch())
</script>

<template>
  <div class="min-h-screen bg-background pb-20">

    <!-- Profile loading skeleton -->
    <div v-if="profileLoading" class="bg-card border-b border-border">
      <div class="container max-w-6xl mx-auto px-4 py-8">
        <div class="flex flex-col sm:flex-row items-start gap-6">
          <Skeleton class="w-24 h-24 rounded-2xl flex-shrink-0" />
          <div class="flex-1 space-y-3 w-full">
            <Skeleton class="h-7 w-48" />
            <Skeleton class="h-4 w-full max-w-lg" />
            <div class="flex gap-6">
              <Skeleton class="h-10 w-20" />
              <Skeleton class="h-10 w-20" />
              <Skeleton class="h-10 w-20" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Profile error -->
    <div v-else-if="profileError" class="container max-w-6xl mx-auto px-4 py-20">
      <ErrorState :message="profileError" @retry="loadProfile" />
    </div>

    <!-- Profile loaded -->
    <template v-else-if="profile">
      <!-- Store Banner / Header -->
      <div class="bg-gradient-to-br from-primary/5 via-background to-primary/10 border-b border-border">
        <div class="container max-w-6xl mx-auto px-4 pt-6 pb-8">
          <!-- Back link -->
          <button @click="router.back()" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
            <ChevronLeft class="w-4 h-4" />
            Back
          </button>

          <div class="flex flex-col sm:flex-row items-start gap-6">
            <!-- Store avatar -->
            <div class="relative flex-shrink-0">
              <div class="w-24 h-24 rounded-2xl overflow-hidden border-2 border-border bg-card shadow-md">
                <img v-if="profile.avatar" :src="profile.avatar" :alt="profile.storeName" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center bg-secondary">
                  <Package class="w-10 h-10 text-muted-foreground" />
                </div>
              </div>
              <div v-if="profile.verified" class="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center border-2 border-card">
                <ShieldCheck class="w-4 h-4 text-white" />
              </div>
            </div>

            <!-- Store info -->
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2 mb-1">
                <h1 class="text-2xl sm:text-3xl font-bold tracking-tight">{{ profile.storeName }}</h1>
              </div>

              <p class="text-sm text-muted-foreground leading-relaxed mb-4 max-w-2xl">{{ profile.description }}</p>

              <!-- Meta tags -->
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground mb-5">
                <span class="inline-flex items-center gap-1">
                  <Star class="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span class="font-semibold text-foreground">{{ profile.stats.rating }}</span>
                  ({{ formatNumber(profile.stats.totalReviews) }} reviews)
                </span>
                <span class="inline-flex items-center gap-1"><MapPin class="w-3.5 h-3.5" /> {{ profile.location }}</span>
                <span class="inline-flex items-center gap-1"><Clock class="w-3.5 h-3.5 text-emerald-500" /> Replies {{ profile.responseTime }}</span>
                <span class="inline-flex items-center gap-1"><ThumbsUp class="w-3.5 h-3.5 text-emerald-500" /> {{ profile.stats.satisfactionRate }}% positive</span>
              </div>

              <!-- Stats pills -->
              <div class="flex flex-wrap gap-3 mb-5">
                <div class="flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2 shadow-sm">
                  <Package class="w-4 h-4 text-primary" />
                  <span class="text-sm font-bold">{{ formatNumber(profile.stats.totalProducts) }}</span>
                  <span class="text-xs text-muted-foreground">{{ $t('store.products') }}</span>
                </div>
                <div class="flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2 shadow-sm">
                  <ShoppingCart class="w-4 h-4 text-primary" />
                  <span class="text-sm font-bold">{{ formatNumber(profile.stats.totalSales) }}</span>
                  <span class="text-xs text-muted-foreground">{{ $t('store.sales') }}</span>
                </div>
                <div class="flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2 shadow-sm">
                  <Users class="w-4 h-4 text-primary" />
                  <span class="text-sm font-bold">{{ formatNumber(profile.stats.followers) }}</span>
                  <span class="text-xs text-muted-foreground">{{ $t('store.followers') }}</span>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex gap-2">
                <Button
                  size="sm"
                  class="gap-1.5"
                  :variant="isFollowing ? 'outline' : 'default'"
                  :aria-pressed="isFollowing"
                  @click="toggleFollow"
                >
                  <UserCheck v-if="isFollowing" class="w-4 h-4" />
                  <UserPlus v-else class="w-4 h-4" />
                  {{ isFollowing ? $t('store.following') : $t('store.follow') }}
                </Button>
                <Button size="sm" class="gap-1.5" @click="goToMessages">
                  <MessageSquare class="w-4 h-4" />
                  {{ $t('store.contactStore') }}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main content area -->
      <div class="container max-w-6xl mx-auto px-4 mt-8">
        <div class="flex flex-col lg:flex-row gap-8">

          <!-- Sidebar (desktop) -->
          <aside class="hidden lg:block w-64 flex-shrink-0 space-y-6">
            <!-- Categories -->
            <div class="rounded-xl border border-border bg-card p-4">
              <h3 class="font-semibold text-sm mb-3">{{ $t('store.categories') }}</h3>
              <div class="space-y-0.5">
                <button
                  @click="selectCategory('All')"
                  class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                  :class="selectedCategory === 'All' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'"
                >
                  {{ $t('store.allProducts') }}
                </button>
                <button
                  v-for="cat in categories"
                  :key="cat"
                  @click="selectCategory(cat)"
                  class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                  :class="selectedCategory === cat ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'"
                >
                  {{ cat }}
                </button>
              </div>
            </div>

            <!-- Store policies -->
            <div class="rounded-xl border border-border bg-card p-4 space-y-4">
              <h3 class="font-semibold text-sm">{{ $t('store.storePolicies') }}</h3>
              <div class="flex gap-2.5 items-start">
                <Truck class="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p class="text-xs font-medium mb-0.5">{{ $t('store.shipping') }}</p>
                  <p class="text-xs text-muted-foreground leading-relaxed">{{ profile.policies.shipping }}</p>
                </div>
              </div>
              <div class="flex gap-2.5 items-start">
                <RotateCcw class="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p class="text-xs font-medium mb-0.5">{{ $t('store.returns') }}</p>
                  <p class="text-xs text-muted-foreground leading-relaxed">{{ profile.policies.returns }}</p>
                </div>
              </div>
            </div>

            <!-- Store info -->
            <div class="rounded-xl border border-border bg-card p-4">
              <h3 class="font-semibold text-sm mb-2">{{ $t('store.about') }}</h3>
              <p class="text-xs text-muted-foreground leading-relaxed mb-3">{{ profile.description }}</p>
              <p class="text-[10px] text-muted-foreground">{{ $t('store.memberSince', { date: profile.joinedDate }) }}</p>
            </div>
          </aside>

          <!-- Products main -->
          <div class="flex-1 min-w-0">
            <!-- Toolbar -->
            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
              <!-- Search -->
              <div class="relative flex-1 w-full sm:max-w-xs">
                <Search class="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <input
                  v-model="searchQuery"
                  type="text"
                  :placeholder="$t('store.searchInStore')"
                  class="w-full h-9 pl-9 pr-8 rounded-lg bg-card border border-input text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                <button v-if="searchQuery" @click="clearSearch" class="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
                  <X class="w-4 h-4" />
                </button>
              </div>

              <!-- Mobile category & filter toggle -->
              <div class="flex items-center gap-2 lg:hidden">
                <select
                  :value="selectedCategory"
                  @change="selectCategory(($event.target as HTMLSelectElement).value)"
                  class="h-9 rounded-lg bg-card border border-input px-3 text-sm outline-none"
                >
                  <option value="All">{{ $t('store.allCategories') }}</option>
                  <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
                </select>
              </div>

              <!-- Sort -->
              <div class="flex items-center gap-2 ml-auto">
                <span class="text-xs text-muted-foreground hidden sm:inline">{{ $t('store.sortBy') }}</span>
                <select
                  :value="sortBy"
                  @change="changeSort(($event.target as HTMLSelectElement).value as StoreProductQuery['sort'])"
                  class="h-9 rounded-lg bg-card border border-input px-3 text-sm outline-none"
                >
                  <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
            </div>

            <!-- Results count -->
            <p class="text-xs text-muted-foreground mb-4">
              {{ productsTotal }} product{{ productsTotal !== 1 ? 's' : '' }}
              <template v-if="selectedCategory !== 'All'"> in <span class="font-medium text-foreground">{{ selectedCategory }}</span></template>
              <template v-if="searchQuery"> matching "<span class="font-medium text-foreground">{{ searchQuery }}</span>"</template>
            </p>

            <!-- Products grid -->
            <div v-if="!productsLoading || products.length > 0" class="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
              <div
                v-for="product in products"
                :key="product.id"
                class="group relative rounded-2xl border border-border bg-card overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/40 flex flex-col cursor-pointer"
                @click="router.push(`/product/${product.id}`)"
              >
                <!-- Image -->
                <div class="aspect-video w-full overflow-hidden bg-secondary/30 relative flex items-center justify-center">
                  <img
                    :src="product.image"
                    :alt="product.title"
                    class="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div class="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <!-- Content -->
                <div class="p-3 sm:p-4 flex flex-col flex-1">
                  <h3 class="font-bold text-sm leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1.5" :title="product.title">
                    {{ product.title }}
                  </h3>

                  <div class="flex items-center gap-2 mb-3">
                    <span class="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-600">
                      <Star class="w-3 h-3 fill-amber-500 text-amber-500" />
                      {{ product.rating }}
                    </span>
                    <span class="text-[10px] text-muted-foreground">{{ formatNumber(product.sales) }} sold</span>
                  </div>

                  <div class="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
                    <span class="text-xl sm:text-2xl font-black text-primary tracking-tight">${{ formatPrice(product.price) }}</span>
                    <Button
                      variant="default"
                      size="sm"
                      class="rounded-full shadow-sm h-8 w-8 sm:h-auto sm:w-auto p-0 sm:px-3"
                      @click="quickAddToCart(product, $event)"
                    >
                      <ShoppingCart class="w-4 h-4 sm:mr-1.5" />
                      <span class="hidden sm:inline">{{ $t('common.add') }}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Products loading skeleton (initial) -->
            <div v-if="productsLoading && products.length === 0" class="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
              <div v-for="i in 6" :key="i" class="rounded-2xl border border-border bg-card overflow-hidden">
                <Skeleton class="aspect-video w-full" />
                <div class="p-4 space-y-2">
                  <Skeleton class="h-4 w-3/4" />
                  <Skeleton class="h-3 w-1/2" />
                  <Skeleton class="h-8 w-full mt-2" />
                </div>
              </div>
            </div>

            <!-- Empty state -->
            <div v-if="!productsLoading && products.length === 0" class="text-center py-16 rounded-2xl border border-border bg-card">
              <Package class="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 class="text-lg font-bold mb-1">{{ $t('store.noProducts') }}</h3>
              <p class="text-sm text-muted-foreground mb-6">{{ $t('store.noProductsHint') }}</p>
              <Button variant="outline" @click="searchQuery = ''; selectedCategory = 'All'; resetAndLoad()">{{ $t('store.clearFilters') }}</Button>
            </div>

            <!-- Load more -->
            <div v-if="hasMore && !productsLoading" class="text-center mt-8">
              <Button variant="outline" size="lg" class="px-8" @click="loadMore">
                {{ $t('store.loadMore') }}
              </Button>
            </div>

            <!-- Loading more indicator -->
            <div v-if="productsLoading && products.length > 0" class="flex justify-center py-8">
              <Loader2 class="w-6 h-6 text-primary animate-spin" />
            </div>
          </div>
        </div>

        <!-- Mobile store info (bottom cards) -->
        <div class="lg:hidden mt-10 space-y-4">
          <div class="rounded-xl border border-border bg-card p-4 space-y-4">
            <h3 class="font-semibold text-sm">{{ $t('store.storePolicies') }}</h3>
            <div class="flex gap-2.5 items-start">
              <Truck class="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-xs font-medium mb-0.5">{{ $t('store.shipping') }}</p>
                <p class="text-xs text-muted-foreground leading-relaxed">{{ profile.policies.shipping }}</p>
              </div>
            </div>
            <div class="flex gap-2.5 items-start">
              <RotateCcw class="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-xs font-medium mb-0.5">{{ $t('store.returns') }}</p>
                <p class="text-xs text-muted-foreground leading-relaxed">{{ profile.policies.returns }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

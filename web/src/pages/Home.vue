<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import ProductCard from '@/components/ui/card/ProductCard.vue'
import Button from '@/components/ui/button/Button.vue'
import { getProducts, type ProductQuery } from '@/api/modules/product'
import type { Product } from '@/types/product'
import { useToast } from '@/composables/useToast'
import ErrorState from '@/components/ui/state/ErrorState.vue'
import { useRouter } from 'vue-router'
import { debounce } from 'lodash-es'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { Search, ListFilter, RefreshCw, Loader2, X } from 'lucide-vue-next'
import { useScroll, useEventListener } from '@vueuse/core'

const router = useRouter()
const { toast } = useToast()
const containerRef = ref<HTMLElement | null>(null)
const carouselRef = ref<any>(null)
const activeCarouselIndex = ref(0)

const productsRef = ref<Product[]>([])
const isLoadingRef = ref<boolean>(false)
const errorRef = ref<string>('')
const isRefreshing = ref(false)
const refreshState = ref<'idle' | 'pulling' | 'release' | 'refreshing' | 'success'>('idle')

const refreshTexts = {
  pulling: "Pull to refresh",
  release: "Release to refresh",
  refreshing: "Loading...",
  success: "Refreshed",
  no_more: "No more data"
}

const currentRefreshText = computed(() => {
  return refreshTexts[refreshState.value as keyof typeof refreshTexts] || ''
})

// Pull to refresh logic
const { y } = useScroll(window)
const pullDistance = ref(0)
const touchStartY = ref(0)
const threshold = 100

// Use useEventListener with passive: false to allow preventing default scroll
useEventListener(containerRef, 'touchstart', (e: TouchEvent) => {
  if (y.value <= 0) {
    touchStartY.value = e.touches[0].clientY
    refreshState.value = 'pulling'
  }
})

useEventListener(containerRef, 'touchmove', (e: TouchEvent) => {
  if (touchStartY.value > 0 && y.value <= 0) {
    const currentY = e.touches[0].clientY
    const diff = currentY - touchStartY.value
    
    // Only handle pull down
    if (diff > 0) {
      // Prevent default browser refresh/scroll behavior
      if (e.cancelable) e.preventDefault()
      
      // Add resistance
      pullDistance.value = Math.pow(diff, 0.8)
      
      if (!isRefreshing.value) {
        refreshState.value = pullDistance.value > threshold ? 'release' : 'pulling'
      }
    }
  }
}, { passive: false })

useEventListener(containerRef, 'touchend', () => {
  if (pullDistance.value > threshold && !isRefreshing.value) {
    handleRefresh()
  } else {
    // Reset with animation if not refreshing
    if (!isRefreshing.value) {
      pullDistance.value = 0
      refreshState.value = 'idle'
    }
  }
  touchStartY.value = 0
})

const activeCategory = ref('All')
const sortBy = ref<'default' | 'price-asc' | 'price-desc'>('default')
const searchQuery = ref('')
const categoryScrollRef = ref<HTMLElement | null>(null)
const isCategoryExpanded = ref(false)
let expandTimer: ReturnType<typeof setTimeout> | null = null
let collapseTimer: ReturnType<typeof setTimeout> | null = null

const detailedCategories = [
  'All', 'Phones', 'Laptops', 'Watches', 'Audio',
  'Gaming', 'Smart Home', 'Accessories', 'Tablets', 'Cameras',
  'Drones', 'Networking', 'Office', 'Monitors'
]

function clearSearch() {
  searchQuery.value = ''
  fetchProducts(true)
}

function handleCategoryWheel(e: WheelEvent) {
  const el = categoryScrollRef.value
  if (!el) return
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    el.scrollLeft += e.deltaY
  }
}

function selectCategory(cat: string) {
  activeCategory.value = cat
  isCategoryExpanded.value = false
  nextTick(() => {
    const el = categoryScrollRef.value
    if (!el) return
    const btn = el.querySelector<HTMLElement>(`[data-cat="${cat}"]`)
    btn?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
  })
}

function onCategoryAreaEnter() {
  if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null }
  if (!isCategoryExpanded.value && !expandTimer) {
    expandTimer = setTimeout(() => { isCategoryExpanded.value = true; expandTimer = null }, 180)
  }
}

function onCategoryAreaLeave() {
  if (expandTimer) { clearTimeout(expandTimer); expandTimer = null }
  if (!collapseTimer) {
    collapseTimer = setTimeout(() => { isCategoryExpanded.value = false; collapseTimer = null }, 350)
  }
}

// Mock Carousel Data
const carouselItems = [
  { 
    id: 1, 
    title: 'New iPhone 15 Pro', 
    image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=1000&auto=format&fit=crop', 
    desc: 'Titanium. So strong. So light. So Pro.',
    link: '/product/1'
  },
  { 
    id: 2, 
    title: 'MacBook Air 15"', 
    image: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?q=80&w=1000&auto=format&fit=crop', 
    desc: 'Impressively big. Impossibly thin.',
    link: '/product/2'
  },
  { 
    id: 3, 
    title: 'Sony WH-1000XM5', 
    image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?q=80&w=1000&auto=format&fit=crop', 
    desc: 'Your world. Nothing else.',
    link: '/product/3'
  }
]

function goCarousel(index: number) {
  activeCarouselIndex.value = index
  carouselRef.value?.setActiveItem(index)
}

function onCarouselKeydown(e: KeyboardEvent) {
  if (!carouselItems.length) return
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    goCarousel((activeCarouselIndex.value + 1) % carouselItems.length)
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    goCarousel((activeCarouselIndex.value - 1 + carouselItems.length) % carouselItems.length)
  }
}

const page = ref(1)
const limit = 20
const hasMore = ref(true)
const isLoadMore = ref(false)

async function fetchProducts(isRefresh = false) {
  try {
    if (isRefresh) {
      page.value = 1
      hasMore.value = true
    } else {
      if (!hasMore.value || isLoadMore.value) return
      isLoadMore.value = true
    }

    if (page.value === 1 && !isRefresh && productsRef.value.length === 0) {
      isLoadingRef.value = true
    }
    
    errorRef.value = ''
    const params: ProductQuery = {
      category: activeCategory.value === 'All' ? undefined : activeCategory.value,
      q: searchQuery.value,
      sort: sortBy.value,
      page: page.value,
      limit: limit
    }
    const list = await getProducts(params)
    
    if (isRefresh || page.value === 1) {
      productsRef.value = list
    } else {
      productsRef.value = [...productsRef.value, ...list]
    }
    
    if (list.length < limit) {
      hasMore.value = false
    } else {
      page.value++
    }

  } catch (e: any) {
    errorRef.value = e?.message || 'Failed to load products'
    toast({ title: 'Failed to load products', description: e?.message || 'Unknown error', variant: 'destructive' })
  } finally {
    isLoadingRef.value = false
    isLoadMore.value = false
  }
}

function handleRefresh() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  refreshState.value = 'refreshing'
  
  // Keep pull indicator visible during refresh
  pullDistance.value = threshold 
  
  // Longer delay for testing
  setTimeout(() => {
    fetchProducts(true).then(() => {
      refreshState.value = 'success'
      // Show success state briefly
      setTimeout(() => {
        // Reset after fetch complete
        pullDistance.value = 0
        isRefreshing.value = false
        setTimeout(() => {
          refreshState.value = 'idle'
        }, 300)
      }, 500)
    })
  }, 2000)
}

// Infinite Scroll Logic
useEventListener(window, 'scroll', () => {
  const scrollTop = window.scrollY
  const clientHeight = window.innerHeight
  const scrollHeight = document.documentElement.scrollHeight
  
  if (scrollTop + clientHeight >= scrollHeight - 200 && !isLoadingRef.value && !isLoadMore.value && hasMore.value) {
    fetchProducts()
  }
})

const debouncedFetch = debounce(() => fetchProducts(true), 300)

onMounted(() => {
  fetchProducts(true)
})
watch(activeCategory, () => fetchProducts(true))
watch(sortBy, () => fetchProducts(true))
watch(searchQuery, () => debouncedFetch())

onBeforeUnmount(() => {
  if (expandTimer) clearTimeout(expandTimer)
  if (collapseTimer) clearTimeout(collapseTimer)
})

const filteredProducts = computed(() => productsRef.value)
</script>

<template>
  <div 
    ref="containerRef"
    class="min-h-screen bg-background pb-20 transition-transform duration-300 ease-out"
    :style="{ transform: `translateY(${pullDistance}px)` }"
  >
    <!-- Refresh Indicator (Absolute top, negative position) -->
    <div class="absolute top-0 left-0 w-full h-16 -mt-16 flex items-center justify-center text-primary pointer-events-none gap-2">
       <Loader2 v-if="refreshState === 'refreshing'" class="w-5 h-5 animate-spin" />
       <RefreshCw v-else-if="refreshState !== 'success'" class="w-5 h-5 transition-transform duration-300" :style="{ transform: `rotate(${pullDistance * 2}deg)` }" />
       <span class="text-sm font-medium">{{ currentRefreshText }}</span>
    </div>

    <div class="container px-4 mx-auto pt-6">
      
      <!-- Top Navigation Area (Sticky) -->
      <div
        class="sticky z-40 bg-background/80 backdrop-blur-md py-2.5 mb-8 -mx-4 px-4 border-b border-border/50"
        :style="{ top: 'var(--app-header-offset, 64px)' }"
      >
        <div class="flex flex-row items-center gap-2 sm:gap-3 w-full min-w-0">
          <!-- Categories: grows, scrolls; overlay stays within this column -->
          <div class="flex-1 min-w-0 relative self-center">
            <!-- Desktop: collapsed row + hover expand -->
            <div
              class="hidden lg:block relative"
              @mouseenter="onCategoryAreaEnter"
              @mouseleave="onCategoryAreaLeave"
            >
              <div class="h-[36px] overflow-hidden">
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="cat in detailedCategories"
                    :key="cat"
                    @click="selectCategory(cat)"
                    class="h-8 px-2.5 rounded-full text-xs font-medium transition-all border whitespace-nowrap"
                    :class="activeCategory === cat
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border text-foreground/80 hover:border-primary/50 hover:text-foreground'"
                  >
                    {{ cat }}
                  </button>
                </div>
              </div>
              <div
                class="category-expand-overlay absolute left-0 right-0 top-0 z-50 bg-background/95 backdrop-blur-md border border-border/40 rounded-xl p-2 shadow-xl"
                :class="isCategoryExpanded ? 'overlay-visible' : 'overlay-hidden'"
              >
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="cat in detailedCategories"
                    :key="cat"
                    @click="selectCategory(cat)"
                    class="h-8 px-2.5 rounded-full text-xs font-medium transition-all border whitespace-nowrap"
                    :class="activeCategory === cat
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border text-foreground/80 hover:border-primary/50 hover:text-foreground'"
                  >
                    {{ cat }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Mobile / tablet: horizontal scroll -->
            <div class="lg:hidden relative">
              <div class="pointer-events-none absolute left-0 top-0 h-full w-4 bg-gradient-to-r from-background/90 to-transparent z-10"></div>
              <div class="pointer-events-none absolute right-0 top-0 h-full w-4 bg-gradient-to-l from-background/90 to-transparent z-10"></div>
              <div
                ref="categoryScrollRef"
                class="overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-1 [-webkit-overflow-scrolling:touch] overscroll-x-contain"
                @wheel.prevent="handleCategoryWheel"
              >
                <div class="flex gap-1.5 min-w-max items-center py-0.5">
                  <button
                    v-for="cat in detailedCategories"
                    :key="cat"
                    :data-cat="cat"
                    @click="selectCategory(cat)"
                    class="h-8 px-2.5 rounded-full text-xs font-medium transition-all border whitespace-nowrap snap-start"
                    :class="activeCategory === cat
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border text-foreground/80 hover:border-primary/50 hover:text-foreground'"
                  >
                    {{ cat }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Search + Sort: same row, fixed width block -->
          <div class="shrink-0 flex items-center gap-1.5 sm:gap-2">
            <div class="relative w-[7.5rem] min-[380px]:w-36 sm:w-44 md:w-52">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search..."
                class="h-8 w-full rounded-full bg-secondary border border-transparent px-2.5 text-xs sm:text-sm outline-none focus:border-primary transition-all pl-8 pr-7"
                @keyup.enter="fetchProducts(true)"
              />
              <Search class="absolute left-2.5 top-2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <button
                v-if="searchQuery"
                @click="clearSearch"
                class="absolute right-1.5 top-1 h-6 w-6 rounded-full hover:bg-background/70 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
                aria-label="Clear search"
              >
                <X class="h-3 w-3" />
              </button>
            </div>
            <el-dropdown trigger="click" @command="(cmd: 'default' | 'price-asc' | 'price-desc') => sortBy = cmd">
              <div class="flex items-center gap-1 bg-secondary rounded-full px-2.5 sm:px-3 h-8 border border-transparent focus-within:border-primary hover:border-primary transition-colors cursor-pointer outline-none">
                <ListFilter class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground shrink-0" />
                <span class="text-xs sm:text-sm text-foreground whitespace-nowrap hidden min-[400px]:inline">
                  {{ sortBy === 'price-asc' ? '↑' : sortBy === 'price-desc' ? '↓' : 'Sort' }}
                </span>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="default" :class="{ 'text-primary bg-primary/10': sortBy === 'default' }">Default</el-dropdown-item>
                  <el-dropdown-item command="price-asc" :class="{ 'text-primary bg-primary/10': sortBy === 'price-asc' }">Price ↑</el-dropdown-item>
                  <el-dropdown-item command="price-desc" :class="{ 'text-primary bg-primary/10': sortBy === 'price-desc' }">Price ↓</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        
        <!-- Carousel (Integrated into Grid) -->
        <div
          v-if="!searchQuery"
          class="col-span-1 sm:col-span-2 lg:col-span-2 h-auto min-h-[250px]"
          role="region"
          aria-label="Featured products carousel"
          tabindex="0"
          @keydown="onCarouselKeydown"
        >
          <el-carousel
            ref="carouselRef"
            trigger="click"
            :interval="5000"
            :pause-on-hover="true"
            indicator-position="outside"
            arrow="hover"
            height="100%"
            class="h-full rounded-2xl overflow-hidden shadow-lg border border-border bg-card"
            @change="(current: number) => activeCarouselIndex = current"
          >
            <el-carousel-item v-for="item in carouselItems" :key="item.id" class="h-full">
              <div class="relative w-full h-full group cursor-pointer" @click="router.push(item.link)">
                <img
                  :src="item.image"
                  :alt="item.title"
                  :loading="item.id === 1 ? 'eager' : 'lazy'"
                  class="w-full h-full object-cover object-center sm:object-[center_35%] transition-transform duration-700 group-hover:scale-105"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10 flex flex-col justify-end p-8 text-white">
                  <div class="max-w-[85%] rounded-xl bg-black/25 backdrop-blur-[1px] px-3 py-2">
                    <h3 class="text-3xl font-bold mb-2 leading-tight">{{ item.title }}</h3>
                    <p class="text-base text-zinc-200 mb-1 line-clamp-2">{{ item.desc }}</p>
                  </div>
                  <div class="mt-3 flex gap-2 opacity-100 sm:opacity-90 sm:group-hover:opacity-100 transition-opacity duration-300">
                    <Button variant="secondary" size="sm" class="bg-white text-black hover:bg-zinc-200 border-none shadow-sm">
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            </el-carousel-item>
          </el-carousel>
        </div>

        <!-- Loading State -->
        <template v-if="isLoadingRef && productsRef.length === 0">
          <div v-for="i in 8" :key="i" class="col-span-1">
            <div class="space-y-3 p-3 border rounded-2xl bg-card h-full">
              <Skeleton class="aspect-video w-full rounded-lg" />
              <Skeleton class="h-4 w-3/4" />
              <Skeleton class="h-4 w-1/2" />
            </div>
          </div>
        </template>

        <!-- Error State -->
        <div v-else-if="errorRef" class="col-span-full">
          <ErrorState :message="errorRef" @retry="fetchProducts(true)" />
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredProducts.length === 0" class="col-span-full text-center py-20 bg-card rounded-2xl border border-border">
          <p class="text-muted-foreground text-lg">No products found matching your criteria.</p>
          <Button variant="outline" class="mt-4" @click="() => { searchQuery = ''; activeCategory = 'All'; }">
            Clear Filters
          </Button>
        </div>

        <!-- Products -->
        <template v-else>
          <ProductCard 
            v-for="product in filteredProducts" 
            :key="product.id" 
            :product="product"
            class="h-full"
          />
          
          <!-- Load More Skeleton -->
          <div v-if="isLoadMore" v-for="i in 4" :key="`more-${i}`" class="col-span-1">
            <div class="space-y-3 p-3 border rounded-2xl bg-card h-full">
              <Skeleton class="aspect-video w-full rounded-lg" />
              <Skeleton class="h-4 w-3/4" />
              <Skeleton class="h-4 w-1/2" />
            </div>
          </div>
          
          <!-- No More Data -->
          <div v-if="!hasMore && filteredProducts.length > 0" class="col-span-full py-8 text-center text-muted-foreground text-sm">
            {{ refreshTexts.no_more }}
          </div>
        </template>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Custom Carousel Styles to match the sleek look */
:deep(.el-carousel__container) {
  height: 100% !important;
}

/* Hide scrollbar for category wall on mobile if needed */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.category-expand-overlay {
  transform-origin: top center;
  transition:
    opacity 300ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 400ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 400ms cubic-bezier(0.16, 1, 0.3, 1);
}

.category-expand-overlay.overlay-hidden {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
  pointer-events: none;
}

.category-expand-overlay.overlay-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.12);
}

@media (prefers-reduced-motion: reduce) {
  .category-expand-overlay {
    transition: none;
  }
}
</style>
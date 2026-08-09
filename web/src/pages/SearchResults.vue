<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProductCard from '@/components/ui/card/ProductCard.vue'
import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import ErrorState from '@/components/ui/state/ErrorState.vue'
import {
  searchProducts,
  getTrendingSearches,
  getSearchHistory,
  addSearchHistory,
  clearSearchHistory,
  removeSearchHistory,
  type SearchResults as SearchResultsType,
} from '@/api/modules/search'
import { Search, X, Clock, TrendingUp, Trash2, SlidersHorizontal, ChevronDown, Star } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import Breadcrumb from '@/components/ui/Breadcrumb.vue'

const route = useRoute()
const router = useRouter()
const { toast } = useToast()

// ── State ────────────────────────────────────────────────────────────
const query = ref((route.query.q as string) || '')
const searchInput = ref(query.value)
const results = ref<SearchResultsType | null>(null)
const isLoading = ref(false)
const error = ref('')
const page = ref(1)
const limit = 20
const hasMore = computed(() => {
  if (!results.value) return false
  return results.value.products.length < results.value.total
})

// Filters
const selectedCategory = ref((route.query.category as string) || '')
const selectedPriceRange = ref<{ min: number; max: number | null } | null>(null)
const selectedRating = ref<number | null>(null)
const sortBy = ref<string>((route.query.sort as string) || 'relevance')
const showFilters = ref(false)

// Suggestions & history
const trendingSearches = ref<string[]>([])
const searchHistory = ref<string[]>(getSearchHistory())
const showSuggestions = ref(false)
const showTrendingFallback = ref(false)

// ── Derived ──────────────────────────────────────────────────────────
const totalResults = computed(() => results.value?.total ?? 0)
const facets = computed(() => results.value?.facets)
const relatedSearches = computed(() => results.value?.relatedSearches ?? [])

const activeFilterCount = computed(() => {
  let count = 0
  if (selectedCategory.value) count++
  if (selectedPriceRange.value) count++
  if (selectedRating.value) count++
  return count
})

// ── Methods ──────────────────────────────────────────────────────────
async function doSearch(isNewSearch = false) {
  if (!query.value.trim()) return
  if (isNewSearch) {
    page.value = 1
    results.value = null
  }

  isLoading.value = true
  error.value = ''

  try {
    const data = await searchProducts({
      q: query.value,
      category: selectedCategory.value || undefined,
      priceMin: selectedPriceRange.value?.min,
      priceMax: selectedPriceRange.value?.max ?? undefined,
      rating: selectedRating.value ?? undefined,
      sort: sortBy.value === 'relevance' ? undefined : sortBy.value,
      page: page.value,
      limit,
    })

    if (isNewSearch || page.value === 1) {
      results.value = data
    } else {
      if (results.value) {
        results.value = {
          ...data,
          products: [...results.value.products, ...data.products],
        }
      } else {
        results.value = data
      }
    }

    if (data.products.length >= limit) {
      // ready for next page
    }

    // Update URL
    router.replace({
      query: {
        q: query.value,
        ...(selectedCategory.value ? { category: selectedCategory.value } : {}),
        ...(sortBy.value !== 'relevance' ? { sort: sortBy.value } : {}),
      },
    })

    // Save to history
    if (isNewSearch) {
      addSearchHistory(query.value)
      searchHistory.value = getSearchHistory()
    }
  } catch (e: any) {
    error.value = e?.message || 'Search failed'
  } finally {
    isLoading.value = false
  }
}

function handleSearch() {
  query.value = searchInput.value.trim()
  if (!query.value) return
  selectedCategory.value = ''
  selectedPriceRange.value = null
  selectedRating.value = null
  sortBy.value = 'relevance'
  showSuggestions.value = false
  showTrendingFallback.value = false
  doSearch(true)
}

function selectSuggestion(suggestion: string) {
  searchInput.value = suggestion
  query.value = suggestion
  showSuggestions.value = false
  showTrendingFallback.value = false
  doSearch(true)
}

function selectCategory(cat: string) {
  selectedCategory.value = selectedCategory.value === cat ? '' : cat
  doSearch(true)
}

function selectPriceRange(range: { min: number; max: number | null }) {
  if (
    selectedPriceRange.value?.min === range.min &&
    selectedPriceRange.value?.max === range.max
  ) {
    selectedPriceRange.value = null
  } else {
    selectedPriceRange.value = range
  }
  doSearch(true)
}

function selectRating(value: number) {
  selectedRating.value = selectedRating.value === value ? null : value
  doSearch(true)
}

function clearAllFilters() {
  selectedCategory.value = ''
  selectedPriceRange.value = null
  selectedRating.value = null
  sortBy.value = 'relevance'
  doSearch(true)
}

function loadMore() {
  if (!hasMore.value || isLoading.value) return
  page.value++
  doSearch(false)
}

function handleSearchInputFocus() {
  if (searchInput.value.trim()) {
    showSuggestions.value = true
    showTrendingFallback.value = false
  } else {
    showSuggestions.value = false
    showTrendingFallback.value = true
  }
}

function handleSearchInputBlur() {
  // delay to allow click on suggestion
  setTimeout(() => {
    showSuggestions.value = false
    showTrendingFallback.value = false
  }, 200)
}

// ── Infinite scroll ──────────────────────────────────────────────────
function onScroll() {
  const scrollTop = window.scrollY
  const clientHeight = window.innerHeight
  const scrollHeight = document.documentElement.scrollHeight
  if (scrollTop + clientHeight >= scrollHeight - 300 && !isLoading.value && hasMore.value) {
    loadMore()
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────
onMounted(async () => {
  trendingSearches.value = await getTrendingSearches()
  if (query.value) {
    searchInput.value = query.value
    doSearch(true)
  } else {
    showTrendingFallback.value = true
  }
  window.addEventListener('scroll', onScroll, { passive: true })
})

// Watch query param changes from URL
watch(
  () => route.query.q,
  (newQ) => {
    if (newQ && newQ !== query.value) {
      query.value = newQ as string
      searchInput.value = newQ as string
      doSearch(true)
    }
  }
)
</script>

<template>
  <div class="min-h-screen bg-background">
    <div class="container mx-auto px-4 py-6">
      <!-- Breadcrumb -->
      <Breadcrumb
        v-if="query"
        :items="[{ label: `Search: ${query}` }]"
        class="mb-4"
      />

      <!-- Search Bar -->
      <div class="max-w-2xl mx-auto mb-8">
        <div class="relative">
          <div class="flex gap-2">
            <div class="relative flex-1">
              <Search class="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                v-model="searchInput"
                type="text"
                placeholder="Search products, brands, categories..."
                class="w-full h-12 rounded-xl bg-card border border-border pl-12 pr-10 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                @keyup.enter="handleSearch"
                @focus="handleSearchInputFocus"
                @blur="handleSearchInputBlur"
                @input="showSuggestions = !!searchInput.trim()"
              />
              <button
                v-if="searchInput"
                @click="searchInput = ''; query = ''; showSuggestions = false; showTrendingFallback = true"
                class="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X class="h-4 w-4" />
              </button>
            </div>
            <Button @click="handleSearch" :disabled="!searchInput.trim()" class="h-12 px-6">
              Search
            </Button>
          </div>

          <!-- Suggestions / Trending / History dropdown -->
          <div
            v-if="showSuggestions || showTrendingFallback"
            class="absolute top-full mt-2 left-0 right-0 bg-card border border-border rounded-xl shadow-xl z-50 p-4"
          >
            <!-- History when no input -->
            <template v-if="showTrendingFallback">
              <div v-if="searchHistory.length > 0" class="mb-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Clock class="h-3.5 w-3.5" /> Recent Searches
                  </span>
                  <button @click="clearSearchHistory(); searchHistory = []" class="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
                    <Trash2 class="h-3 w-3" /> Clear
                  </button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="h in searchHistory.slice(0, 8)"
                    :key="h"
                    @click="selectSuggestion(h)"
                    class="group flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-xs hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <Clock class="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                    {{ h }}
                    <X
                      class="h-3 w-3 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      @click.stop="removeSearchHistory(h); searchHistory = getSearchHistory()"
                    />
                  </button>
                </div>
              </div>

              <div>
                <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  <TrendingUp class="h-3.5 w-3.5" /> Trending Searches
                </span>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="t in trendingSearches"
                    :key="t"
                    @click="selectSuggestion(t)"
                    class="px-2.5 py-1 rounded-full bg-secondary text-xs hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {{ t }}
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Results area -->
      <template v-if="query">
        <div class="flex flex-col lg:flex-row gap-6">
          <!-- Sidebar Filters -->
          <aside class="lg:w-60 shrink-0">
            <!-- Mobile filter toggle -->
            <button
              @click="showFilters = !showFilters"
              class="lg:hidden w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-border bg-card mb-3 text-sm font-medium"
            >
              <span class="flex items-center gap-2">
                <SlidersHorizontal class="h-4 w-4" />
                Filters
                <span v-if="activeFilterCount > 0" class="bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {{ activeFilterCount }}
                </span>
              </span>
              <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': showFilters }" />
            </button>

            <div :class="showFilters ? 'block' : 'hidden'" class="lg:block space-y-5">
              <!-- Active filters -->
              <div v-if="activeFilterCount > 0">
                <button
                  @click="clearAllFilters"
                  class="text-xs text-primary hover:underline"
                >
                  Clear all filters
                </button>
              </div>

              <!-- Category facet -->
              <div v-if="facets?.categories?.length">
                <h4 class="text-sm font-semibold mb-2">Category</h4>
                <div class="space-y-1">
                  <button
                    v-for="cat in facets.categories"
                    :key="cat.name"
                    @click="selectCategory(cat.name)"
                    class="flex items-center justify-between w-full px-2 py-1.5 rounded text-sm transition-colors"
                    :class="selectedCategory === cat.name ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'"
                  >
                    <span>{{ cat.name }}</span>
                    <span class="text-xs text-muted-foreground">{{ cat.count }}</span>
                  </button>
                </div>
              </div>

              <!-- Price range facet -->
              <div v-if="facets?.priceRanges?.length">
                <h4 class="text-sm font-semibold mb-2">Price Range</h4>
                <div class="space-y-1">
                  <button
                    v-for="pr in facets.priceRanges"
                    :key="pr.label"
                    @click="selectPriceRange(pr)"
                    class="flex items-center justify-between w-full px-2 py-1.5 rounded text-sm transition-colors"
                    :class="selectedPriceRange?.min === pr.min ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'"
                  >
                    <span>{{ pr.label }}</span>
                    <span class="text-xs text-muted-foreground">{{ pr.count }}</span>
                  </button>
                </div>
              </div>

              <!-- Rating facet -->
              <div v-if="facets?.ratings?.length">
                <h4 class="text-sm font-semibold mb-2">Rating</h4>
                <div class="space-y-1">
                  <button
                    v-for="rb in facets.ratings"
                    :key="rb.value"
                    @click="selectRating(rb.value)"
                    class="flex items-center justify-between w-full px-2 py-1.5 rounded text-sm transition-colors"
                    :class="selectedRating === rb.value ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'"
                  >
                    <span class="flex items-center gap-1">
                      <Star class="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {{ rb.value }}+
                    </span>
                    <span class="text-xs text-muted-foreground">{{ rb.count }}</span>
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <!-- Main Content -->
          <div class="flex-1 min-w-0">
            <!-- Sort bar -->
            <div class="flex items-center justify-between mb-4">
              <p class="text-sm text-muted-foreground">
                <template v-if="!isLoading && results">
                  <span class="font-semibold text-foreground">{{ totalResults }}</span> results for "<span class="font-medium text-foreground">{{ query }}</span>"
                </template>
                <template v-else-if="isLoading && !results">
                  Searching...
                </template>
              </p>
              <select
                v-model="sortBy"
                @change="doSearch(true)"
                class="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
              >
                <option value="relevance">Relevance</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Top Rated</option>
              </select>
            </div>

            <!-- Loading -->
            <template v-if="isLoading && !results">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <div v-for="i in 8" :key="i" class="space-y-3 p-3 border rounded-2xl bg-card">
                  <Skeleton class="aspect-square w-full rounded-lg" />
                  <Skeleton class="h-4 w-3/4" />
                  <Skeleton class="h-4 w-1/2" />
                </div>
              </div>
            </template>

            <!-- Error -->
            <ErrorState v-else-if="error" :message="error" @retry="doSearch(true)" />

            <!-- No results -->
            <div v-else-if="results && results.products.length === 0" class="text-center py-20">
              <div class="text-6xl mb-4">🔍</div>
              <h3 class="text-xl font-semibold mb-2">No results found for "{{ query }}"</h3>
              <p class="text-muted-foreground mb-6">Try adjusting your search or filters</p>
              <Button variant="outline" @click="clearAllFilters(); searchInput = ''; query = '';">
                Clear All Filters
              </Button>
            </div>

            <!-- Results grid -->
            <template v-else-if="results">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <ProductCard
                  v-for="product in results.products"
                  :key="product.id"
                  :product="product"
                  class="h-full"
                />
              </div>

              <!-- Load more -->
              <div v-if="isLoading && results" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                <div v-for="i in 4" :key="i" class="space-y-3 p-3 border rounded-2xl bg-card">
                  <Skeleton class="aspect-square w-full rounded-lg" />
                  <Skeleton class="h-4 w-3/4" />
                  <Skeleton class="h-4 w-1/2" />
                </div>
              </div>

              <div v-if="!hasMore && results.products.length > 0" class="text-center py-8 text-muted-foreground text-sm">
                — You've reached the end —
              </div>
            </template>

            <!-- Related searches -->
            <div v-if="relatedSearches.length > 0 && results && results.products.length > 0" class="mt-10 pt-6 border-t border-border">
              <h4 class="text-sm font-semibold text-muted-foreground mb-3">Related Searches</h4>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="rs in relatedSearches"
                  :key="rs"
                  @click="selectSuggestion(rs)"
                  class="px-3 py-1.5 rounded-full bg-secondary text-sm hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {{ rs }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Empty state: no query yet -->
      <div v-else class="max-w-2xl mx-auto text-center py-16">
        <div class="text-6xl mb-4">🛒</div>
        <h2 class="text-2xl font-bold mb-2">Find What You Need</h2>
        <p class="text-muted-foreground mb-8">Search thousands of products across all categories</p>

        <div v-if="trendingSearches.length > 0" class="mb-8">
          <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-center gap-1.5 mb-3">
            <TrendingUp class="h-4 w-4" /> Trending Now
          </h4>
          <div class="flex flex-wrap justify-center gap-2">
            <button
              v-for="t in trendingSearches"
              :key="t"
              @click="selectSuggestion(t)"
              class="px-4 py-2 rounded-full bg-card border border-border text-sm hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all"
            >
              {{ t }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

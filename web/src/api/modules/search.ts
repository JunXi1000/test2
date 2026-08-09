import { USE_MOCK } from '@/config/env'
import { get, post } from '@/api/http'
import type { Product } from '@/types/product'
import { scopedKey } from '@/stores/userScope'

export interface SearchSuggestions {
  keywords: string[]
  products: Array<{ id: number; title: string; price: number; image: string }>
}

export interface SearchResults {
  products: Product[]
  total: number
  facets: {
    categories: Array<{ name: string; count: number }>
    priceRanges: Array<{ label: string; min: number; max: number | null; count: number }>
    ratings: Array<{ value: number; count: number }>
  }
  relatedSearches: string[]
}

// ── Trending / hot searches ──────────────────────────────────────────
const TRENDING_SEARCHES = [
  'iPhone', 'MacBook', 'AirPods', 'Smart Watch', 'Gaming Mouse',
  'Mechanical Keyboard', '4K Monitor', 'Bluetooth Speaker', 'Tablet',
  'Drone', 'Camera', 'Noise Cancelling', 'Wireless Earbuds', 'USB-C Hub',
  'Portable Charger',
]

let searchSuggestionsCache: string[] = []

function buildSuggestionCache(products: Product[]) {
  if (searchSuggestionsCache.length > 0) return
  const words = new Set<string>()
  for (const p of products) {
    const tokens = p.title.toLowerCase().split(/\s+/)
    for (const t of tokens) {
      if (t.length >= 3) words.add(t)
    }
    if (p.category) words.add(p.category.toLowerCase())
  }
  searchSuggestionsCache = Array.from(words).sort()
}

async function loadMockProductsForSearch() {
  const { getMockProducts } = await import('./product.mock')
  return getMockProducts()
}

export async function getSearchSuggestions(query: string): Promise<SearchSuggestions> {
  if (USE_MOCK) {
    const products = await loadMockProductsForSearch()
    buildSuggestionCache(products)
    const q = query.toLowerCase().trim()

    // matching keywords from cache
    const keywords = searchSuggestionsCache
      .filter(w => w.startsWith(q) && w !== q)
      .slice(0, 6)

    // matching product titles
    const matchedProducts = products
      .filter(p => p.title.toLowerCase().includes(q))
      .slice(0, 4)
      .map(p => ({ id: p.id, title: p.title, price: p.price, image: p.image }))

    return { keywords, products: matchedProducts }
  }
  return get<SearchSuggestions>('/search/suggestions', { params: { q: query } })
}

export async function getTrendingSearches(): Promise<string[]> {
  if (USE_MOCK) {
    // randomize order slightly each call for "freshness"
    return [...TRENDING_SEARCHES].sort(() => Math.random() - 0.5).slice(0, 10)
  }
  return get<string[]>('/search/trending')
}

export async function searchProducts(params: {
  q: string
  category?: string
  priceMin?: number
  priceMax?: number
  rating?: number
  sort?: string
  page?: number
  limit?: number
}): Promise<SearchResults> {
  if (USE_MOCK) {
    const allProducts = await loadMockProductsForSearch()
    buildSuggestionCache(allProducts)

    let result = [...allProducts]
    const q = params.q.toLowerCase().trim()

    if (q) {
      result = result.filter(
        p =>
          p.title.toLowerCase().includes(q) ||
          (p.category && p.category.toLowerCase().includes(q))
      )
    }
    if (params.category) {
      result = result.filter(p => p.category === params.category)
    }
    if (params.priceMin != null) {
      result = result.filter(p => p.price >= params.priceMin!)
    }
    if (params.priceMax != null) {
      result = result.filter(p => p.price <= params.priceMax!)
    }
    if (params.rating != null) {
      result = result.filter(p => (p.rating ?? 0) >= params.rating!)
    }

    // facets computed from filtered results
    const catCounts = new Map<string, number>()
    for (const p of result) {
      const c = p.category || 'Other'
      catCounts.set(c, (catCounts.get(c) || 0) + 1)
    }

    const priceRanges = [
      { label: 'Under $50', min: 0, max: 50, count: 0 },
      { label: '$50 - $200', min: 50, max: 200, count: 0 },
      { label: '$200 - $500', min: 200, max: 500, count: 0 },
      { label: '$500 - $1000', min: 500, max: 1000, count: 0 },
      { label: 'Over $1000', min: 1000, max: null as number | null, count: 0 },
    ]
    const ratingBuckets = [
      { value: 4, count: 0 },
      { value: 3, count: 0 },
      { value: 2, count: 0 },
    ]

    for (const p of result) {
      for (const r of priceRanges) {
        if (p.price >= r.min && (r.max === null || p.price < r.max)) {
          r.count++
          break
        }
      }
      const rating = p.rating ?? 0
      for (const rb of ratingBuckets) {
        if (rating >= rb.value) {
          rb.count++
          break
        }
      }
    }

    const facets = {
      categories: Array.from(catCounts.entries()).map(([name, count]) => ({ name, count })),
      priceRanges: priceRanges.filter(r => r.count > 0),
      ratings: ratingBuckets.filter(r => r.count > 0),
    }

    // related searches from titles of result set
    const titleWords = new Set<string>()
    for (const p of result.slice(0, 30)) {
      p.title.toLowerCase().split(/\s+/).forEach(w => { if (w.length >= 3) titleWords.add(w) })
    }
    const relatedSearches = Array.from(titleWords)
      .filter(w => !q.includes(w))
      .sort(() => Math.random() - 0.5)
      .slice(0, 5)

    // sort
    if (params.sort === 'price-asc') result.sort((a, b) => a.price - b.price)
    else if (params.sort === 'price-desc') result.sort((a, b) => b.price - a.price)
    else if (params.sort === 'rating') result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

    const page = params.page || 1
    const limit = params.limit || 20
    const start = (page - 1) * limit

    return {
      products: result.slice(start, start + limit),
      total: result.length,
      facets,
      relatedSearches,
    }
  }
  return post<SearchResults>('/search', params)
}

// ── Search history (client-side, persisted to localStorage) ──────────
const HISTORY_KEY = 'nexus_search_history'
const MAX_HISTORY = 20

export function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(scopedKey(HISTORY_KEY))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addSearchHistory(query: string) {
  const trimmed = query.trim()
  if (!trimmed) return
  let history = getSearchHistory()
  history = history.filter(h => h.toLowerCase() !== trimmed.toLowerCase())
  history.unshift(trimmed)
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY)
  localStorage.setItem(scopedKey(HISTORY_KEY), JSON.stringify(history))
}

export function clearSearchHistory() {
  localStorage.removeItem(scopedKey(HISTORY_KEY))
}

export function removeSearchHistory(query: string) {
  let history = getSearchHistory()
  history = history.filter(h => h !== query)
  localStorage.setItem(scopedKey(HISTORY_KEY), JSON.stringify(history))
}

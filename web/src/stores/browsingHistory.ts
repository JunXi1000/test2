import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { onUserScopeChange, scopedKey } from './userScope'

export interface BrowsedProduct {
  id: number
  title: string
  price: number
  image: string
  category?: string
  rating?: number
  viewedAt: number
}

const STORAGE_KEY = 'nexus_browsing_history'
const MAX_ITEMS = 30

function loadFromStorage(): BrowsedProduct[] {
  try {
    const raw = localStorage.getItem(scopedKey(STORAGE_KEY))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(items: BrowsedProduct[]) {
  localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(items))
}

export const useBrowsingHistory = defineStore('browsingHistory', () => {
  const items = ref<BrowsedProduct[]>(loadFromStorage())

  onUserScopeChange(() => {
    items.value = loadFromStorage()
  })

  const recentItems = computed(() => items.value.slice(0, 12))

  function recordView(product: {
    id: number
    title: string
    price: number
    image: string
    category?: string
    rating?: number
  }) {
    // Remove existing entry for this product
    items.value = items.value.filter(i => i.id !== product.id)
    // Add to front
    items.value.unshift({
      ...product,
      viewedAt: Date.now(),
    })
    // Cap size
    if (items.value.length > MAX_ITEMS) {
      items.value = items.value.slice(0, MAX_ITEMS)
    }
    saveToStorage(items.value)
  }

  function clearHistory() {
    items.value = []
    localStorage.removeItem(scopedKey(STORAGE_KEY))
  }

  return { items, recentItems, recordView, clearHistory }
})

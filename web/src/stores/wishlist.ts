import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { onUserScopeChange, scopedKey } from './userScope'

export interface WishlistItem {
  id: number
  title: string
  price: number
  image: string
  category?: string
  rating?: number
  reviews?: number
  addedAt: number
}

const STORAGE_KEY = 'nexus_wishlist_items'

function loadFromStorage(): WishlistItem[] {
  try {
    const raw = localStorage.getItem(scopedKey(STORAGE_KEY))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(items: WishlistItem[]) {
  localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(items))
}

export const useWishlistStore = defineStore('wishlist', () => {
  const items = ref<WishlistItem[]>(loadFromStorage())

  onUserScopeChange(() => {
    items.value = loadFromStorage()
  })

  const count = computed(() => items.value.length)
  const ids = computed(() => new Set(items.value.map(i => i.id)))

  function isInWishlist(productId: number): boolean {
    return ids.value.has(productId)
  }

  function addItem(product: {
    id: number
    title: string
    price: number
    image: string
    category?: string
    rating?: number
    reviews?: number
  }) {
    if (isInWishlist(product.id)) return
    items.value.push({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.image,
      category: product.category,
      rating: product.rating,
      reviews: product.reviews,
      addedAt: Date.now(),
    })
    saveToStorage(items.value)
  }

  function removeItem(productId: number) {
    items.value = items.value.filter(i => i.id !== productId)
    saveToStorage(items.value)
  }

  function toggleItem(product: {
    id: number
    title: string
    price: number
    image: string
    category?: string
    rating?: number
    reviews?: number
  }) {
    if (isInWishlist(product.id)) {
      removeItem(product.id)
    } else {
      addItem(product)
    }
  }

  function clearAll() {
    items.value = []
    localStorage.removeItem(scopedKey(STORAGE_KEY))
  }

  return { items, count, ids, isInWishlist, addItem, removeItem, toggleItem, clearAll }
})

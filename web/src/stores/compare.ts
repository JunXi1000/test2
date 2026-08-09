import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { onUserScopeChange, scopedKey } from './userScope'

export interface CompareItem {
  id: number
  title: string
  price: number
  image: string
  category?: string
  rating?: number
}

const STORAGE_KEY = 'nexus_compare_items'
const MAX_COMPARE = 4

function loadFromStorage(): CompareItem[] {
  try {
    const raw = localStorage.getItem(scopedKey(STORAGE_KEY))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(items: CompareItem[]) {
  localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(items))
}

export const useCompareStore = defineStore('compare', () => {
  const items = ref<CompareItem[]>(loadFromStorage())

  onUserScopeChange(() => {
    items.value = loadFromStorage()
  })

  const count = computed(() => items.value.length)
  const ids = computed(() => new Set(items.value.map(i => i.id)))
  const canCompare = computed(() => items.value.length >= 2)

  function isInCompare(productId: number): boolean {
    return ids.value.has(productId)
  }

  function addItem(product: CompareItem) {
    if (isInCompare(product.id)) return
    if (items.value.length >= MAX_COMPARE) return
    items.value.push(product)
    saveToStorage(items.value)
  }

  function removeItem(productId: number) {
    items.value = items.value.filter(i => i.id !== productId)
    saveToStorage(items.value)
  }

  function toggleItem(product: CompareItem) {
    if (isInCompare(product.id)) {
      removeItem(product.id)
    } else {
      addItem(product)
    }
  }

  function clearAll() {
    items.value = []
    localStorage.removeItem(scopedKey(STORAGE_KEY))
  }

  return { items, count, ids, canCompare, isInCompare, addItem, removeItem, toggleItem, clearAll, MAX_COMPARE }
})

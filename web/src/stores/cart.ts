import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { onUserScopeChange, scopedKey } from './userScope'

export interface CartItem {
  id: number
  cartItemId: string
  title: string
  price: number
  image: string
  color: string
  size: string
  quantity: number
}

const STORAGE_KEY = 'nexus_cart_items'

function loadFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(scopedKey(STORAGE_KEY))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const useCartStore = defineStore('cart', () => {
  const saved = loadFromStorage()
  let initialItems: CartItem[] = []
  try {
    initialItems = saved ? JSON.parse(saved) : []
  } catch {
    initialItems = []
  }

  // Data Migration: Ensure all items have a cartItemId
  initialItems.forEach(item => {
    if (!item.cartItemId) {
      item.cartItemId = `${item.id}-${item.color}-${item.size}`
    }
  })

  const items = ref<CartItem[]>(initialItems)
  const directBuyItem = ref<CartItem | null>(null)

  const subtotal = computed(() => items.value.reduce((sum, item) => sum + item.price * item.quantity, 0))
  const totalItems = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))

  function setDirectBuyItem(product: any, options: { color: string, size: string, quantity: number }) {
    directBuyItem.value = {
      id: Number(product.id),
      cartItemId: 'direct-buy',
      title: product.title || 'Unknown Product',
      price: Number(product.price) || 0,
      image: product.image ?? product.images?.[0] ?? '',
      color: options.color || '',
      size: options.size || '',
      quantity: options.quantity || 1
    }
  }

  function clearDirectBuyItem() {
    directBuyItem.value = null
  }

  const MAX_QUANTITY = 99

  function addItem(product: any, options: { color: string, size: string, quantity: number }) {
    const uniqueKey = `${product.id}-${options.color}-${options.size}`
    const existingItem = items.value.find(item => item.cartItemId === uniqueKey)

    if (existingItem) {
      existingItem.quantity = Math.min(existingItem.quantity + options.quantity, MAX_QUANTITY)
    } else {
      items.value.push({
        id: Number(product.id),
        cartItemId: uniqueKey,
        title: product.title || 'Unknown Product',
        price: Number(product.price) || 0,
        image: product.image ?? product.images?.[0] ?? '',
        color: options.color || '',
        size: options.size || '',
        quantity: Math.min(options.quantity || 1, MAX_QUANTITY)
      })
    }
  }

  function removeItem(cartItemId: string) {
    items.value = items.value.filter(item => item.cartItemId !== cartItemId)
  }

  function updateQuantity(cartItemId: string, delta: number) {
    const item = items.value.find(item => item.cartItemId === cartItemId)
    if (item) {
      const newQty = item.quantity + delta
      if (newQty > MAX_QUANTITY) item.quantity = MAX_QUANTITY
      else if (newQty > 0) item.quantity = newQty
      else removeItem(cartItemId)
    }
  }

  function updateItemOptions(oldCartItemId: string, newOptions: { color: string, size: string, image?: string }) {
    const itemIndex = items.value.findIndex(item => item.cartItemId === oldCartItemId)
    if (itemIndex === -1) return

    const item = items.value[itemIndex]
    const newCartItemId = `${item.id}-${newOptions.color}-${newOptions.size}`

    // Check if an item with the new options already exists (and is not the current item)
    const existingItemIndex = items.value.findIndex(i => i.cartItemId === newCartItemId)

    if (existingItemIndex !== -1 && existingItemIndex !== itemIndex) {
      // Merge: Add quantity to existing item and remove the old one
      items.value[existingItemIndex].quantity += item.quantity
      if (newOptions.image) {
        items.value[existingItemIndex].image = newOptions.image
      }
      items.value.splice(itemIndex, 1)
    } else {
      // Update: Just change the options and ID
      item.color = newOptions.color
      item.size = newOptions.size
      if (newOptions.image) {
        item.image = newOptions.image
      }
      item.cartItemId = newCartItemId
    }
  }

  function clearCart() {
    items.value = []
  }

  watch(items, (val) => {
    localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(val))
  }, { deep: true })

  // 登录/登出切换用户后, 重新加载当前用户作用域下的购物车
  onUserScopeChange(() => {
    items.value = loadFromStorage()
    directBuyItem.value = null
  })

  return { items, directBuyItem, subtotal, totalItems, addItem, removeItem, updateQuantity, updateItemOptions, clearCart, setDirectBuyItem, clearDirectBuyItem }
})

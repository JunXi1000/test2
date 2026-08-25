import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { onUserScopeChange, scopedKey, getStorageScope } from './userScope'
import { USE_MOCK } from '@/config/env'
import { getCart, addCartItem, updateCartItem, removeCartItems } from '@/api/modules/cart'

export interface CartItem {
  id: number
  cartItemId: string
  title: string
  price: number
  image: string
  color: string
  size: string
  quantity: number
  /**
   * 登录态购物车行的服务端 id(shopping_cart.id);guest / 直接购买项为 undefined。
   * 后端购物车仅按 productId 存行(无颜色/尺寸列),登录态同步后 color/size 恒为
   * Default/Standard——这是 Phase 2 的已文档化限制。
   */
  serverId?: number
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

/** 非 mock 模式下,购物车才与后端 /shoppingCart 双向同步 */
const serverEnabled = !USE_MOCK

/** 登录态判定:直接读 localStorage 作用域,避免与 auth store 循环依赖 */
function isLoggedIn(): boolean {
  return getStorageScope() !== 'guest'
}

export const useCartStore = defineStore('cart', () => {
  // loadFromStorage() 已返回解析后的数组，直接使用（避免二次 JSON.parse 导致刷新后清空）
  const initialItems: CartItem[] = loadFromStorage()

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

  /**
   * 从后端拉取当前用户购物车作为权威数据(仅登录 + 非 mock)。
   * 失败时保留当前本地状态(乐观更新),下次同步自愈。
   */
  async function syncFromServer(): Promise<void> {
    if (!serverEnabled || !isLoggedIn()) return
    try {
      items.value = await getCart()
    } catch {
      /* 网络/鉴权失败:保留本地状态,下次同步自愈 */
    }
  }

  /** 登录态:乐观本地变更后同步服务端并回拉权威数据 */
  function syncAfterMutation(mutation: Promise<void>): void {
    if (!serverEnabled || !isLoggedIn()) return
    mutation.then(syncFromServer).catch(syncFromServer)
  }

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

    // 登录态:服务端按 productId 合并数量,回拉后颜色/尺寸归一为 Default/Standard
    if (serverEnabled && isLoggedIn()) {
      syncAfterMutation(addCartItem(Number(product.id), options.quantity || 1))
    }
  }

  function removeItem(cartItemId: string) {
    const item = items.value.find(item => item.cartItemId === cartItemId)
    items.value = items.value.filter(item => item.cartItemId !== cartItemId)
    if (serverEnabled && isLoggedIn() && item?.serverId) {
      syncAfterMutation(removeCartItems([item.serverId]))
    }
  }

  function updateQuantity(cartItemId: string, delta: number) {
    const item = items.value.find(item => item.cartItemId === cartItemId)
    if (!item) return
    const newQty = item.quantity + delta
    if (newQty > MAX_QUANTITY) {
      item.quantity = MAX_QUANTITY
    } else if (newQty > 0) {
      item.quantity = newQty
    } else {
      removeItem(cartItemId)
      return
    }
    if (serverEnabled && isLoggedIn() && item.serverId) {
      syncAfterMutation(updateCartItem(item.serverId, item.quantity))
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
    // 服务端购物车无颜色/尺寸列:登录态选项改动仅本地生效,下次服务端同步会归一为 Default/Standard
  }

  function clearCart() {
    if (serverEnabled && isLoggedIn()) {
      const ids = items.value.map(i => i.serverId).filter((x): x is number => !!x)
      items.value = []
      if (ids.length) {
        syncAfterMutation(removeCartItems(ids))
      } else {
        syncFromServer()
      }
    } else {
      items.value = []
    }
  }

  watch(items, (val) => {
    // 登录态以服务端为准,不写本地(避免陈旧快照在下次登录时误载入)
    if (getStorageScope() === 'guest') {
      localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(val))
    }
  }, { deep: true })

  // 登录/登出切换用户后:guest 读本地,登录态拉取服务端权威购物车
  onUserScopeChange(() => {
    directBuyItem.value = null
    if (getStorageScope() === 'guest') {
      items.value = loadFromStorage()
    } else {
      syncFromServer()
    }
  })

  // 初始化:若已登录(会话恢复),以服务端购物车为准
  if (serverEnabled && isLoggedIn()) {
    syncFromServer()
  }

  return { items, directBuyItem, subtotal, totalItems, addItem, removeItem, updateQuantity, updateItemOptions, clearCart, setDirectBuyItem, clearDirectBuyItem }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { onUserScopeChange, scopedKey } from './userScope'
import { RUNTIME_USE_MOCK } from '@/config/env'
import {
  getMyStockAlerts,
  subscribeStockAlert,
  unsubscribeStockAlert,
  type StockAlert,
} from '@/api/modules/stockAlerts'

export type { StockAlert } from '@/api/modules/stockAlerts'

const STORAGE_KEY = 'nexus_stock_alerts'

function loadFromStorage(): StockAlert[] {
  try { return JSON.parse(localStorage.getItem(scopedKey(STORAGE_KEY)) || '[]') } catch { return [] }
}
function saveToStorage(items: StockAlert[]) { localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(items)) }

export const useStockAlertStore = defineStore('stockAlerts', () => {
  const alerts = ref<StockAlert[]>([])

  /** Hydrate from backend (non-mock) or local storage (mock). */
  async function load() {
    if (RUNTIME_USE_MOCK.value) {
      alerts.value = loadFromStorage()
      return
    }
    try {
      alerts.value = await getMyStockAlerts()
    } catch {
      alerts.value = []
    }
  }

  onUserScopeChange(() => {
    load()
  })

  function isSubscribed(productId: number): boolean {
    return alerts.value.some(a => a.productId === productId && !a.notified)
  }

  async function subscribe(product: { id: number; title: string; image: string }, email: string) {
    if (isSubscribed(product.id)) return
    if (RUNTIME_USE_MOCK.value) {
      alerts.value.push({
        productId: product.id,
        productTitle: product.title,
        productImage: product.image,
        email: email || 'user@example.com',
        subscribedAt: Date.now(),
        notified: false,
      })
      saveToStorage(alerts.value)
      return
    }
    try {
      await subscribeStockAlert({
        productId: product.id,
        productTitle: product.title,
        productImage: product.image,
        email: email || '',
      })
      alerts.value = await getMyStockAlerts()
    } catch {
      // ignore — non-critical
    }
  }

  async function unsubscribe(productId: number) {
    if (RUNTIME_USE_MOCK.value) {
      alerts.value = alerts.value.filter(a => a.productId !== productId)
      saveToStorage(alerts.value)
      return
    }
    try {
      await unsubscribeStockAlert(productId)
    } catch {
      // ignore — remove locally regardless
    }
    alerts.value = alerts.value.filter(a => a.productId !== productId)
  }

  return { alerts, isSubscribed, subscribe, unsubscribe, load }
})

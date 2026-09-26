import { defineStore } from 'pinia'
import { ref } from 'vue'
import { onUserScopeChange, scopedKey } from './userScope'
import { RUNTIME_USE_MOCK } from '@/config/env'
import { toErrorMessage } from '@/utils/error'
import {
  getMyStockAlerts,
  subscribeStockAlert,
  unsubscribeStockAlert,
  type StockAlert,
} from '@/api/modules/stockAlerts'

export type { StockAlert } from '@/api/modules/stockAlerts'

const STORAGE_KEY = 'nexus_stock_alerts'

function loadFromStorage(): StockAlert[] {
  try {
    return JSON.parse(localStorage.getItem(scopedKey(STORAGE_KEY)) || '[]')
  } catch {
    return []
  }
}
function saveToStorage(items: StockAlert[]) {
  localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(items))
}

export const useStockAlertStore = defineStore('stockAlerts', () => {
  const alerts = ref<StockAlert[]>([])

  /**
   * 取数失败的原因（空串 = 没出错）。与 stores/returns.ts 同一处置。
   *
   * 本 store 目前只被商品详情页当作「这个商品我订阅了吗」的查询用（不渲染列表），
   * 所以失败不会显示错误块 —— 但**必须留痕**：失败时 `alerts` 为空会让「已订阅」的按钮
   * 显示成「提醒我」，用户以为自己没订过。至少 error 可查、可断言。
   */
  const error = ref('')

  /** Hydrate from backend (non-mock) or local storage (mock). */
  async function load() {
    error.value = ''
    if (RUNTIME_USE_MOCK.value) {
      alerts.value = loadFromStorage()
      return
    }
    try {
      alerts.value = await getMyStockAlerts()
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to load stock alerts')
      // 不清空 alerts，理由同上
    }
  }

  onUserScopeChange(() => {
    load()
  })

  function isSubscribed(productId: number): boolean {
    return alerts.value.some((a) => a.productId === productId && !a.notified)
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
      alerts.value = alerts.value.filter((a) => a.productId !== productId)
      saveToStorage(alerts.value)
      return
    }
    try {
      await unsubscribeStockAlert(productId)
    } catch {
      // ignore — remove locally regardless
    }
    alerts.value = alerts.value.filter((a) => a.productId !== productId)
  }

  return { alerts, error, isSubscribed, subscribe, unsubscribe, load }
})

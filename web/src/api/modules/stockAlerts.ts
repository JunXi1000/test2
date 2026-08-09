import { USE_MOCK } from '@/config/env'
import { get, post, del } from '@/api/http'

export interface StockAlert {
  productId: number
  productTitle: string
  productImage: string
  email: string
  subscribedAt: number
  notified: boolean
}

export interface StockAlertInput {
  productId: number
  productTitle: string
  productImage: string
  email: string
}

/** Current user's stock alerts (backend GET /stock-alerts/mine). */
export async function getMyStockAlerts(): Promise<StockAlert[]> {
  if (USE_MOCK) return []
  return get<StockAlert[]>('/stock-alerts/mine')
}

/** Subscribe to restock alerts (backend POST /stock-alerts). */
export async function subscribeStockAlert(data: StockAlertInput): Promise<void> {
  if (USE_MOCK) return Promise.resolve()
  await post('/stock-alerts', data)
}

/** Unsubscribe (backend DELETE /stock-alerts/:productId). */
export async function unsubscribeStockAlert(productId: number): Promise<void> {
  if (USE_MOCK) return Promise.resolve()
  await del(`/stock-alerts/${productId}`)
}

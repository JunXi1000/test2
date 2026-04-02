import { USE_MOCK } from '@/config/env'
import { get, post } from '@/api/http'
import type { CartItem } from '@/stores/cart'

export interface OrderSummary {
  subtotal: number
  shipping: number
  tax: number
  discount: number
  total: number
}

export async function calculateOrderSummary(items: CartItem[], zip?: string): Promise<OrderSummary> {
  if (USE_MOCK) {
    const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0)
    const shipping = subtotal > 200 ? 0 : 12
    const tax = +(subtotal * 0.08).toFixed(2)
    const discount = 0
    const total = +(subtotal + shipping + tax - discount).toFixed(2)
    return Promise.resolve({ subtotal, shipping, tax, discount, total })
  }
  return post<OrderSummary>('/checkout/summary', { items, zip })
}

export async function applyPromoCode(code: string, currentSubtotal: number): Promise<{ discount: number }> {
  if (USE_MOCK) {
    const map: Record<string, number> = { SAVE10: 0.1, VIP15: 0.15 }
    const rate = map[code.toUpperCase()] || 0
    const discount = +(currentSubtotal * rate).toFixed(2)
    return Promise.resolve({ discount })
  }
  return post<{ discount: number }>('/checkout/promo', { code, subtotal: currentSubtotal })
}

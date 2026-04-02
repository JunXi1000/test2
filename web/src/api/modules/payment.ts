import { USE_MOCK } from '@/config/env'
import { post } from '@/api/http'
import type { CartItem } from '@/stores/cart'

export interface PaymentCreatePayload {
  items: CartItem[]
  amount: number
  currency: string
  shipping: {
    name: string
    address: string
    city: string
    zip?: string
    country?: string
  }
}

export interface PaymentCreateResult { paymentId: string; orderId: string; clientSecret?: string }
export interface PaymentConfirmPayload { paymentId: string; method: 'card'; cardLast4?: string }
export interface PaymentConfirmResult { status: 'succeeded' | 'processing' | 'failed'; orderId: string }

export async function createPaymentIntent(payload: PaymentCreatePayload): Promise<PaymentCreateResult> {
  if (USE_MOCK) {
    const paymentId = `pay_${Date.now()}`
    const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`
    return Promise.resolve({ paymentId, orderId, clientSecret: 'mock_client_secret' })
  }
  return post<PaymentCreateResult>('/payments/create', payload)
}

export async function confirmPayment(payload: PaymentConfirmPayload): Promise<PaymentConfirmResult> {
  if (USE_MOCK) {
    // Always succeed in mock to keep demo smooth
    return Promise.resolve({ status: 'succeeded', orderId: `ORD-${Math.floor(1000 + Math.random() * 9000)}` })
  }
  return post<PaymentConfirmResult>('/payments/confirm', payload)
}

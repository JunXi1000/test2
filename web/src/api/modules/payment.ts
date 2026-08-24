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

export type PaymentStatus = 'succeeded' | 'processing' | 'failed' | 'requires_action'

export interface PaymentCreateResult {
  paymentId: string
  orderId: string
  clientSecret?: string
}

export interface PaymentConfirmPayload {
  paymentId: string
  method: 'card'
  /** 完整卡号（仅 mock 路由卡场景用；真实网关接入时改为传 token） */
  cardNumber?: string
  cardLast4?: string
  /** 已保存支付方式 token（阶段 2.2 一键下单；真实网关传入 PaymentMethod id） */
  savedMethodId?: string
}

// ── 已保存支付方式（阶段 2.2）：token 化，不存明文卡号 ──
export interface SavedPaymentMethod {
  /** 令牌 id：pm_mock_<last4>_<ts> */
  id: string
  brand: string
  last4: string
  expMonth: string
  expYear: string
  createdAt: number
}

function savedCardsKey(userKey: string) {
  return `nexus_saved_cards_${userKey}`
}

/** 读取某用户已保存的支付方式（localStorage，token 化） */
export function getSavedPaymentMethods(userKey: string): SavedPaymentMethod[] {
  try {
    const raw = localStorage.getItem(savedCardsKey(userKey))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** 保存支付方式（仅存品牌 + 末四位 + 有效期，不存明文卡号）；同卡去重后返回 */
export function savePaymentMethod(
  userKey: string,
  card: { brand: string; last4: string; expMonth: string; expYear: string }
): SavedPaymentMethod {
  const methods = getSavedPaymentMethods(userKey)
  const exists = methods.find(
    (m) => m.last4 === card.last4 && m.expMonth === card.expMonth && m.expYear === card.expYear
  )
  if (exists) return exists
  const method: SavedPaymentMethod = {
    id: `pm_mock_${card.last4}_${Date.now()}`,
    ...card,
    createdAt: Date.now(),
  }
  localStorage.setItem(savedCardsKey(userKey), JSON.stringify([...methods, method]))
  return method
}

export function deleteSavedPaymentMethod(userKey: string, id: string): void {
  const methods = getSavedPaymentMethods(userKey).filter((m) => m.id !== id)
  localStorage.setItem(savedCardsKey(userKey), JSON.stringify(methods))
}

export interface PaymentConfirmResult {
  status: PaymentStatus
  orderId?: string
  errorCode?: string
  errorMessage?: string
  action?: { type: '3ds'; transactionId: string }
}

export interface PaymentActionPayload {
  paymentId: string
  transactionId: string
}

export interface PaymentActionResult {
  status: 'succeeded' | 'failed'
  orderId?: string
  errorCode?: string
  errorMessage?: string
}

// ── Mock 网关：模拟 Stripe 测试卡场景（真实网关接入时仅需替换这两个函数） ──
const CARD_SUCCESS = '4242424242424242'
const CARD_DECLINE_GENERIC = '4000000000000002'
const CARD_DECLINE_INSUFFICIENT = '4000000000009995'
const CARD_3DS = '4000002500003155'

type MockScenario =
  | { status: 'succeeded'; orderId: string }
  | { status: 'failed'; errorCode: string; errorMessage: string }
  | { status: 'requires_action'; action: { type: '3ds'; transactionId: string } }

function mockOrderId() {
  return `ORD-${Math.floor(1000 + Math.random() * 9000)}`
}

/** 按卡号路由支付场景（4242 成功卡；其余未匹配卡默认成功） */
function routeCardScenario(digits: string): MockScenario {
  const d = digits.replace(/\s/g, '')
  if (d === CARD_SUCCESS) {
    return { status: 'succeeded', orderId: mockOrderId() }
  }
  if (d === CARD_3DS) {
    return { status: 'requires_action', action: { type: '3ds', transactionId: `tds_${Date.now()}` } }
  }
  if (d === CARD_DECLINE_GENERIC) {
    return { status: 'failed', errorCode: 'card_declined', errorMessage: 'Your card was declined.' }
  }
  if (d === CARD_DECLINE_INSUFFICIENT) {
    return { status: 'failed', errorCode: 'insufficient_funds', errorMessage: 'Your card has insufficient funds.' }
  }
  return { status: 'succeeded', orderId: mockOrderId() }
}

const networkDelay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function createPaymentIntent(payload: PaymentCreatePayload): Promise<PaymentCreateResult> {
  if (USE_MOCK) {
    await networkDelay(600)
    const paymentId = `pi_${Date.now()}_${Math.floor(Math.random() * 10000)}`
    const orderId = mockOrderId()
    return { paymentId, orderId, clientSecret: `mock_cs_${paymentId}` }
  }
  return post<PaymentCreateResult>('/payments/create', payload)
}

export async function confirmPayment(payload: PaymentConfirmPayload): Promise<PaymentConfirmResult> {
  if (USE_MOCK) {
    await networkDelay(600)
    // 已保存支付方式（一键下单）：token 代表此前支付成功的卡，直接成功扣款
    if (payload.savedMethodId) {
      return { status: 'succeeded', orderId: mockOrderId() }
    }
    const digits = payload.cardNumber || payload.cardLast4 || ''
    const scenario = routeCardScenario(digits)
    if (scenario.status === 'requires_action') {
      return { status: 'requires_action', action: scenario.action }
    }
    if (scenario.status === 'failed') {
      return { status: 'failed', errorCode: scenario.errorCode, errorMessage: scenario.errorMessage }
    }
    return { status: 'succeeded', orderId: scenario.orderId }
  }
  return post<PaymentConfirmResult>('/payments/confirm', payload)
}

/** 3DS 认证完成后，银行回调确认支付 */
export async function completePaymentAction(payload: PaymentActionPayload): Promise<PaymentActionResult> {
  if (USE_MOCK) {
    await networkDelay(600)
    return { status: 'succeeded', orderId: mockOrderId() }
  }
  return post<PaymentActionResult>('/payments/complete-action', payload)
}

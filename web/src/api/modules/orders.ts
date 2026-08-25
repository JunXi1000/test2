import { USE_MOCK } from '@/config/env'
import { get, post } from '@/api/http'
import { scopedKey } from '@/stores/userScope'

export interface OrderItem {
  productId?: number
  name: string
  image: string
  price: number
  quantity: number
  color?: string
  size?: string
}

export interface OrderShipping {
  name: string
  phone: string
  address: string
  city: string
  country: string
  zip: string
}

export interface OrderPayment {
  method: 'card' | 'paypal' | 'apple_pay'
  cardBrand?: string
  cardLast4?: string
  paidAt?: string
}

export interface Order {
  id: string
  date: string
  total: number
  subtotal: number
  shippingFee: number
  tax: number
  discount: number
  status: 'Pending' | 'Processing' | 'In Transit' | 'Delivered' | 'Cancelled'
  items: OrderItem[]
  shipping: OrderShipping
  payment: OrderPayment
  trackingNumber?: string
  estimatedDelivery?: string
  note?: string
}

/**
 * 后端 /orders 返回的分组订单结构(Phase 2)。status 为中文状态机值:
 * 待支付 / 待发货 / 待收货 / 已完成 / 已取消 / 已退款 / 已超时。
 */
export interface StorefrontOrderItemDTO {
  id: number
  productId: number
  productName: string
  productMainImg?: string | null
  totalMoney: number
  quantity: number
  status: string
}

export interface StorefrontOrderDTO {
  orderNo: string
  status: string
  createTime?: string | null
  totalMoney: number
  quantity: number
  consigneeName?: string | null
  consigneeTel?: string | null
  consigneeAddress?: string | null
  trackingNumber?: string | null
  remark?: string | null
  items?: StorefrontOrderItemDTO[]
}

/** 后端未带主图时的占位图(内联 SVG,避免 broken img) */
const FALLBACK_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#f1f5f9"/><text x="50%" y="50%" fill="#94a3b8" font-size="10" text-anchor="middle" dominant-baseline="middle">Nexus</text></svg>'
  )

function formatOrderDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** 后端中文状态 -> 前端英文状态 */
function mapStatus(raw: string): Order['status'] {
  switch (raw) {
    case '待支付':
      return 'Pending'
    case '待发货':
      return 'Processing'
    case '待收货':
      return 'In Transit'
    case '已完成':
      return 'Delivered'
    case '已取消':
    case '已退款':
    case '已超时':
      return 'Cancelled'
    default:
      return 'Pending'
  }
}

function mapStorefrontOrder(raw: StorefrontOrderDTO): Order {
  const items: OrderItem[] = (raw.items || []).map((it) => ({
    productId: it.productId,
    name: it.productName || 'Product',
    image: it.productMainImg || FALLBACK_IMG,
    price: it.totalMoney,
    quantity: it.quantity,
  }))
  const total = raw.totalMoney || 0
  return {
    id: raw.orderNo,
    date: formatOrderDate(raw.createTime),
    total,
    // 后端未持久化 运费/税/优惠(展示用,不入账),明细里 Subtotal 以合计呈现
    subtotal: total,
    shippingFee: 0,
    tax: 0,
    discount: 0,
    status: mapStatus(raw.status),
    items,
    shipping: {
      name: raw.consigneeName || '',
      phone: raw.consigneeTel || '',
      address: raw.consigneeAddress || '',
      city: '',
      country: '',
      zip: '',
    },
    payment: { method: 'card', paidAt: formatOrderDate(raw.createTime) },
    trackingNumber: raw.trackingNumber || undefined,
    note: raw.remark || undefined,
  }
}

const MOCK_ORDERS: Order[] = [
  {
    id: 'ORD-7782', date: 'Oct 24, 2026', status: 'In Transit',
    subtotal: 1248.00, shippingFee: 0, tax: 99.84, discount: 48.84, total: 1299.00,
    trackingNumber: 'SF1234567890', estimatedDelivery: 'Oct 30, 2026',
    shipping: { name: 'John Doe', phone: '+1 (555) 123-4567', address: '123 Main St, Apt 4B', city: 'New York', country: 'United States', zip: '10001' },
    payment: { method: 'card', cardBrand: 'Visa', cardLast4: '4242', paidAt: 'Oct 24, 2026 14:32' },
    items: [
      { productId: 1, name: 'Nexus VR Pro', image: 'https://images.unsplash.com/photo-1622979135228-d0a136e145c6?q=80&w=200&auto=format&fit=crop', price: 999.00, quantity: 1, color: 'Obsidian Black', size: 'Pro' },
      { productId: 3, name: 'Smart Ring', image: 'https://images.unsplash.com/photo-1623998021446-45cd9b269056?q=80&w=200&auto=format&fit=crop', price: 249.00, quantity: 1, color: 'Silver', size: 'M' }
    ]
  },
  {
    id: 'ORD-7781', date: 'Oct 12, 2026', status: 'Delivered',
    subtotal: 179.00, shippingFee: 12.00, tax: 14.32, discount: 6.32, total: 199.00,
    shipping: { name: 'John Doe', phone: '+1 (555) 123-4567', address: '123 Main St, Apt 4B', city: 'New York', country: 'United States', zip: '10001' },
    payment: { method: 'card', cardBrand: 'Mastercard', cardLast4: '8888', paidAt: 'Oct 12, 2026 09:15' },
    items: [
      { productId: 5, name: 'Audio Pods X', image: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?q=80&w=200&auto=format&fit=crop', price: 179.00, quantity: 1, color: 'Midnight Black' }
    ]
  },
  {
    id: 'ORD-7540', date: 'Sep 28, 2026', status: 'Delivered',
    subtotal: 849.00, shippingFee: 0, tax: 67.92, discount: 17.92, total: 899.00,
    note: 'Gift packaging requested',
    shipping: { name: 'John Doe', phone: '+1 (555) 123-4567', address: '456 Park Ave', city: 'Los Angeles', country: 'United States', zip: '90001' },
    payment: { method: 'apple_pay', paidAt: 'Sep 28, 2026 18:44' },
    items: [
      { productId: 1, name: 'Nexus VR Pro', image: 'https://images.unsplash.com/photo-1622979135228-d0a136e145c6?q=80&w=200&auto=format&fit=crop', price: 849.00, quantity: 1, color: 'Lunar White', size: 'Standard' }
    ]
  }
]

/** User-placed orders from checkout (prepended before seed mock data). */
const USER_CHECKOUT_ORDERS_KEY = 'nexus_checkout_orders_v1'

function checkoutOrdersKey(): string {
  return scopedKey(USER_CHECKOUT_ORDERS_KEY)
}

export function loadUserCheckoutOrders(): Order[] {
  try {
    const raw = localStorage.getItem(checkoutOrdersKey())
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as Order[]) : []
  } catch {
    return []
  }
}

function saveUserCheckoutOrders(list: Order[]) {
  try {
    localStorage.setItem(checkoutOrdersKey(), JSON.stringify(list))
  } catch {
    /* ignore quota */
  }
}

/** Append a new order from successful checkout (newest first). */
export function appendCheckoutOrder(order: Order) {
  const cur = loadUserCheckoutOrders()
  cur.unshift(order)
  saveUserCheckoutOrders(cur)
}

/** If user cancelled an order that lives in checkout storage, persist status. */
export function persistUserCheckoutOrderStatus(orderId: string, status: Order['status']) {
  const user = loadUserCheckoutOrders()
  const idx = user.findIndex((o) => o.id === orderId)
  if (idx === -1) return
  user[idx] = { ...user[idx], status }
  saveUserCheckoutOrders(user)
}

/**
 * Mock: checkout orders first, then `DEBUG_ORDERS` full replace, else seed `MOCK_ORDERS`.
 * `DEBUG_ORDERS` (if set) replaces only the tail list for dev; user checkout rows stay first.
 */
export function getMergedMockOrders(): Order[] {
  let tail: Order[] = MOCK_ORDERS
  try {
    const ov = localStorage.getItem('DEBUG_ORDERS')
    if (ov) {
      const parsed = JSON.parse(ov) as unknown
      if (Array.isArray(parsed) && parsed.length) tail = parsed as Order[]
    }
  } catch {
    /* keep MOCK_ORDERS */
  }
  return [...loadUserCheckoutOrders(), ...tail]
}

export async function getOrders(): Promise<Order[]> {
  if (USE_MOCK) {
    return Promise.resolve(getMergedMockOrders())
  }
  const raw = await get<StorefrontOrderDTO[]>('/orders')
  return (raw || []).map(mapStorefrontOrder)
}

export async function getRecentOrders(): Promise<Order[]> {
  if (USE_MOCK) return Promise.resolve(getMergedMockOrders().slice(0, 2))
  const raw = await get<StorefrontOrderDTO[]>('/orders/recent')
  return (raw || []).map(mapStorefrontOrder)
}

/**
 * 取消订单(按 orderNo)。mock 模式只改本地 checkout 订单状态;真实模式调用后端。
 */
export async function cancelOrder(orderId: string): Promise<void> {
  if (USE_MOCK) {
    persistUserCheckoutOrderStatus(orderId, 'Cancelled')
    return Promise.resolve()
  }
  await post(`/orders/${encodeURIComponent(orderId)}/cancel`)
}

import { get, put } from '@/api/http'
import { RUNTIME_USE_MOCK } from '@/config/env'

export interface MerchantOrder {
  id: string
  customer: {
    name: string
    email: string
    avatar?: string
  }
  total: number
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  date: string
  items: number // count of items
  paymentMethod: string
}

export interface MerchantOrderDetail extends MerchantOrder {
  shippingAddress: string
  lineItems: Array<{
    id: number
    title: string
    price: number
    quantity: number
    image: string
  }>
}

const MOCK_ORDERS: MerchantOrder[] = [
  {
    id: 'ORD-2023-001',
    customer: { name: 'Alice Smith', email: 'alice@example.com' },
    total: 299.00,
    status: 'pending',
    date: '2023-10-25',
    items: 1,
    paymentMethod: 'Credit Card'
  },
  {
    id: 'ORD-2023-002',
    customer: { name: 'Bob Jones', email: 'bob@example.com' },
    total: 1250.50,
    status: 'processing',
    date: '2023-10-24',
    items: 3,
    paymentMethod: 'PayPal'
  },
  {
    id: 'ORD-2023-003',
    customer: { name: 'Charlie Brown', email: 'charlie@example.com' },
    total: 89.99,
    status: 'shipped',
    date: '2023-10-23',
    items: 2,
    paymentMethod: 'Credit Card'
  },
  {
    id: 'ORD-2023-004',
    customer: { name: 'Diana Prince', email: 'diana@example.com' },
    total: 450.00,
    status: 'delivered',
    date: '2023-10-20',
    items: 1,
    paymentMethod: 'Crypto'
  },
  {
    id: 'ORD-2023-005',
    customer: { name: 'Evan Wright', email: 'evan@example.com' },
    total: 120.00,
    status: 'cancelled',
    date: '2023-10-18',
    items: 4,
    paymentMethod: 'Credit Card'
  }
]

export async function getMerchantOrders(params?: { status?: string; q?: string }): Promise<MerchantOrder[]> {
  if (RUNTIME_USE_MOCK.value) {
    let data = [...MOCK_ORDERS]
    if (params?.status && params.status !== 'all') {
      data = data.filter(o => o.status === params.status)
    }
    if (params?.q) {
      const q = params.q.toLowerCase()
      data = data.filter(o => 
        o.id.toLowerCase().includes(q) || 
        o.customer.name.toLowerCase().includes(q)
      )
    }
    return new Promise(resolve => setTimeout(() => resolve(data), 600))
  }
  return get<MerchantOrder[]>('/merchant/orders', { params })
}

export async function updateMerchantOrderStatus(id: string, status: MerchantOrder['status']): Promise<void> {
  if (RUNTIME_USE_MOCK.value) {
    const order = MOCK_ORDERS.find(o => o.id === id)
    if (order) order.status = status
    return Promise.resolve()
  }
  return put(`/merchant/orders/${id}/status`, { status })
}

export async function getMerchantOrderDetails(id: string): Promise<MerchantOrderDetail> {
  if (RUNTIME_USE_MOCK.value) {
    const order = MOCK_ORDERS.find(o => o.id === id)
    if (!order) throw new Error('Order not found')
    
    return Promise.resolve({
      ...order,
      shippingAddress: '123 Main St, Springfield, IL 62704, USA',
      lineItems: [
        {
          id: 101,
          title: 'Nexus VR Pro',
          price: 299.00,
          quantity: 1,
          image: 'https://images.unsplash.com/photo-1622979135228-d0a136e145c6?q=80&w=200&auto=format&fit=crop'
        }
      ]
    })
  }
  return get<MerchantOrderDetail>(`/merchant/orders/${id}`)
}

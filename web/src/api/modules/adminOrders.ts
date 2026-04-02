import { get, post } from '@/api/http'
import { RUNTIME_USE_MOCK } from '@/config/env'

export interface AdminOrder {
  id: string
  user: string
  merchant: string
  total: number
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  date: string
  items: number
}

const DEFAULT_MOCK_ORDERS: AdminOrder[] = [
  { id: 'ORD-001', user: 'John Doe', merchant: 'Nexus Tech', total: 899, status: 'processing', date: '2023-11-15', items: 1 },
  { id: 'ORD-002', user: 'Alice Smith', merchant: 'Gadget World', total: 299, status: 'shipped', date: '2023-11-14', items: 2 },
  { id: 'ORD-003', user: 'Bob Jones', merchant: 'Electro Hub', total: 150, status: 'delivered', date: '2023-11-10', items: 3 },
  { id: 'ORD-004', user: 'John Doe', merchant: 'Nexus Tech', total: 45, status: 'pending', date: '2023-11-16', items: 1 },
  { id: 'ORD-005', user: 'Charlie Brown', merchant: 'Gadget World', total: 1200, status: 'cancelled', date: '2023-11-01', items: 4 }
]

const STORAGE_KEY = 'mock_admin_orders'

function getMockData(): AdminOrder[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) return JSON.parse(stored)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_ORDERS))
  return DEFAULT_MOCK_ORDERS
}

export async function getAdminOrders(params?: { q?: string; status?: string }): Promise<AdminOrder[]> {
  if (RUNTIME_USE_MOCK.value) {
    let data = getMockData()
    if (params?.status && params.status !== 'all') {
      data = data.filter(o => o.status === params.status)
    }
    if (params?.q) {
      const q = params.q.toLowerCase()
      data = data.filter(o => 
        o.id.toLowerCase().includes(q) || 
        o.user.toLowerCase().includes(q) || 
        o.merchant.toLowerCase().includes(q)
      )
    }
    return new Promise(resolve => setTimeout(() => resolve(data), 500))
  }
  return get<AdminOrder[]>('/admin/orders', { params })
}

export async function adminCancelOrder(id: string): Promise<void> {
  if (RUNTIME_USE_MOCK.value) {
    const list = getMockData()
    const order = list.find(o => o.id === id)
    if (order) {
      order.status = 'cancelled'
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    }
    return Promise.resolve()
  }
  return post(`/admin/orders/${id}/cancel`)
}

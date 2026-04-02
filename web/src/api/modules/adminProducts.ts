import { get, del } from '@/api/http'
import { RUNTIME_USE_MOCK } from '@/config/env'

export interface AdminProduct {
  id: number
  title: string
  merchant: string
  price: number
  status: 'active' | 'draft' | 'archived' | 'banned'
  image: string
}

const MOCK_ADMIN_PRODUCTS: AdminProduct[] = [
  { id: 1, title: 'Nexus VR Pro', merchant: 'Nexus Tech', price: 899, status: 'active', image: 'https://images.unsplash.com/photo-1622979135228-d0a136e145c6?q=80&w=200&auto=format&fit=crop' },
  { id: 2, title: 'Smart Ring', merchant: 'Gadget World', price: 299, status: 'active', image: 'https://images.unsplash.com/photo-1623998021446-45cd9b269056?q=80&w=200&auto=format&fit=crop' },
  { id: 99, title: 'Illegal Item', merchant: 'Dark Web Store', price: 9999, status: 'banned', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=200&auto=format&fit=crop' }
]

export async function getAdminProducts(params?: { q?: string; status?: string }): Promise<AdminProduct[]> {
  if (RUNTIME_USE_MOCK.value) {
    let data = [...MOCK_ADMIN_PRODUCTS]
    if (params?.q) {
      const q = params.q.toLowerCase()
      data = data.filter(p => p.title.toLowerCase().includes(q) || p.merchant.toLowerCase().includes(q))
    }
    if (params?.status && params.status !== 'all') {
      data = data.filter(p => p.status === params.status)
    }
    return Promise.resolve(data)
  }
  return get<AdminProduct[]>('/admin/products', { params })
}

export async function banProduct(id: number): Promise<void> {
  if (RUNTIME_USE_MOCK.value) {
    const p = MOCK_ADMIN_PRODUCTS.find(x => x.id === id)
    if (p) p.status = 'banned'
    return Promise.resolve()
  }
  return del(`/admin/products/${id}/ban`)
}

import { get, post, put, del } from '@/api/http'
import { RUNTIME_USE_MOCK } from '@/config/env'

export interface MerchantProduct {
  id: number
  title: string
  price: number
  stock: number
  category: string
  status: 'active' | 'draft' | 'archived'
  image: string
  sales: number
}

// Initial Mock Data
const DEFAULT_MOCK_PRODUCTS: MerchantProduct[] = [
  { id: 1, title: 'Nexus VR Pro', price: 899, stock: 45, category: 'Electronics', status: 'active', image: 'https://images.unsplash.com/photo-1622979135228-d0a136e145c6?q=80&w=200&auto=format&fit=crop', sales: 120 },
  { id: 2, title: 'Smart Ring', price: 299, stock: 12, category: 'Wearables', status: 'active', image: 'https://images.unsplash.com/photo-1623998021446-45cd9b269056?q=80&w=200&auto=format&fit=crop', sales: 85 },
  { id: 3, title: 'Audio Pods X', price: 199, stock: 0, category: 'Electronics', status: 'archived', image: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?q=80&w=200&auto=format&fit=crop', sales: 340 },
  { id: 4, title: 'Cyber Watch', price: 399, stock: 28, category: 'Wearables', status: 'draft', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=200&auto=format&fit=crop', sales: 0 },
  { id: 5, title: 'Minimal Desk', price: 1299, stock: 5, category: 'Office', status: 'active', image: 'https://images.unsplash.com/photo-1595515106967-1434857ed8dd?q=80&w=200&auto=format&fit=crop', sales: 12 }
]

const STORAGE_KEY = 'mock_merchant_products'

function getMockData(): MerchantProduct[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) return JSON.parse(stored)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_PRODUCTS))
  return DEFAULT_MOCK_PRODUCTS
}

function saveMockData(data: MerchantProduct[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export async function getMerchantProducts(params?: { q?: string; status?: string }): Promise<MerchantProduct[]> {
  if (RUNTIME_USE_MOCK.value) {
    let data = getMockData()
    if (params?.q) {
      const q = params.q.toLowerCase()
      data = data.filter(p => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    }
    if (params?.status && params.status !== 'all') {
      data = data.filter(p => p.status === params.status)
    }
    return new Promise(resolve => setTimeout(() => resolve(data), 500))
  }
  return get<MerchantProduct[]>('/merchant/products', { params })
}

export async function createMerchantProduct(data: Omit<MerchantProduct, 'id' | 'sales'>): Promise<MerchantProduct> {
  if (RUNTIME_USE_MOCK.value) {
    const list = getMockData()
    const newProduct: MerchantProduct = {
      ...data,
      id: Date.now(),
      sales: 0
    }
    list.unshift(newProduct)
    saveMockData(list)
    return Promise.resolve(newProduct)
  }
  return post<MerchantProduct>('/merchant/products', data)
}

export async function updateMerchantProduct(id: number, data: Partial<MerchantProduct>): Promise<MerchantProduct> {
  if (RUNTIME_USE_MOCK.value) {
    const list = getMockData()
    const index = list.findIndex(p => p.id === id)
    if (index === -1) throw new Error('Product not found')
    list[index] = { ...list[index], ...data }
    saveMockData(list)
    return Promise.resolve(list[index])
  }
  return put<MerchantProduct>(`/merchant/products/${id}`, data)
}

export async function deleteMerchantProduct(id: number): Promise<void> {
  if (RUNTIME_USE_MOCK.value) {
    const list = getMockData()
    const filtered = list.filter(p => p.id !== id)
    saveMockData(filtered)
    return Promise.resolve()
  }
  return del(`/merchant/products/${id}`)
}

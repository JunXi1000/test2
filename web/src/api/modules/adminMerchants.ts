import { del, get, post, put } from '@/api/http'
import { RUNTIME_USE_MOCK } from '@/config/env'

export interface AdminMerchant {
  id: string
  storeName: string
  ownerName: string
  email: string
  status: 'pending' | 'active' | 'rejected' | 'suspended'
  joinedAt: string
  revenue: number
}

const STATUS_VALUES: AdminMerchant['status'][] = ['pending', 'active', 'rejected', 'suspended']

/** 统一后端 / 模拟数据里大小写、别名，避免列表里不出现任何管理按钮 */
export function normalizeAdminMerchant(m: AdminMerchant): AdminMerchant {
  const raw = String(m.status ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
  const alias: Record<string, AdminMerchant['status']> = {
    pending: 'pending',
    active: 'active',
    approved: 'active',
    approve: 'active',
    enabled: 'active',
    suspended: 'suspended',
    suspend: 'suspended',
    disabled: 'suspended',
    banned: 'suspended',
    rejected: 'rejected',
    reject: 'rejected',
    denied: 'rejected'
  }
  let status = alias[raw] ?? (STATUS_VALUES.includes(raw as AdminMerchant['status']) ? (raw as AdminMerchant['status']) : null)
  if (!status) status = 'active'
  return { ...m, status }
}

function normalizeList(list: AdminMerchant[]): AdminMerchant[] {
  return list.map(normalizeAdminMerchant)
}

const DEFAULT_MOCK_MERCHANTS: AdminMerchant[] = [
  { id: '1', storeName: 'Nexus Tech', ownerName: 'Alice Smith', email: 'alice@nexus.com', status: 'active', joinedAt: '2023-10-05', revenue: 12450 },
  { id: '2', storeName: 'Gadget World', ownerName: 'Bob Jones', email: 'bob@gadget.com', status: 'pending', joinedAt: '2023-11-02', revenue: 0 },
  { id: '3', storeName: 'Electro Hub', ownerName: 'Charlie Brown', email: 'charlie@electro.com', status: 'suspended', joinedAt: '2023-09-20', revenue: 5600 },
  { id: '4', storeName: 'Fashion Forward', ownerName: 'Diana Prince', email: 'diana@fashion.com', status: 'active', joinedAt: '2023-11-10', revenue: 8900 },
  { id: '5', storeName: 'Green Living', ownerName: 'Evan Green', email: 'evan@eco.com', status: 'pending', joinedAt: '2023-11-15', revenue: 0 },
  { id: '6', storeName: 'Kids Corner', ownerName: 'Fiona White', email: 'fiona@kids.com', status: 'rejected', joinedAt: '2023-10-01', revenue: 0 }
]

const STORAGE_KEY = 'mock_admin_merchants'

function getMockData(): AdminMerchant[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) return JSON.parse(stored)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_MERCHANTS))
  return DEFAULT_MOCK_MERCHANTS
}

function saveMockData(data: AdminMerchant[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export async function getAdminMerchants(params?: { q?: string; status?: string }): Promise<AdminMerchant[]> {
  if (RUNTIME_USE_MOCK.value) {
    let data = getMockData()
    if (params?.status && params.status !== 'all') {
      data = data.filter(m => m.status === params.status)
    }
    if (params?.q) {
      const q = params.q.toLowerCase()
      data = data.filter(
        m =>
          m.storeName.toLowerCase().includes(q) ||
          m.ownerName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
      )
    }
    return new Promise(resolve => setTimeout(() => resolve(normalizeList(data)), 500))
  }
  const list = await get<AdminMerchant[]>('/admin/merchants', { params })
  return normalizeList(list)
}

export async function createMerchant(data: Omit<AdminMerchant, 'id' | 'status' | 'joinedAt' | 'revenue'>): Promise<AdminMerchant> {
  if (RUNTIME_USE_MOCK.value) {
    const list = getMockData()
    const newMerchant: AdminMerchant = {
      ...data,
      id: `M-${Date.now()}`,
      status: 'active',
      joinedAt: new Date().toISOString().split('T')[0],
      revenue: 0
    }
    list.unshift(newMerchant)
    saveMockData(list)
    return Promise.resolve(normalizeAdminMerchant(newMerchant))
  }
  const created = await post<AdminMerchant>('/admin/merchants', data)
  return normalizeAdminMerchant(created)
}

export async function updateMerchant(id: string, data: Partial<AdminMerchant>): Promise<AdminMerchant> {
  if (RUNTIME_USE_MOCK.value) {
    const list = getMockData()
    const index = list.findIndex(m => m.id === id)
    if (index === -1) throw new Error('Merchant not found')
    list[index] = { ...list[index], ...data }
    saveMockData(list)
    return Promise.resolve(normalizeAdminMerchant(list[index]))
  }
  const updated = await put<AdminMerchant>(`/admin/merchants/${id}`, data)
  return normalizeAdminMerchant(updated)
}

export async function approveMerchant(id: string): Promise<void> {
  if (RUNTIME_USE_MOCK.value) {
    const list = getMockData()
    const m = list.find(x => x.id === id)
    if (m) {
      m.status = 'active'
      saveMockData(list)
    }
    return Promise.resolve()
  }
  return post(`/admin/merchants/${id}/approve`)
}

export async function rejectMerchant(id: string): Promise<void> {
  if (RUNTIME_USE_MOCK.value) {
    const list = getMockData()
    const m = list.find(x => x.id === id)
    if (m) {
      m.status = 'rejected'
      saveMockData(list)
    }
    return Promise.resolve()
  }
  return post(`/admin/merchants/${id}/reject`)
}

export async function deleteMerchant(id: string): Promise<void> {
  if (RUNTIME_USE_MOCK.value) {
    const list = getMockData().filter(m => m.id !== id)
    saveMockData(list)
    return Promise.resolve()
  }
  return del(`/admin/merchants/${id}`)
}

import { get, post, put, del } from '@/api/http'
import { RUNTIME_USE_MOCK } from '@/config/env'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: 'user' | 'admin' | 'merchant'
  status: 'active' | 'suspended'
  joinedAt: string
}

const DEFAULT_MOCK_USERS: AdminUser[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', role: 'user', status: 'active', joinedAt: '2023-10-01' },
  { id: '2', name: 'Alice Merchant', email: 'alice@nexus.com', role: 'merchant', status: 'active', joinedAt: '2023-10-05' },
  { id: '3', name: 'Admin User', email: 'admin@nexus.com', role: 'admin', status: 'active', joinedAt: '2023-09-15' },
  { id: '4', name: 'Suspended User', email: 'bad@example.com', role: 'user', status: 'suspended', joinedAt: '2023-11-01' }
]

const STORAGE_KEY = 'mock_admin_users'

function getMockData(): AdminUser[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) return JSON.parse(stored)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_USERS))
  return DEFAULT_MOCK_USERS
}

function saveMockData(data: AdminUser[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export async function getAdminUsers(params?: { q?: string; role?: string }): Promise<AdminUser[]> {
  if (RUNTIME_USE_MOCK.value) {
    let data = getMockData()
    if (params?.role && params.role !== 'all') {
      data = data.filter(u => u.role === params.role)
    }
    if (params?.q) {
      const q = params.q.toLowerCase()
      data = data.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    }
    return new Promise(resolve => setTimeout(() => resolve(data), 500))
  }
  return get<AdminUser[]>('/admin/users', { params })
}

export async function toggleUserStatus(id: string): Promise<AdminUser> {
  if (RUNTIME_USE_MOCK.value) {
    const list = getMockData()
    const user = list.find(u => u.id === id)
    if (!user) throw new Error('User not found')
    user.status = user.status === 'active' ? 'suspended' : 'active'
    saveMockData(list)
    return Promise.resolve(user)
  }
  return post<AdminUser>(`/admin/users/${id}/toggle-status`)
}

export async function updateUser(id: string, data: Partial<AdminUser>): Promise<AdminUser> {
  if (RUNTIME_USE_MOCK.value) {
    const list = getMockData()
    const index = list.findIndex(u => u.id === id)
    if (index === -1) throw new Error('User not found')
    list[index] = { ...list[index], ...data }
    saveMockData(list)
    return Promise.resolve(list[index])
  }
  return put<AdminUser>(`/admin/users/${id}`, data)
}

export async function resetUserPassword(id: string): Promise<void> {
  if (RUNTIME_USE_MOCK.value) {
    // In mock mode, we just simulate success
    return new Promise(resolve => setTimeout(resolve, 500))
  }
  return post(`/admin/users/${id}/reset-password`)
}

export async function deleteUser(id: string): Promise<void> {
  if (RUNTIME_USE_MOCK.value) {
    const list = getMockData()
    const filtered = list.filter(u => u.id !== id)
    saveMockData(filtered)
    return Promise.resolve()
  }
  return del(`/admin/users/${id}`)
}

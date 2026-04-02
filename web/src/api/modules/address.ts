import { USE_MOCK } from '@/config/env'
import { get, post, put, del } from '@/api/http'

export interface Address {
  id: number
  type: 'Home' | 'Work'
  isDefault: boolean
  name: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  country: string
}

const DEFAULT_MOCK_ADDRESSES: Address[] = [
  { id: 1, type: 'Home', isDefault: true, name: 'Alex Doe', phone: '+1 (555) 123-4567', address: '123 Innovation Dr', city: 'San Francisco', state: 'CA', zip: '94103', country: 'United States' },
  { id: 2, type: 'Work', isDefault: false, name: 'Alex Doe', phone: '+1 (555) 987-6543', address: '456 Tech Plaza, Suite 200', city: 'San Jose', state: 'CA', zip: '95110', country: 'United States' }
]

const STORAGE_KEY = 'DEBUG_ADDRESSES'

function getMockData(): Address[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) return JSON.parse(stored)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_ADDRESSES))
  return DEFAULT_MOCK_ADDRESSES
}

function saveMockData(data: Address[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export async function getAddresses(): Promise<Address[]> {
  if (USE_MOCK) {
    return Promise.resolve(getMockData())
  }
  return get<Address[]>('/addresses')
}

export async function createAddress(data: Omit<Address, 'id'>): Promise<Address> {
  if (USE_MOCK) {
    const list = getMockData()
    const newId = Math.max(0, ...list.map(a => a.id)) + 1
    const newAddress = { ...data, id: newId }
    
    // If set as default, unset others
    if (newAddress.isDefault) {
      list.forEach(a => a.isDefault = false)
    }
    
    list.push(newAddress)
    saveMockData(list)
    return Promise.resolve(newAddress)
  }
  return post<Address>('/addresses', data)
}

export async function updateAddress(id: number, data: Partial<Address>): Promise<Address> {
  if (USE_MOCK) {
    const list = getMockData()
    const index = list.findIndex(a => a.id === id)
    if (index === -1) throw new Error('Address not found')
    
    // If set as default, unset others
    if (data.isDefault) {
      list.forEach(a => a.isDefault = false)
    }
    
    list[index] = { ...list[index], ...data }
    saveMockData(list)
    return Promise.resolve(list[index])
  }
  return put<Address>(`/addresses/${id}`, data)
}

export async function deleteAddress(id: number): Promise<void> {
  if (USE_MOCK) {
    const list = getMockData()
    const filtered = list.filter(a => a.id !== id)
    saveMockData(filtered)
    return Promise.resolve()
  }
  return del(`/addresses/${id}`)
}

export async function setDefaultAddress(id: number): Promise<void> {
  if (USE_MOCK) {
    const list = getMockData()
    const target = list.find(a => a.id === id)
    if (target) {
      list.forEach(a => a.isDefault = false)
      target.isDefault = true
      saveMockData(list)
    }
    return Promise.resolve()
  }
  return put(`/addresses/${id}/default`)
}

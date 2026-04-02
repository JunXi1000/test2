import { get, put } from '@/api/http'
import { RUNTIME_USE_MOCK } from '@/config/env'

export interface MerchantSettings {
  storeName: string
  description: string
  /** Shown to customers as store avatar (same as public profile `avatar`). */
  logo: string
  /** City / region; shown on storefront. */
  location: string
  /** Shown as “Replies …” on storefront, e.g. “&lt; 1 hour”. */
  responseTime: string
  policies: {
    shipping: string
    returns: string
  }
  /** Platform / account contact; not shown on public store page. */
  email: string
  notifications: {
    email: boolean
    push: boolean
    sms: boolean
  }
}

const MOCK_SETTINGS: MerchantSettings = {
  storeName: 'Nexus Tech Store',
  description: 'Official retailer for Nexus VR and smart accessories.',
  logo: 'https://images.unsplash.com/photo-1622979135228-d0a136e145c6?q=80&w=200&auto=format&fit=crop',
  location: 'San Francisco, CA',
  responseTime: '< 1 hour',
  policies: {
    shipping: 'Free shipping on orders over $50. Standard delivery 3–7 business days.',
    returns: '30-day returns. Items must be unopened or in original condition.'
  },
  email: 'merchant@nexus.com',
  notifications: {
    email: true,
    push: false,
    sms: true
  }
}

export async function getMerchantSettings(): Promise<MerchantSettings> {
  if (RUNTIME_USE_MOCK.value) return Promise.resolve(MOCK_SETTINGS)
  return get<MerchantSettings>('/merchant/settings')
}

export async function updateMerchantSettings(data: Partial<MerchantSettings>): Promise<MerchantSettings> {
  if (RUNTIME_USE_MOCK.value) {
    Object.assign(MOCK_SETTINGS, data)
    return Promise.resolve(MOCK_SETTINGS)
  }
  return put<MerchantSettings>('/merchant/settings', data)
}

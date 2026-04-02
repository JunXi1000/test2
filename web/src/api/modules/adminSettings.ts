import { get, put } from '@/api/http'
import { RUNTIME_USE_MOCK } from '@/config/env'

export interface AdminSettings {
  siteName: string
  maintenanceMode: boolean
  allowRegistrations: boolean
  commissionRate: number
}

const MOCK_ADMIN_SETTINGS: AdminSettings = {
  siteName: 'Nexus Market',
  maintenanceMode: false,
  allowRegistrations: true,
  commissionRate: 5.0
}

export async function getAdminSettings(): Promise<AdminSettings> {
  if (RUNTIME_USE_MOCK.value) return Promise.resolve(MOCK_ADMIN_SETTINGS)
  return get<AdminSettings>('/admin/settings')
}

export async function updateAdminSettings(data: Partial<AdminSettings>): Promise<AdminSettings> {
  if (RUNTIME_USE_MOCK.value) {
    Object.assign(MOCK_ADMIN_SETTINGS, data)
    return Promise.resolve(MOCK_ADMIN_SETTINGS)
  }
  return put<AdminSettings>('/admin/settings', data)
}

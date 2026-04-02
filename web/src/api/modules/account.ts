import { USE_MOCK } from '@/config/env'
import { get, post } from '@/api/http'

export interface UserProfile { firstName: string; lastName: string; email: string; phone: string; avatar: string }
export interface NotificationPrefs { emailOrder: boolean; emailPromo: boolean; smsOrder: boolean }

const MOCK_PROFILE: UserProfile = {
  firstName: 'Alex', lastName: 'Doe', email: 'alex.doe@example.com', phone: '+1 (555) 123-4567',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop'
}
const MOCK_PREFS: NotificationPrefs = { emailOrder: true, emailPromo: false, smsOrder: true }

export async function getProfile(): Promise<UserProfile> {
  if (USE_MOCK) return Promise.resolve(MOCK_PROFILE)
  return get<UserProfile>('/account/profile')
}

export async function updateProfile(data: Partial<UserProfile>): Promise<void> {
  if (USE_MOCK) return Promise.resolve()
  await post('/account/profile', data)
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  if (USE_MOCK) return Promise.resolve(MOCK_PREFS)
  return get<NotificationPrefs>('/account/notifications')
}

export async function updateNotificationPrefs(data: Partial<NotificationPrefs>): Promise<void> {
  if (USE_MOCK) return Promise.resolve()
  await post('/account/notifications', data)
}

import { USE_MOCK } from '@/config/env'
import { get, post } from '@/api/http'

export interface AppNotification {
  id: number
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  createdAt: number
}

const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** Mock admin notifications (kept so mock mode still shows a populated list). */
const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 1,
    title: 'New Merchant Application',
    message: 'Store "Gadget Pro" has submitted an application for review.',
    type: 'info',
    read: false,
    createdAt: Date.now() - 10 * MIN,
  },
  {
    id: 2,
    title: 'System Update',
    message: 'The system will undergo maintenance tonight at 02:00 AM.',
    type: 'warning',
    read: false,
    createdAt: Date.now() - 2 * HOUR,
  },
  {
    id: 3,
    title: 'High Sales Volume',
    message: 'Merchant "Nike Store" exceeded $50k revenue today.',
    type: 'success',
    read: true,
    createdAt: Date.now() - 5 * HOUR,
  },
  {
    id: 4,
    title: 'Payment Gateway Error',
    message: 'Multiple failed transactions detected on Stripe gateway.',
    type: 'error',
    read: true,
    createdAt: Date.now() - DAY,
  },
]

/** Current user's role-scoped notifications (backend GET /notifications). */
export async function getNotifications(): Promise<AppNotification[]> {
  if (USE_MOCK) return MOCK_NOTIFICATIONS
  return get<AppNotification[]>('/notifications')
}

/** Mark one notification read (backend POST /notifications/:id/read). */
export async function markNotificationRead(id: number): Promise<void> {
  if (USE_MOCK) return Promise.resolve()
  await post(`/notifications/${id}/read`)
}

/** Mark all of the current user's notifications read (backend POST /notifications/read-all). */
export async function markAllNotificationsRead(): Promise<void> {
  if (USE_MOCK) return Promise.resolve()
  await post('/notifications/read-all')
}

/** Compact relative-time string for a timestamp. */
export function formatRelativeTime(ms?: number | null): string {
  if (!ms) return ''
  const diff = Date.now() - ms
  if (diff < MIN) return 'Just now'
  const mins = Math.floor(diff / MIN)
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

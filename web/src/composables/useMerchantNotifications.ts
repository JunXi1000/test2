import { ref, computed } from 'vue'
import { USE_MOCK } from '@/config/env'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  formatRelativeTime,
  type AppNotification,
} from '@/api/modules/notifications'

export type MerchantNotificationType = 'info' | 'success' | 'warning' | 'error'

export interface MerchantNotificationItem {
  id: number
  title: string
  message: string
  type: MerchantNotificationType
  time: string
  read: boolean
}

/** 商户端通知(与顶栏铃铛共用一份状态,标记已读后角标消失) */
const MOCK_NOTIFICATIONS: MerchantNotificationItem[] = [
  {
    id: 1,
    title: 'New order',
    message: 'Order ORD-2023-001 is awaiting fulfillment.',
    type: 'info',
    time: '5 min ago',
    read: false
  },
  {
    id: 2,
    title: 'Payout sent',
    message: 'Your withdrawal of $250.00 has been processed.',
    type: 'success',
    time: '1 hour ago',
    read: false
  },
  {
    id: 3,
    title: 'Buyer message',
    message: 'You have a new reply in Messages.',
    type: 'info',
    time: '3 hours ago',
    read: true
  },
  {
    id: 4,
    title: 'Low stock',
    message: 'Audio Pods X is down to 2 units.',
    type: 'warning',
    time: 'Yesterday',
    read: true
  }
]

const notifications = ref<MerchantNotificationItem[]>(USE_MOCK ? MOCK_NOTIFICATIONS : [])

/** 从后端加载当前角色的通知(非 mock 模式);mock 模式保留内置示例。 */
async function load() {
  if (USE_MOCK) return
  try {
    const items: AppNotification[] = await getNotifications()
    notifications.value = items.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      time: formatRelativeTime(n.createdAt),
      read: n.read,
    }))
  } catch {
    notifications.value = []
  }
}

export function useMerchantNotifications() {
  const unreadCount = computed(() => notifications.value.filter((n) => !n.read).length)
  const hasUnread = computed(() => unreadCount.value > 0)

  function markAsRead(id: number) {
    const item = notifications.value.find((n) => n.id === id)
    if (item) item.read = true
    markNotificationRead(id)
  }

  function markAllAsRead() {
    notifications.value.forEach((n) => {
      n.read = true
    })
    markAllNotificationsRead()
  }

  return {
    notifications,
    unreadCount,
    hasUnread,
    markAsRead,
    markAllAsRead,
    load,
  }
}

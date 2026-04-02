import { ref, computed } from 'vue'

export type MerchantNotificationType = 'info' | 'success' | 'warning' | 'error'

export interface MerchantNotificationItem {
  id: number
  title: string
  message: string
  type: MerchantNotificationType
  time: string
  read: boolean
}

/** 商户端通知（与顶栏铃铛共用一份状态，标记已读后角标消失） */
const notifications = ref<MerchantNotificationItem[]>([
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
])

export function useMerchantNotifications() {
  const unreadCount = computed(() => notifications.value.filter((n) => !n.read).length)
  const hasUnread = computed(() => unreadCount.value > 0)

  function markAsRead(id: number) {
    const item = notifications.value.find((n) => n.id === id)
    if (item) item.read = true
  }

  function markAllAsRead() {
    notifications.value.forEach((n) => {
      n.read = true
    })
  }

  return {
    notifications,
    unreadCount,
    hasUnread,
    markAsRead,
    markAllAsRead
  }
}

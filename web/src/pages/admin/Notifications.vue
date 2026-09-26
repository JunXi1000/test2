<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-white flex items-center gap-2">
        <bell-icon class="w-6 h-6 text-red-500" />
        Notifications
      </h1>
      <el-button v-if="notifications.length > 0" size="small" @click="markAllAsRead">
        Mark all as read
      </el-button>
    </div>

    <ErrorState v-if="errorRef" :message="errorRef" @retry="loadData" />

    <EmptyState
      v-else-if="notifications.length === 0"
      :icon="BellOffIcon"
      title="No notifications"
    />

    <div v-else class="space-y-4">
      <div
        v-for="item in notifications"
        :key="item.id"
        class="admin-list-item-card flex gap-4"
        :class="{ '!border-l-4 !border-l-sky-500 !bg-zinc-800/60': !item.read }"
      >
        <div
          class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          :class="{
            'bg-blue-500/10 text-blue-500': item.type === 'info',
            'bg-emerald-500/10 text-emerald-500': item.type === 'success',
            'bg-amber-500/10 text-amber-500': item.type === 'warning',
            'bg-red-500/10 text-red-500': item.type === 'error',
          }"
        >
          <component :is="getIcon(item.type)" class="w-5 h-5" />
        </div>

        <div class="flex-1">
          <div class="flex justify-between items-start mb-1">
            <h3 class="font-semibold text-white" :class="{ 'text-blue-400': !item.read }">
              {{ item.title }}
            </h3>
            <span class="text-xs text-zinc-500">{{ formatRelativeTime(item.createdAt) }}</span>
          </div>
          <p class="text-zinc-400 text-sm mb-3">{{ item.message }}</p>
          <div v-if="!item.read" class="flex gap-2">
            <button
              class="text-xs text-zinc-500 hover:text-white transition-colors"
              @click="markAsRead(item.id)"
            >
              Mark as read
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  Bell as BellIcon,
  BellOff as BellOffIcon,
  Info,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
} from 'lucide-vue-next'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  formatRelativeTime,
  type AppNotification,
} from '@/api/modules/notifications'
import EmptyState from '@/components/ui/state/EmptyState.vue'
import ErrorState from '@/components/ui/state/ErrorState.vue'
import { useAsyncTask } from '@/composables/useAsyncTask'

const notifications = ref<AppNotification[]>([])
const { error: errorRef, run } = useAsyncTask({
  fallbackMessage: 'Failed to load notifications',
})

async function loadData() {
  // 原先这里是裸的 `onMounted(async () => { notifications.value = await getNotifications() })`，
  // 一个 catch 都没有：取数失败既是**未处理的 Promise rejection**，又让页面照常渲染成
  // 空态「No notifications」—— 又一个「失败被谎报成空」，且无处重试。
  const result = await run(() => getNotifications())
  if (result.ok) notifications.value = result.value
}

onMounted(loadData)

const getIcon = (type: string) => {
  switch (type) {
    case 'success':
      return CheckCircle
    case 'warning':
      return AlertTriangle
    case 'error':
      return AlertCircle
    default:
      return Info
  }
}

const markAsRead = (id: number) => {
  const item = notifications.value.find((n) => n.id === id)
  if (item) item.read = true
  markNotificationRead(id)
}

const markAllAsRead = () => {
  notifications.value.forEach((n) => (n.read = true))
  markAllNotificationsRead()
}
</script>

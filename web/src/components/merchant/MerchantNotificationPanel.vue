<template>
  <div class="merchant-notif-panel flex max-h-[min(70vh,440px)] w-full flex-col">
    <div
      class="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"
    >
      <span class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notifications</span>
      <el-button
        v-if="notifications.length > 0 && hasUnread"
        size="small"
        type="primary"
        link
        class="!p-0 !h-auto"
        @click="markAllAsRead"
      >
        Mark all read
      </el-button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
      <div
        v-if="notifications.length === 0"
        class="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-zinc-500"
      >
        <BellOff class="h-10 w-10 opacity-40" />
        <span>No notifications</span>
      </div>

      <ul v-else class="space-y-2">
        <li
          v-for="item in notifications"
          :key="item.id"
          class="flex gap-3 rounded-lg border px-2.5 py-2.5 text-left transition-colors"
          :class="
            item.read
              ? 'border-zinc-100 bg-zinc-50/80 dark:border-white/5 dark:bg-white/[0.03]'
              : 'border-amber-200/70 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/[0.07]'
          "
        >
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            :class="iconWrapClass(item.type)"
          >
            <component :is="iconFor(item.type)" class="h-4 w-4" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <span
                class="text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100"
                :class="{ 'text-amber-900 dark:text-amber-300': !item.read }"
              >
                {{ item.title }}
              </span>
              <span class="shrink-0 text-[11px] text-zinc-500">{{ item.time }}</span>
            </div>
            <p class="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {{ item.message }}
            </p>
            <button
              v-if="!item.read"
              type="button"
              class="mt-1.5 text-[11px] font-medium text-amber-700 hover:underline dark:text-amber-400"
              @click="markAsRead(item.id)"
            >
              Mark as read
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BellOff, Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-vue-next'
import { useMerchantNotifications } from '@/composables/useMerchantNotifications'
import type { MerchantNotificationType } from '@/composables/useMerchantNotifications'

const { notifications, hasUnread, markAsRead, markAllAsRead } = useMerchantNotifications()

function iconFor(type: MerchantNotificationType) {
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

function iconWrapClass(type: MerchantNotificationType) {
  switch (type) {
    case 'success':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
    case 'warning':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400'
    case 'error':
      return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
    default:
      return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400'
  }
}
</script>

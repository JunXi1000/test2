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

    <div v-if="notifications.length === 0" class="text-center py-20 text-zinc-500">
      <bell-off-icon class="w-16 h-16 mx-auto mb-4 opacity-50" />
      <p>No notifications</p>
    </div>

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
            'bg-red-500/10 text-red-500': item.type === 'error'
          }"
        >
          <component :is="getIcon(item.type)" class="w-5 h-5" />
        </div>
        
        <div class="flex-1">
          <div class="flex justify-between items-start mb-1">
            <h3 class="font-semibold text-white" :class="{ 'text-blue-400': !item.read }">{{ item.title }}</h3>
            <span class="text-xs text-zinc-500">{{ item.time }}</span>
          </div>
          <p class="text-zinc-400 text-sm mb-3">{{ item.message }}</p>
          <div class="flex gap-2" v-if="!item.read">
            <button @click="markAsRead(item.id)" class="text-xs text-zinc-500 hover:text-white transition-colors">Mark as read</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Bell as BellIcon, BellOff as BellOffIcon, Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-vue-next'

interface Notification {
  id: number
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  time: string
  read: boolean
}

const notifications = ref<Notification[]>([
  {
    id: 1,
    title: 'New Merchant Application',
    message: 'Store "Gadget Pro" has submitted an application for review.',
    type: 'info',
    time: '10 mins ago',
    read: false
  },
  {
    id: 2,
    title: 'System Update',
    message: 'The system will undergo maintenance tonight at 02:00 AM.',
    type: 'warning',
    time: '2 hours ago',
    read: false
  },
  {
    id: 3,
    title: 'High Sales Volume',
    message: 'Merchant "Nike Store" exceeded $50k revenue today.',
    type: 'success',
    time: '5 hours ago',
    read: true
  },
  {
    id: 4,
    title: 'Payment Gateway Error',
    message: 'Multiple failed transactions detected on Stripe gateway.',
    type: 'error',
    time: '1 day ago',
    read: true
  }
])

const getIcon = (type: string) => {
  switch (type) {
    case 'success': return CheckCircle
    case 'warning': return AlertTriangle
    case 'error': return AlertCircle
    default: return Info
  }
}

const markAsRead = (id: number) => {
  const item = notifications.value.find(n => n.id === id)
  if (item) item.read = true
}

const markAllAsRead = () => {
  notifications.value.forEach(n => n.read = true)
}
</script>

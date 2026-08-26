<script setup lang="ts">
import { ref, onMounted, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { Package, Truck, Clock, CheckCircle2 } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { getRecentOrders, type Order } from '@/api/modules/orders'
import { getUserDashboardStats, type Stat } from '@/api/modules/dashboard'
import ErrorState from '@/components/ui/state/ErrorState.vue'
import StatusBadge from '@/components/ui/badge/StatusBadge.vue'

const isLoadingRef = ref<boolean>(true)

const stats = ref<Array<Omit<Stat, 'icon'> & { icon: Component }>>([
  { label: 'Total Orders', value: '—', icon: Package },
  { label: 'In Transit', value: '—', icon: Truck },
  { label: 'Pending', value: '—', icon: Clock },
  { label: 'Completed', value: '—', icon: CheckCircle2 },
])

const recentOrders = ref<Order[]>([])
const errorRef = ref<string>('')
const router = useRouter()

async function fetchOverview() {
  try {
    isLoadingRef.value = true
    errorRef.value = ''
    const [s, recent] = await Promise.all([getUserDashboardStats(), getRecentOrders()])
    const byKey = new Map<string, Stat>()
    for (const st of s) {
      const key = normalizeStatLabelToKey(st.label)
      if (key) byKey.set(key, st)
    }
    stats.value = stats.value.map((it) => {
      const key = normalizeStatLabelToKey(it.label)
      const hit = key ? byKey.get(key) : undefined
      return { ...it, value: hit?.value ?? it.value }
    })
    recentOrders.value = recent
  } catch (e: any) {
    errorRef.value = e?.message || 'Failed to load dashboard data'
  } finally {
    isLoadingRef.value = false
  }
}

function normalizeStatLabelToKey(label: string) {
  const t = String(label || '').trim().toLowerCase()
  if (!t) return ''
  // English
  if (t === 'total orders') return 'total_orders'
  if (t === 'in transit') return 'in_transit'
  if (t === 'pending') return 'pending'
  if (t === 'completed') return 'completed'
  // Chinese (common variants)
  if (t === '总订单' || t === '总订单数' || t === '订单总数') return 'total_orders'
  if (t === '运输中' || t === '配送中' || t === '在途') return 'in_transit'
  if (t === '待处理' || t === '待发货' || t === '处理中') return 'pending'
  if (t === '完工' || t === '完成' || t === '已完成') return 'completed'
  return ''
}

onMounted(fetchOverview)

function goToOrders() {
  router.push('/dashboard/orders')
}

function goToOrderDetails(order: Order) {
  router.push({ path: '/dashboard/orders', query: { q: order.id } })
}
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-bold mb-2">Dashboard Overview</h1>
      <p class="text-muted-foreground">Welcome back, Alex. Here's what's happening with your account.</p>
    </div>

    <div v-if="isLoadingRef" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div v-for="i in 4" :key="i" class="bg-secondary/30 p-4 rounded-xl border border-border/50">
        <div class="flex items-center gap-3 mb-2">
          <Skeleton class="w-8 h-8 rounded-lg" />
          <Skeleton class="h-3 w-24 rounded-md" />
        </div>
        <Skeleton class="h-6 w-16 rounded-md" />
      </div>
    </div>
    <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div 
        v-for="stat in stats" 
        :key="stat.label"
        class="bg-secondary/30 p-4 rounded-xl border border-border/50"
      >
        <div class="flex items-center gap-3 mb-2">
          <div class="p-2 bg-background rounded-lg shadow-sm text-primary">
            <component :is="stat.icon" class="w-4 h-4" />
          </div>
          <span class="text-xs font-medium text-muted-foreground">{{ stat.label }}</span>
        </div>
        <div class="text-2xl font-bold">{{ stat.value }}</div>
      </div>
    </div>

    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold">Recent Orders</h2>
        <Button variant="link" class="text-primary p-0 h-auto" @click="goToOrders">View All</Button>
      </div>
      
      <div v-if="isLoadingRef" class="space-y-4">
        <div v-for="i in 2" :key="i" class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-secondary/10">
          <div class="flex items-center gap-4">
            <Skeleton class="w-12 h-12 rounded-lg" />
            <div class="space-y-2">
              <Skeleton class="h-4 w-28 rounded-md" />
              <Skeleton class="h-3 w-44 rounded-md" />
            </div>
          </div>
          <div class="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
            <Skeleton class="h-4 w-16 rounded-md" />
            <Skeleton class="h-6 w-20 rounded-full" />
            <Skeleton class="h-8 w-20 rounded-lg" />
          </div>
        </div>
      </div>
      <ErrorState v-else-if="errorRef" :message="errorRef" @retry="fetchOverview" />
      <div v-else class="space-y-4">
        <div 
          v-for="order in recentOrders" 
          :key="order.id"
          class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-secondary/10 hover:border-primary/30 transition-colors"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
              <Package class="w-6 h-6" />
            </div>
            <div>
              <div class="font-bold">{{ order.id }}</div>
              <div class="text-xs text-muted-foreground">{{ order.date }} • {{ order.items.map(i => i.name).join(', ') }}</div>
            </div>
          </div>
          
          <div class="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
            <div class="font-medium">${{ order.total.toFixed(2) }}</div>
            <div 
              class="inline-flex"
            >
              <StatusBadge :status="order.status" size="md" />
            </div>
            <Button size="sm" variant="outline" @click="goToOrderDetails(order)">Details</Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

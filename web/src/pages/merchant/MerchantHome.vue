<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { DollarSign, ShoppingCart, Package, TrendingUp } from 'lucide-vue-next'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { getMerchantDashboardStats, getLowStock, type MerchantStat } from '@/api/modules/merchantDashboard'
import ErrorState from '@/components/ui/state/ErrorState.vue'

const isLoadingRef = ref<boolean>(true)
const stats = ref<Array<MerchantStat & { iconComp?: any }>>([])
const errorRef = ref<string>('')
const lowStock = ref<{ title: string; sku: string; stock: number }[]>([])

async function fetchStats() {
  try {
    isLoadingRef.value = true
    errorRef.value = ''
    const [data, ls] = await Promise.all([getMerchantDashboardStats(), getLowStock()])
    stats.value = data.map((s) => ({
      ...s,
      iconComp: s.icon === 'DollarSign' ? DollarSign : s.icon === 'ShoppingCart' ? ShoppingCart : s.icon === 'Package' ? Package : TrendingUp
    }))
    lowStock.value = ls
  } catch (e: any) {
    errorRef.value = e?.message || 'Failed to load store stats'
  } finally {
    isLoadingRef.value = false
  }
}

onMounted(fetchStats)
</script>

<template>
  <div class="merchant-page w-full max-w-full space-y-5">
    <div v-if="isLoadingRef" class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-4">
      <div 
        v-for="i in 4" 
        :key="i" 
        class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-xl p-6 shadow-sm"
      >
        <div class="flex items-center justify-between mb-4">
          <Skeleton class="h-3 w-20 rounded-md" />
          <Skeleton class="h-6 w-6 rounded-md" />
        </div>
        <Skeleton class="h-7 w-20 rounded-md mb-1" />
        <Skeleton class="h-3 w-24 rounded-md" />
      </div>
    </div>
    <ErrorState v-else-if="errorRef" :message="errorRef" @retry="fetchStats" />
    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-4">
      <div 
        v-for="stat in stats" 
        :key="stat.label" 
        class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-xl p-6 shadow-sm"
      >
        <div class="flex items-center justify-between mb-4">
          <span class="text-sm font-medium text-zinc-500">{{ stat.label }}</span>
          <div class="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-500">
            <component :is="stat.iconComp" class="w-4 h-4" />
          </div>
        </div>
        <div class="text-2xl font-bold mb-1">{{ stat.value }}</div>
        <p class="text-xs text-emerald-500 font-medium">{{ stat.change }} from last week</p>
      </div>
    </div>

    <div
      class="flex max-h-[min(52vh,26rem)] min-h-[14rem] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 dark:border-white/5 dark:bg-zinc-900 sm:p-6"
    >
      <div class="mb-4 flex shrink-0 items-center justify-between">
        <h3 class="font-semibold">Low Stock</h3>
        <span class="text-xs text-zinc-500">Action needed</span>
      </div>
      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <div v-for="p in lowStock" :key="p.sku" class="flex items-center justify-between p-3 rounded-lg bg-black/5 dark:bg-white/5">
          <div>
            <div class="text-sm font-medium">{{ p.title }}</div>
            <div class="text-xs text-zinc-500">{{ p.sku }}</div>
          </div>
          <div class="text-xs"><span class="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">Stock: {{ p.stock }}</span></div>
        </div>
      </div>
    </div>
  </div>
</template>

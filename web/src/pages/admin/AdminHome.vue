<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { getAdminDashboardStats, getRecentUsers, getRevenueChartData, type AdminStat } from '@/api/modules/adminDashboard'
import ErrorState from '@/components/ui/state/ErrorState.vue'
import StatCard from '@/components/ui/admin/StatCard.vue'
import { use, init, graphic, type ECharts } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const isLoadingRef = ref<boolean>(true)
const stats = ref<AdminStat[]>([])
const errorRef = ref<string>('')
const recentUsers = ref<{ name: string; email: string; joinedAt: string }[]>([])
const chartRef = ref<HTMLElement | null>(null)
let chartInstance: ECharts | null = null

async function fetchStats() {
  try {
    isLoadingRef.value = true
    errorRef.value = ''
    const [data, users, chartData] = await Promise.all([
      getAdminDashboardStats(), 
      getRecentUsers(),
      getRevenueChartData()
    ])
    
    stats.value = data
    recentUsers.value = users
    
    // Initialize Chart
    if (chartData && chartRef.value) {
      await nextTick()
      initChart(chartData)
    }
  } catch (e: any) {
    errorRef.value = e?.message || 'Failed to load admin stats'
  } finally {
    isLoadingRef.value = false
  }
}

function initChart(data: { date: string; value: number }[]) {
  if (!chartRef.value) return
  if (chartInstance) chartInstance.dispose()
  
  chartInstance = init(chartRef.value, 'dark')
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: '#333',
      textStyle: { color: '#fff' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map(item => item.date),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#71717a' }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#27272a' } },
      axisLabel: { color: '#71717a' }
    },
    series: [
      {
        name: 'Revenue',
        type: 'line',
        smooth: true,
        data: data.map(item => item.value),
        symbol: 'none',
        lineStyle: { color: '#10b981', width: 3 },
        areaStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
            { offset: 1, color: 'rgba(16, 185, 129, 0)' }
          ])
        }
      }
    ]
  }
  chartInstance.setOption(option)
}

// Handle resize
const handleResize = () => chartInstance?.resize()

onMounted(() => {
  fetchStats()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
})
</script>

<template>
  <div class="space-y-8">
    <div v-if="isLoadingRef" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div v-for="i in 4" :key="i" class="admin-panel-card">
        <div class="flex items-center justify-between mb-4">
          <Skeleton class="h-3 w-20 rounded-md" />
          <Skeleton class="h-4 w-4 rounded-sm" />
        </div>
        <Skeleton class="h-7 w-20 rounded-md mb-2" />
        <Skeleton class="h-3 w-24 rounded-md" />
      </div>
    </div>
    <ErrorState v-else-if="errorRef" :message="errorRef" @retry="fetchStats" />
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard 
        v-for="stat in stats" 
        :key="stat.label" 
        :label="stat.label"
        :value="stat.value"
        :change="stat.change"
        :icon="stat.icon"
      />
    </div>

    <!-- Charts & Lists -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="admin-panel-card">
        <h3 class="mb-6 font-semibold text-zinc-100">Revenue Overview</h3>
        <div ref="chartRef" class="w-full h-80"></div>
      </div>
      <div class="admin-panel-card flex h-96 flex-col overflow-hidden">
        <div class="mb-4 flex shrink-0 items-center justify-between">
          <h3 class="font-semibold text-zinc-100">Recent Users</h3>
          <span class="text-xs text-zinc-500">Real-time</span>
        </div>
        <div class="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          <div
            v-for="u in recentUsers"
            :key="u.email"
            class="flex items-center justify-between rounded-xl border border-zinc-700/40 bg-zinc-950/40 p-3 transition-colors hover:border-zinc-600/50 hover:bg-zinc-800/40"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                {{ u.name.charAt(0) }}
              </div>
              <div>
                <div class="text-sm font-medium text-zinc-100">{{ u.name }}</div>
                <div class="text-xs text-zinc-500">{{ u.email }}</div>
              </div>
            </div>
            <div class="text-xs text-zinc-400">{{ u.joinedAt }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #3f3f46;
  border-radius: 4px;
}
</style>

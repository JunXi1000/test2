<script setup lang="ts">
import { computed } from 'vue'
import { DollarSign, Users, ShoppingBag, Activity, Store } from 'lucide-vue-next'

interface Props {
  label: string
  value: string | number
  change?: string
  icon?: string // 'DollarSign' | 'Users' | 'ShoppingBag' | 'Activity' | 'Store'
}

const props = defineProps<Props>()

const iconComp = computed(() => {
  switch (props.icon) {
    case 'DollarSign': return DollarSign
    case 'Users': return Users
    case 'ShoppingBag': return ShoppingBag
    case 'Activity': return Activity
    case 'Store': return Store
    default: return Activity
  }
})

const colorClass = computed(() => {
  switch (props.icon) {
    case 'DollarSign': return 'text-emerald-500'
    case 'Users': return 'text-blue-500'
    case 'ShoppingBag': return 'text-purple-500'
    case 'Store': return 'text-amber-500'
    default: return 'text-rose-500'
  }
})
</script>

<template>
  <div
    class="rounded-2xl border border-zinc-700/50 bg-zinc-900/80 p-6 shadow-lg shadow-black/20 ring-1 ring-white/5 transition-colors hover:border-zinc-600/70"
  >
    <div class="flex items-center justify-between mb-4">
      <span class="text-sm font-medium text-zinc-400">{{ label }}</span>
      <component :is="iconComp" class="w-4 h-4" :class="colorClass" />
    </div>
    <div class="text-2xl font-bold mb-1 text-white">{{ value }}</div>
    <p v-if="change" class="text-xs text-zinc-500">{{ change }} from last month</p>
  </div>
</template>

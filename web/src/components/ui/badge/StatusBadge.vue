<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    status: string
    size?: 'sm' | 'md'
    kind?: 'order' | 'order-item'
  }>(),
  {
    size: 'sm',
    kind: 'order'
  }
)

const baseClass = computed(() =>
  props.size === 'md'
    ? 'px-3 py-1 rounded-full text-xs font-medium border'
    : 'px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap'
)

const colorClass = computed(() => {
  const s = props.status
  if (s === 'Pending') return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
  if (s === 'In Transit') return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
  if (s === 'Delivered') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
  if (s === 'Cancelled') return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
  return 'bg-secondary text-muted-foreground border-border'
})
</script>

<template>
  <span :class="[baseClass, colorClass]">
    {{ status }}
  </span>
</template>


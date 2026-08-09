<script setup lang="ts">
import { ChevronRight, Home } from 'lucide-vue-next'

export interface BreadcrumbItem {
  label: string
  to?: string
}

defineProps<{
  items: BreadcrumbItem[]
}>()
</script>

<template>
  <nav aria-label="Breadcrumb" class="flex items-center gap-1 text-sm text-muted-foreground py-2">
    <router-link
      to="/"
      class="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      <Home class="w-3.5 h-3.5" />
      Home
    </router-link>

    <template v-for="(item, index) in items" :key="index">
      <ChevronRight class="w-3.5 h-3.5 shrink-0" />
      <router-link
        v-if="item.to"
        :to="item.to"
        class="hover:text-foreground transition-colors line-clamp-1"
      >
        {{ item.label }}
      </router-link>
      <span v-else class="text-foreground font-medium line-clamp-1">
        {{ item.label }}
      </span>
    </template>
  </nav>
</template>

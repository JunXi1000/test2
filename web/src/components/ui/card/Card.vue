<script setup lang="ts">
import { cn } from '@/utils/cn'

interface Props {
  class?: string | string[] | Record<string, boolean>
}

const props = defineProps<Props>()
</script>

<template>
  <div
    :class="cn(
      'rounded-xl border bg-card text-card-foreground shadow',
      props.class,
    )"
  >
    <slot />
  </div>
</template>

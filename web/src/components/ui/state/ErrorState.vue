<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

interface Props {
  message?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'retry'): void }>()
</script>

<template>
  <div class="flex items-center justify-between gap-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
    <p class="text-sm text-destructive flex-1">{{ props.message || 'Something went wrong. Please try again.' }}</p>
    <Button size="sm" variant="outline" @click="emit('retry')">Retry</Button>
  </div>
</template>

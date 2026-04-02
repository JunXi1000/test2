<script setup lang="ts">
interface Props {
  class?: string
}
const props = defineProps<Props>()
</script>

<template>
  <div :class="['animate-pulse bg-secondary/40 rounded-md', props.class]" />
</template>

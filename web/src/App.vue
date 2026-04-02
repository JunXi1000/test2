<script setup lang="ts">
import { RouterView } from 'vue-router'
import Toaster from '@/components/ui/toast/Toaster.vue'
import PageProgress from '@/components/ui/progress/PageProgress.vue'
</script>

<template>
  <PageProgress />
  <RouterView />
  <Toaster />
</template>

<style>
html, body, #app {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}
</style>

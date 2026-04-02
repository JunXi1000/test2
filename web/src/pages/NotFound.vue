<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
</script>

<template>
  <div class="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4 py-20">
    <div class="w-24 h-24 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground">
      <span class="text-3xl font-black">404</span>
    </div>
    <h1 class="text-2xl font-bold">Page Not Found</h1>
    <p class="text-muted-foreground max-w-md">The page you are looking for doesn't exist or has been moved.</p>
    <router-link to="/">
      <Button>Back to Home</Button>
    </router-link>
  </div>
</template>
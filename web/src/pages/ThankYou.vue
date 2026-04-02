<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import Button from '@/components/ui/button/Button.vue'

const route = useRoute()
const router = useRouter()

const orderId = String(route.query.orderId || '')
const name = String(route.query.name || '')
const total = Number(route.query.total || 0)

function goOrders() {
  router.push({ name: 'DashboardOrders' })
}
</script>

<template>
  <div class="min-h-[60vh] flex items-center justify-center p-6">
    <div class="max-w-lg w-full text-center space-y-4">
      <div class="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 mx-auto flex items-center justify-center">
        <svg viewBox="0 0 24 24" class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
      </div>
      <h1 class="text-2xl font-bold">Thank You!</h1>
      <p class="text-muted-foreground">Your order has been confirmed.</p>
      <div class="mt-4 p-4 rounded-xl border bg-card text-left space-y-2">
        <div class="flex justify-between text-sm"><span class="text-muted-foreground">Order ID</span><span class="font-medium">{{ orderId || 'N/A' }}</span></div>
        <div class="flex justify-between text-sm"><span class="text-muted-foreground">Name</span><span class="font-medium">{{ name || '—' }}</span></div>
        <div class="flex justify-between text-sm"><span class="text-muted-foreground">Total</span><span class="font-medium">${{ total.toFixed(2) }}</span></div>
      </div>
      <div class="flex justify-center gap-2">
        <Button @click="goOrders">View Orders</Button>
        <Button variant="outline" @click="router.push('/')">Continue Shopping</Button>
      </div>
    </div>
  </div>
</template>

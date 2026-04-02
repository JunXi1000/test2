<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const visibleRef = ref<boolean>(false)
const percentRef = ref<number>(0)
let timer: number | undefined

function start() {
  visibleRef.value = true
  percentRef.value = 10
  clearTimer()
  // Simulate progressive loading
  timer = window.setInterval(() => {
    if (percentRef.value < 80) percentRef.value += 10
  }, 200)
}

function finish() {
  clearTimer()
  percentRef.value = 100
  window.setTimeout(() => {
    visibleRef.value = false
    percentRef.value = 0
  }, 250)
}

function clearTimer() {
  if (timer) {
    clearInterval(timer)
    timer = undefined
  }
}

const router = useRouter()

onMounted(() => {
  const removeBefore = router.beforeEach((to, from, next) => {
    if (to.fullPath !== from.fullPath) start()
    next()
  })
  const removeAfter = router.afterEach(() => {
    finish()
  })
  onUnmounted(() => {
    // @ts-expect-error Some router versions return void for guards
    removeBefore?.()
    // @ts-expect-error Some router versions return void for guards
    removeAfter?.()
    clearTimer()
  })
})
</script>

<template>
  <div 
    v-show="visibleRef" 
    class="fixed top-0 left-0 right-0 z-[9999] h-0.5 bg-transparent"
    aria-hidden="true"
  >
    <div 
      class="h-full bg-primary transition-[width] duration-200"
      :style="{ width: percentRef + '%' }"
    />
  </div>
</template>

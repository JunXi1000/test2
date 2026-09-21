<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-vue-next'

const { toasts, dismiss } = useToast()

const getIcon = (variant: string = 'default') => {
  switch (variant) {
    case 'success':
      return CheckCircle2
    case 'destructive':
      return AlertCircle
    case 'warning':
      return AlertTriangle
    default:
      return Info
  }
}

const getVariantClasses = (variant: string = 'default') => {
  switch (variant) {
    case 'success':
      return 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    case 'destructive':
      return 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400'
    case 'warning':
      return 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
    default:
      return 'border-border bg-background text-foreground'
  }
}
</script>

<template>
  <!-- aria-live 挂在**常驻**的外层容器上（不能挂在 TransitionGroup 上，它是随内容增删的，
       某些读屏器会因此完全漏报）。容器从 App.vue 挂载起就在 DOM 里，之后新增的 toast 才会被播报。 -->
  <div
    role="status"
    aria-live="polite"
    aria-atomic="false"
    class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-md pointer-events-none p-4 sm:p-0"
  >
    <TransitionGroup name="toast" tag="div" class="flex flex-col gap-2 items-end">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="pointer-events-auto relative w-full sm:w-80 rounded-xl border p-4 shadow-lg backdrop-blur-md transition-all select-none"
        :class="getVariantClasses(t.variant)"
      >
        <div class="flex gap-3">
          <component :is="getIcon(t.variant)" class="w-5 h-5 mt-0.5 shrink-0" />
          <div class="flex-1">
            <h4 v-if="t.title" class="text-sm font-semibold mb-1">{{ t.title }}</h4>
            <p v-if="t.description" class="text-sm opacity-90 leading-relaxed">
              {{ t.description }}
            </p>
          </div>
          <button
            aria-label="Dismiss notification"
            class="absolute top-4 right-4 p-1 rounded-md opacity-50 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            @click="dismiss(t.id)"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.toast-move {
  transition: all 0.3s ease;
}
</style>

<script setup lang="ts">
/**
 * 3-D Secure 银行验证弹窗（模拟 Stripe 认证步骤）
 * 真实网关接入后，此弹窗替换为 Stripe 的认证 UI 或 iframe，交互保持不变。
 */
import { ShieldCheck, X } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    amount: number
    cardLast4?: string
    bankName?: string
  }>(),
  {
    cardLast4: '****',
    bankName: 'YourBank',
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'complete'): void
  (e: 'reject'): void
  (e: 'cancel'): void
}>()

function close() {
  emit('update:modelValue', false)
  emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="close" />
      <div class="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <!-- 银行头部 -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck class="w-5 h-5" />
            </div>
            <div>
              <p class="text-sm font-semibold leading-tight">{{ bankName }}</p>
              <p class="text-xs text-muted-foreground">3-D Secure</p>
            </div>
          </div>
          <button class="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground" aria-label="Close" @click="close">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="p-6 space-y-5">
          <div>
            <p class="text-sm text-muted-foreground mb-1">Authenticating payment</p>
            <p class="text-2xl font-bold">${{ amount.toFixed(2) }}</p>
            <p class="text-xs text-muted-foreground mt-1">Card ending in {{ cardLast4 }}</p>
          </div>

          <div class="p-4 rounded-xl bg-secondary/40 border border-border space-y-3">
            <p class="text-sm">Confirm this purchase with your bank to complete the payment.</p>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck class="w-4 h-4 flex-shrink-0" />
              <span>Your bank will approve this transaction securely. This is a simulated verification step.</span>
            </div>
          </div>

          <div class="space-y-2.5">
            <Button class="w-full" size="lg" @click="emit('complete')">
              Complete Authentication
            </Button>
            <button
              class="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              @click="emit('reject')"
            >
              Simulate authentication failure
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

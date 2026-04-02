<script setup lang="ts">
import { computed } from 'vue'
import Button from '@/components/ui/button/Button.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    description?: string
    confirmText?: string
    cancelText?: string
    width?: string | number
    danger?: boolean
    showClose?: boolean
  }>(),
  {
    description: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    width: 460,
    danger: false,
    showClose: false
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

function onCancel() {
  emit('cancel')
  visible.value = false
}

function onConfirm() {
  emit('confirm')
}
</script>

<template>
  <el-dialog v-model="visible" :width="width" align-center :show-close="showClose">
    <template #header>
      <div class="flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-full flex items-center justify-center"
          :class="danger ? 'bg-red-500/10 text-red-600' : 'bg-primary/10 text-primary'"
        >
          <slot name="icon" />
        </div>
        <div class="min-w-0">
          <h3 class="text-base font-semibold truncate">{{ title }}</h3>
          <p v-if="description" class="text-xs text-muted-foreground">{{ description }}</p>
        </div>
      </div>
    </template>

    <div class="space-y-3 text-sm">
      <slot />
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button variant="outline" size="sm" @click="onCancel">
          {{ cancelText }}
        </Button>
        <Button
          size="sm"
          :class="danger ? 'bg-red-600 hover:bg-red-700 text-white' : ''"
          @click="onConfirm"
        >
          {{ confirmText }}
        </Button>
      </div>
    </template>
  </el-dialog>
</template>


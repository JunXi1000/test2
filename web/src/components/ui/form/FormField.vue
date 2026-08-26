<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Eye, EyeOff } from 'lucide-vue-next'
import { cn } from '@/utils/cn'

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: '' })

interface Props {
  label?: string
  error?: string
  valid?: boolean
  type?: 'text' | 'email' | 'password'
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  error: '',
  valid: false,
  type: 'text'
})

const { t } = useI18n()

// Vue 3.4 无 useId,用模块级计数器保证实例 id 唯一
let nextFieldId = 0
const inputId = `auth-field-${++nextFieldId}`
const errorId = `${inputId}-error`

const inputRef = ref<HTMLInputElement | null>(null)
const showPassword = ref(false)

const resolvedType = computed(() =>
  props.type === 'password' && showPassword.value ? 'text' : props.type
)

const inputClasses = computed(() =>
  cn(
    'w-full h-10 bg-secondary/50 border rounded-xl pl-10 text-sm outline-none transition-all',
    props.type === 'password' ? 'pr-14' : 'pr-10',
    props.error
      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/30'
      : props.valid
        ? 'border-emerald-500/70 focus:border-emerald-500'
        : 'border-transparent focus:border-primary/50 focus:bg-secondary'
  )
)

function togglePassword() {
  showPassword.value = !showPassword.value
}

function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="space-y-2">
    <div
      v-if="label || $slots.label || $slots.labelEnd"
      class="flex items-center justify-between ml-1"
    >
      <label
        :for="inputId"
        class="text-xs font-medium uppercase tracking-wider text-muted-foreground"
      >
        <slot name="label">{{ label }}</slot>
      </label>
      <slot name="label-end" />
    </div>

    <div class="relative group">
      <slot name="icon" />
      <input
        ref="inputRef"
        v-bind="$attrs"
        :id="inputId"
        v-model="model"
        :type="resolvedType"
        :class="inputClasses"
        :aria-invalid="error ? 'true' : 'false'"
        :aria-describedby="error ? errorId : undefined"
      />
      <div class="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        <Check v-if="valid && !error" class="h-4 w-4 text-emerald-500" aria-hidden="true" />
        <button
          v-if="type === 'password'"
          type="button"
          class="text-muted-foreground transition-colors hover:text-foreground"
          :aria-label="showPassword ? t('auth.hidePassword') : t('auth.showPassword')"
          @click="togglePassword"
        >
          <EyeOff v-if="showPassword" class="h-4 w-4" />
          <Eye v-else class="h-4 w-4" />
        </button>
      </div>
    </div>

    <p v-if="error" :id="errorId" class="mt-0.5 ml-1 text-xs text-red-500">
      {{ error }}
    </p>
  </div>
</template>

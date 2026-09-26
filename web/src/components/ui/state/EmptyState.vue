<script setup lang="ts">
import { cva } from 'class-variance-authority'
import { cn } from '@/utils/cn'
import type { Component } from 'vue'

// 两种形态来自既有页面的真实写法，不是设计出来的：
//   default（富态）—— 图标 + 标题 + 说明 + 可选操作，用于整块列表为空
//   compact（紧凑）—— 无边框单行文案，用于侧栏 / 抽屉 / 局部筛选结果
// default 的 py-16 + 虚线框取自 Returns.vue 与 Coupons.vue（既有页面里最规范的两处）；
// 想要更多留白或带底色，用 class 覆盖（cn/tailwind-merge 会让后面的赢）。
const emptyStateVariants = cva('text-center', {
  variants: {
    variant: {
      default: 'py-16 border border-dashed border-border rounded-xl',
      compact: 'py-12 text-sm text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

// 刻意不写 dark: 变体，而是纯用令牌（border-border / text-muted-foreground）。
// 令牌在 .dark 下会自动换值，所以这一个组件在两种模式下都自动正确 —— 不需要第二套、
// 也不需要 tone prop。
//
// 三个布局现在都把 .dark 挂到了 <html>，本组件在哪儿都成立：
//   DefaultLayout  —— useDark()（@vueuse/core），跟随用户偏好
//   MerchantLayout —— 同样 useDark()（阶段 2b 补的接线；补之前 merchant 的 dark: 变体从未生效）
//   AdminLayout    —— onMounted 里手动 add('dark')，恒定暗色，因为 admin 没有亮色形态
// 因此三个域都不需要给本组件传色或加 tone prop。
interface Props {
  /** lucide 图标组件；仅 default 形态使用 */
  icon?: Component
  title?: string
  description?: string
  variant?: 'default' | 'compact'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
})
</script>

<template>
  <div :class="cn(emptyStateVariants({ variant }), props.class)">
    <template v-if="variant === 'compact'">
      <p v-if="description || title">{{ description || title }}</p>
      <slot />
    </template>

    <template v-else>
      <component :is="icon" v-if="icon" class="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <h3 v-if="title" class="text-lg font-semibold mb-1">{{ title }}</h3>
      <p v-if="description" class="text-muted-foreground text-sm">{{ description }}</p>
      <div v-if="$slots.default" class="mt-4">
        <slot />
      </div>
    </template>
  </div>
</template>

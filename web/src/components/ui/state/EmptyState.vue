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
// 也不需要 tone prop。.dark 由布局里的 useDark()（@vueuse/core）挂到 <html>：
// DefaultLayout 有，故 storefront 与 dashboard 已生效；MerchantLayout 没有（merchant
// 因此恒为亮色，此组件在那里仍按亮色渲染，同样正确）。
// 唯一不能用的是 admin/**：它无条件渲染暗色却没挂 .dark，令牌会解析成亮色值 → 这里会画白边。
// 解法是给 AdminLayout 挂 .dark（见 REFACTOR_PLAN 阶段 2b），不是改本组件。
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

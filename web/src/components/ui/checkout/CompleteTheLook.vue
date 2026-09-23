<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Plus, Sparkles } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import { formatPrice } from '@/utils/format'
import type { Product } from '@/types/product'

/**
 * 结算页复核步的「搭配购买」推荐位。
 *
 * 抽出来的依据：它是结算页里**唯一真正自包含**的一块 —— 只要三个 prop 与两个事件，
 * 不碰表单、不碰金额合计、不碰路由。右栏那块订单摘要看着更像，但它绑了 20 个标识符，
 * 没有抽（见 REFACTOR_PLAN 阶段 7 的记录）。
 *
 * products 为空时整块不渲染：调用方不必自己写 v-if。
 */
interface Props {
  products: Product[]
  /** 选中的 id 集。父组件整块替换 Set 而不是原地增删，所以按引用比较即可 */
  selected: Set<number>
  /** 正在加入购物车，用于防连点 */
  adding?: boolean
}

const props = withDefaults(defineProps<Props>(), { adding: false })

const emit = defineEmits<{
  toggle: [id: number]
  add: []
}>()

const { t } = useI18n()

/** 按钮上的计数。本地算 —— 它只依赖上面两个 prop，没必要让父组件再传一个 */
const selectedCount = computed(() => props.products.filter((p) => props.selected.has(p.id)).length)
</script>

<template>
  <div
    v-if="products.length > 0"
    class="rounded-2xl border border-border bg-card/60 p-4 space-y-3"
    data-testid="complete-the-look"
  >
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div>
        <h3 class="text-sm font-bold flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-primary" />
          {{ t('checkout.completeTheLook') }}
        </h3>
        <p class="text-xs text-muted-foreground mt-0.5">
          {{ t('checkout.completeTheLookDesc') }}
        </p>
      </div>
      <Button
        size="sm"
        :disabled="selectedCount === 0 || adding"
        class="shrink-0"
        @click="emit('add')"
      >
        <Plus class="w-3.5 h-3.5" />
        {{ t('checkout.addToOrder') }} ({{ selectedCount }})
      </Button>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <button
        v-for="p in products"
        :key="p.id"
        :data-ctl-id="p.id"
        class="flex items-center gap-2.5 p-2 rounded-xl border text-left transition-colors"
        :class="
          selected.has(p.id)
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-foreground/30 bg-background'
        "
        @click="emit('toggle', p.id)"
      >
        <div class="relative w-12 h-12 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
          <img :src="p.image" :alt="p.title" class="w-full h-full object-cover" loading="lazy" />
          <span
            class="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center"
            :class="
              selected.has(p.id)
                ? 'bg-primary border-primary text-primary-foreground'
                : 'bg-background border-border'
            "
          >
            <Check v-if="selected.has(p.id)" class="w-3 h-3" />
          </span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-semibold truncate">{{ p.title }}</p>
          <p class="text-[11px] text-muted-foreground mt-0.5">${{ formatPrice(p.price) }}</p>
        </div>
      </button>
    </div>
  </div>
</template>

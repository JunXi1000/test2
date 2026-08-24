<script setup lang="ts">
/**
 * 尺码指南弹窗（阶段 4.2）
 * 对标淘宝/京东/优衣库：服装类商品详情页点 "Size Guide" 弹出
 *  1) 国际尺码对照表（Size / US / UK / EU / 胸围 / 腰围 / 臀围）
 *  2) 身高 + 体重 → 推荐尺码（类似"尺码助手"），可一键选码
 * 推荐算法：先找身高、体重都落在锚点区间内的尺码（精确命中），
 * 否则取到锚点中心的归一化距离最小者（离线确定性，便于测试）。
 */
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Ruler, X, Check, Sparkles } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** 该商品实际在售的尺码（推荐结果会收敛到这些尺码内） */
    sizes: string[]
    /** 当前已在详情页选中的尺码（用于表格高亮） */
    selectedSize?: string
  }>(),
  { selectedSize: '' }
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'select', size: string): void
}>()

interface ChartRow {
  size: string
  us: string
  uk: string
  eu: string
  chestIn: number | null
  waistIn: number | null
  hipIn: number | null
}

/** 服装尺码对照表（英寸），cm 用 in × 2.54 取整展示 */
const SIZE_GUIDE_CHART: ChartRow[] = [
  { size: 'XS', us: 'XS', uk: '8', eu: '34', chestIn: 32, waistIn: 25, hipIn: 34 },
  { size: 'S', us: 'S', uk: '10', eu: '36', chestIn: 35, waistIn: 28, hipIn: 37 },
  { size: 'M', us: 'M', uk: '12', eu: '38', chestIn: 38, waistIn: 31, hipIn: 40 },
  { size: 'L', us: 'L', uk: '14', eu: '40', chestIn: 41, waistIn: 34, hipIn: 43 },
  { size: 'XL', us: 'XL', uk: '16', eu: '42', chestIn: 44, waistIn: 37, hipIn: 46 },
  { size: 'XXL', us: 'XXL', uk: '18', eu: '44', chestIn: 47, waistIn: 40, hipIn: 49 },
]

/** 推荐锚点区间（cm / kg）—— 身高体重都命中则为精确推荐 */
const SIZE_ANCHORS = [
  { size: 'XS', hMin: 150, hMax: 160, wMin: 40, wMax: 50 },
  { size: 'S', hMin: 155, hMax: 170, wMin: 45, wMax: 58 },
  { size: 'M', hMin: 160, hMax: 178, wMin: 52, wMax: 68 },
  { size: 'L', hMin: 168, hMax: 186, wMin: 62, wMax: 82 },
  { size: 'XL', hMin: 175, hMax: 195, wMin: 74, wMax: 96 },
  { size: 'XXL', hMin: 182, hMax: 200, wMin: 88, wMax: 112 },
]

/** 表格只展示该商品在售的尺码；不在表中的尺码补一行占位 */
const chartRows = computed<ChartRow[]>(() => {
  const present = SIZE_GUIDE_CHART.filter((r) => props.sizes.includes(r.size))
  const missing = props.sizes.filter((s) => !SIZE_GUIDE_CHART.some((r) => r.size === s))
  const placeholders = missing.map<ChartRow>((s) => ({ size: s, us: '—', uk: '—', eu: '—', chestIn: null, waistIn: null, hipIn: null }))
  return [...present, ...placeholders]
})

function toCm(inches: number | null): string {
  return inches === null ? '—' : `${Math.round(inches * 2.54)}`
}

const height = ref('')
const weight = ref('')

const recommendedSize = computed<string | null>(() => {
  const h = Number(height.value)
  const w = Number(weight.value)
  if (!h || !w || !props.sizes.length) return null
  const anchors = SIZE_ANCHORS.filter((a) => props.sizes.includes(a.size))
  if (!anchors.length) return null
  const exact = anchors.find((a) => h >= a.hMin && h <= a.hMax && w >= a.wMin && w <= a.wMax)
  if (exact) return exact.size
  let best: string | null = null
  let bestDist = Infinity
  for (const a of anchors) {
    const hC = (a.hMin + a.hMax) / 2
    const wC = (a.wMin + a.wMax) / 2
    const dist = Math.abs(h - hC) / 10 + Math.abs(w - wC) / 5
    if (dist < bestDist) {
      bestDist = dist
      best = a.size
    }
  }
  return best
})

function selectRecommended() {
  if (recommendedSize.value) emit('select', recommendedSize.value)
}

function close() {
  emit('update:modelValue', false)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// 每次打开时重置身高体重，避免残留上次推荐
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      height.value = ''
      weight.value = ''
    }
  }
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Size Guide"
    >
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="close" />
      <div class="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <!-- 头部 -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/30 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Ruler class="w-5 h-5" />
            </div>
            <div>
              <p class="text-sm font-semibold leading-tight">Size Guide</p>
              <p class="text-xs text-muted-foreground">Measurements in cm (inches)</p>
            </div>
          </div>
          <button class="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground" aria-label="Close" @click="close">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="p-5 space-y-5 overflow-y-auto">
          <!-- 对照表 -->
          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Size conversion chart</p>
            <div class="overflow-x-auto rounded-xl border border-border">
              <table class="w-full text-xs">
                <thead>
                  <tr class="bg-secondary/50 text-muted-foreground">
                    <th class="text-left px-3 py-2 font-semibold">Size</th>
                    <th class="text-left px-3 py-2 font-semibold">US</th>
                    <th class="text-left px-3 py-2 font-semibold">UK</th>
                    <th class="text-left px-3 py-2 font-semibold">EU</th>
                    <th class="text-left px-3 py-2 font-semibold">Chest</th>
                    <th class="text-left px-3 py-2 font-semibold">Waist</th>
                    <th class="text-left px-3 py-2 font-semibold">Hip</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in chartRows"
                    :key="row.size"
                    class="border-t border-border"
                    :class="row.size === recommendedSize
                      ? 'bg-primary/10'
                      : row.size === selectedSize
                        ? 'bg-primary/5'
                        : 'hover:bg-secondary/40'"
                    :data-recommended="row.size === recommendedSize ? 'true' : undefined"
                    :data-selected="row.size === selectedSize ? 'true' : undefined"
                  >
                    <td class="px-3 py-2 font-bold">
                      <span class="inline-flex items-center gap-1.5">
                        {{ row.size }}
                        <span v-if="row.size === recommendedSize" class="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary">
                          <Sparkles class="w-3 h-3" />
                          Recommended
                        </span>
                        <Check v-else-if="row.size === selectedSize" class="w-3 h-3 text-primary" />
                      </span>
                    </td>
                    <td class="px-3 py-2">{{ row.us }}</td>
                    <td class="px-3 py-2">{{ row.uk }}</td>
                    <td class="px-3 py-2">{{ row.eu }}</td>
                    <td class="px-3 py-2">{{ toCm(row.chestIn) }}</td>
                    <td class="px-3 py-2">{{ toCm(row.waistIn) }}</td>
                    <td class="px-3 py-2">{{ toCm(row.hipIn) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="text-[11px] text-muted-foreground mt-2">
              Body measurements, not garment measurements. When between sizes, size up for a relaxed fit.
            </p>
          </div>

          <!-- 身高体重推荐 -->
          <div class="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
            <div class="flex items-center gap-2">
              <Sparkles class="w-4 h-4 text-primary" />
              <p class="text-sm font-semibold">Find my size</p>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <label class="space-y-1.5">
                <span class="text-xs font-medium text-muted-foreground">Height (cm)</span>
                <input
                  v-model="height"
                  type="number"
                  min="120"
                  max="220"
                  placeholder="e.g. 175"
                  class="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <label class="space-y-1.5">
                <span class="text-xs font-medium text-muted-foreground">Weight (kg)</span>
                <input
                  v-model="weight"
                  type="number"
                  min="30"
                  max="160"
                  placeholder="e.g. 70"
                  class="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>

            <div class="flex items-center justify-between gap-3 flex-wrap pt-1">
              <p v-if="recommendedSize" class="text-sm">
                Recommended size: <span class="font-bold text-primary">{{ recommendedSize }}</span>
              </p>
              <p v-else class="text-sm text-muted-foreground">Enter your height and weight to get a recommendation.</p>
              <Button
                size="sm"
                :disabled="!recommendedSize"
                @click="selectRecommended"
              >
                Select {{ recommendedSize || 'size' }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

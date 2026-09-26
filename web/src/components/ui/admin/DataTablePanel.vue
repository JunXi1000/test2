<template>
  <!-- 多根模板（Fragment）：迁移前这三块就是页面根节点的三个并列子元素，
       套一层 wrapper 会凭空多一个 DOM 节点。CSS 全是类选择器、没有 `>` 直接
       子选择器，但保持 DOM 不变更稳妥。 -->
  <div class="admin-toolbar-shell">
    <div class="admin-toolbar-inner">
      <slot name="toolbar" />
    </div>
  </div>

  <!-- 取数失败与内容区是互斥的：error 在时整个内容区换成 ErrorState。
       这对 v-if/v-else 在 5 个页面里逐字重复，收进来也顺带保证不会有人漏写 v-else
       （漏写的表现是「错误页和空表格同时出现」）。 -->
  <ErrorState v-if="error" :message="error" @retry="emit('retry')" />

  <div v-else v-loading="loading" :class="shellClass" element-loading-background="transparent">
    <slot />
  </div>
</template>

<script setup lang="ts">
import ErrorState from '@/components/ui/state/ErrorState.vue'

withDefaults(
  defineProps<{
    /** 取数失败的持久态文案。空串表示无错误，与 useAsyncTask 的 error 一致 */
    error?: string
    /**
     * 是否在内容区外壳上盖加载遮罩。
     *
     * 表格页**不传**：它们的 v-loading 挂在 `<el-table>` 上（迁移前就是这样），
     * 挪到外壳上会连 Reviews 的分页条一起罩住。只有网格页（Products）用这里。
     */
    loading?: boolean
    /** 内容区外壳的 class，默认 admin-table-shell；网格页传 admin-grid-shell */
    shellClass?: string
  }>(),
  { error: '', loading: false, shellClass: 'admin-table-shell' },
)

const emit = defineEmits<{ retry: [] }>()
</script>

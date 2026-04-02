<script setup lang="ts">
interface Props {
  modelValue: boolean
  title: string
  size?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: '500px'
})

const emit = defineEmits(['update:modelValue', 'close'])

const handleClose = () => {
  emit('update:modelValue', false)
  emit('close')
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :title="title"
    direction="rtl"
    :size="size"
    destroy-on-close
    class="dark-drawer"
    @close="handleClose"
  >
    <slot></slot>
  </el-drawer>
</template>

<style>
/* Dark mode overrides for Element Plus Drawer/Desc */
.dark-drawer .el-drawer__body {
  background-color: #1a1a1c;
  color: #fff;
}
.dark-drawer .el-drawer__header {
  background-color: #1a1a1c;
  color: #fff;
  margin-bottom: 0;
  border-bottom: 1px solid rgb(39 39 42 / 0.75);
}
.dark-desc .el-descriptions__body {
  background-color: transparent;
  color: #a1a1aa;
}
.dark-desc .el-descriptions__label {
  background-color: rgba(255,255,255,0.02) !important;
  color: #a1a1aa !important;
}
.dark-desc .el-descriptions__content {
  background-color: transparent !important;
  color: #fff !important;
}
.dark-drawer .el-timeline-item__content {
  color: #a1a1aa;
}
</style>

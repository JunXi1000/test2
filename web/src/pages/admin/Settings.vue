<template>
  <div class="p-6">
    <div class="mx-auto w-full max-w-6xl">
      <ErrorState v-if="errorRef" :message="errorRef" @retry="loadData" />

      <div v-else-if="isLoading" class="admin-panel-card space-y-5">
        <div class="grid gap-5 lg:grid-cols-2">
          <Skeleton class="h-4 w-32" />
          <Skeleton class="h-4 w-32" />
        </div>
        <Skeleton class="h-9 w-full" />
        <Skeleton class="h-9 w-full" />
        <Skeleton class="h-24 w-full" />
      </div>

      <div v-else class="admin-panel-card !p-0 overflow-hidden">
        <div
          class="flex flex-col gap-4 border-b border-zinc-800/60 bg-zinc-950/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5"
        >
          <p class="text-sm leading-relaxed text-zinc-400">
            Edit general storefront options and access rules. Nothing is applied until you save.
          </p>
          <el-button
            type="primary"
            class="admin-toolbar-primary-btn w-full shrink-0 sm:w-auto"
            :loading="saving"
            :disabled="!isWriteImplemented"
            :title="notImplementedHint"
            @click="handleSave"
          >
            Save Changes
          </el-button>
        </div>

        <!-- 诚实降级（TASK-002 / C5）：PUT /admin/settings 已改为 501。
             设置**读得到**（GET 仍返回硬编码配置），但写不进去 —— 不能让管理员以为存上了。
             仅在真实后端下提示；mock 模式是本地模拟，保留可保存的演示行为。
             注意：admin 域是**永久暗色**（AdminLayout 恒挂 .dark、页面零 dark: 变体），
             所以这里用无前缀的暗色可读配色，不写 dark:。 -->
        <div
          v-if="!isWriteImplemented"
          data-testid="admin-settings-write-unavailable"
          class="flex items-start gap-2 border-b border-amber-500/20 bg-amber-500/5 px-5 py-3 text-xs leading-relaxed text-amber-200/90 sm:px-6"
        >
          <AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Saving is not available yet: this endpoint is not implemented on the server, so nothing
            would be stored. The values below are still read from the server.
          </span>
        </div>

        <div class="grid lg:grid-cols-2">
          <section
            class="border-b border-zinc-800/60 p-5 sm:p-6 lg:border-b-0 lg:border-r lg:border-zinc-800/60"
          >
            <h3 class="mb-1 text-base font-semibold tracking-tight text-zinc-100">
              General Configuration
            </h3>
            <p class="mb-5 text-xs text-zinc-500">Site identity and platform fee.</p>
            <el-form :model="form" label-position="top" class="dark-form settings-form">
              <el-form-item label="Site Name">
                <el-input v-model="form.siteName" placeholder="Storefront name" />
              </el-form-item>
              <el-form-item label="Platform Commission Rate (%)">
                <el-input-number
                  v-model="form.commissionRate"
                  class="settings-input-number !w-full sm:!w-44"
                  :min="0"
                  :max="100"
                  :precision="1"
                  controls-position="right"
                />
              </el-form-item>
            </el-form>
          </section>

          <section class="p-5 sm:p-6">
            <h3 class="mb-1 text-base font-semibold tracking-tight text-zinc-100">
              Access Control
            </h3>
            <p class="mb-5 text-xs text-zinc-500">Who can reach the site and sign up.</p>

            <div class="space-y-1 rounded-xl border border-zinc-800/50 bg-zinc-950/30 p-4">
              <div class="flex items-start justify-between gap-4 py-2">
                <div class="min-w-0">
                  <div class="font-medium text-zinc-200">Maintenance Mode</div>
                  <div class="mt-0.5 text-sm text-zinc-500">
                    Disable access for all non-admin users.
                  </div>
                </div>
                <el-switch v-model="form.maintenanceMode" class="shrink-0" />
              </div>

              <el-divider class="!my-3 border-zinc-800/60" />

              <div class="flex items-start justify-between gap-4 py-2">
                <div class="min-w-0">
                  <div class="font-medium text-zinc-200">Allow New Registrations</div>
                  <div class="mt-0.5 text-sm text-zinc-500">Toggle user and merchant signups.</div>
                </div>
                <el-switch v-model="form.allowRegistrations" class="shrink-0" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import {
  getAdminSettings,
  updateAdminSettings,
  type AdminSettings,
} from '@/api/modules/adminSettings'
import ErrorState from '@/components/ui/state/ErrorState.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { AlertTriangle } from 'lucide-vue-next'
import { useAsyncTask } from '@/composables/useAsyncTask'
import { useToast } from '@/composables/useToast'
import { useWriteEndpointAvailability } from '@/composables/useWriteEndpointAvailability'
import { toErrorMessage } from '@/utils/error'

const { toast } = useToast()
// PUT /admin/settings 已按契约 C5 改为 501：真实后端下按钮必须禁用并说明，
// 否则管理员会以为改完保存了，而服务端什么都没写（见组合式注释）
const { isWriteImplemented, notImplementedHint } = useWriteEndpointAvailability()
const saving = ref(false)
const form = reactive<AdminSettings>({
  siteName: '',
  maintenanceMode: false,
  allowRegistrations: true,
  commissionRate: 0,
})

// 首帧会先渲染出一张全空的可编辑表单，再被真实数据顶掉 —— 闪一帧比多一个骨架屏更糟，
// 所以这里预置为加载中（与 AdminHome / MerchantHome 等首帧会渲染空态的页面一致）。
const { isLoading, error: errorRef, run } = useAsyncTask({
  fallbackMessage: 'Failed to load settings',
  initialLoading: true,
})

const loadData = async () => {
  // 这一页的静默失败比列表页更危险：取数失败时 form 保持全空，页面照样渲染成一张
  // 可编辑的表单，管理员顺手点「Save Changes」就会把空值/默认值写回服务端，
  // 覆盖掉真实配置。改成失败时不出表单，只给可重试的错误态。
  const result = await run(() => getAdminSettings())
  if (result.ok) Object.assign(form, result.value)
}

const handleSave = async () => {
  // 双保险：按钮在未实现时已禁用，这里再挡一次，避免将来有人把 disabled 摘掉
  if (!isWriteImplemented.value) {
    toast({
      title: 'Saving is not available yet',
      description: notImplementedHint.value,
      variant: 'warning',
    })
    return
  }
  saving.value = true
  try {
    await updateAdminSettings(form)
    toast({ title: 'Settings updated', variant: 'success' })
  } catch (e) {
    // 用 toErrorMessage 而不是固定文案：后端 501 的具体原因（"尚未实现…"）就在 e.message 里
    toast({
      title: 'Failed to save settings',
      description: toErrorMessage(e, 'Please try again.'),
      variant: 'destructive',
    })
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
</script>

<style>
.dark-form .el-form-item__label {
  color: #a1a1aa;
}
.dark-form .el-input__wrapper {
  background-color: rgba(0, 0, 0, 0.2);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
}
.dark-form .el-input__inner {
  color: white;
}
.settings-form .el-input-number .el-input__wrapper {
  background-color: rgba(0, 0, 0, 0.2);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
}
.settings-form .el-input-number .el-input__inner {
  color: white;
}
</style>

<template>
  <div class="p-6">
    <div class="mx-auto w-full max-w-6xl">
      <div class="admin-panel-card !p-0 overflow-hidden">
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
            @click="handleSave"
          >
            Save Changes
          </el-button>
        </div>

        <div class="grid lg:grid-cols-2">
          <section
            class="border-b border-zinc-800/60 p-5 sm:p-6 lg:border-b-0 lg:border-r lg:border-zinc-800/60"
          >
            <h3 class="mb-1 text-base font-semibold tracking-tight text-zinc-100">General Configuration</h3>
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
            <h3 class="mb-1 text-base font-semibold tracking-tight text-zinc-100">Access Control</h3>
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
import { ElMessage } from 'element-plus'
import { getAdminSettings, updateAdminSettings, type AdminSettings } from '@/api/modules/adminSettings'

const saving = ref(false)
const form = reactive<AdminSettings>({
  siteName: '',
  maintenanceMode: false,
  allowRegistrations: true,
  commissionRate: 0
})

const loadData = async () => {
  try {
    const data = await getAdminSettings()
    Object.assign(form, data)
  } catch (error) {
    ElMessage.error('Failed to load settings')
  }
}

const handleSave = async () => {
  saving.value = true
  try {
    await updateAdminSettings(form)
    ElMessage.success('Settings updated')
  } catch (error) {
    ElMessage.error('Failed to save settings')
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

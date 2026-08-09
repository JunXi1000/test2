<template>
  <div class="merchant-page mx-auto w-full max-w-6xl">
    <div
      class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-1 ring-zinc-100 dark:border-zinc-700/80 dark:bg-zinc-900/70 dark:ring-white/5"
    >
      <div
        class="flex flex-col gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-700/80 sm:flex-row sm:items-center sm:justify-between sm:px-5"
      >
        <p class="text-sm leading-snug text-zinc-500 dark:text-zinc-400">
          Storefront, notifications, and security — save applies to the active tab’s data.
        </p>
        <el-button type="primary" class="w-full shrink-0 sm:w-auto" :loading="saving" @click="handleSave">
          <SaveIcon class="mr-2 h-4 w-4" />
          Save Changes
        </el-button>
      </div>

      <el-tabs v-model="activeTab" class="merchant-settings-tabs">
        <el-tab-pane label="Store Profile" name="profile">
          <div
            class="px-4 pb-5 pt-4 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-6 lg:pb-6 xl:grid-cols-[minmax(0,1fr)_19rem] xl:gap-8"
          >
            <!-- Editor: aligned to public store fields -->
            <div class="min-w-0 space-y-6">
              <div>
                <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">What customers see</h3>
                <p class="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  These fields match your public storefront and product pages (store header, policies sidebar, and
                  merchant card).
                </p>
              </div>

              <el-form :model="form" label-position="top" class="settings-form space-y-1">
                <el-form-item label="Store name">
                  <el-input v-model="form.storeName" placeholder="Your store name" maxlength="80" show-word-limit />
                </el-form-item>

                <el-form-item label="Store description">
                  <el-input
                    v-model="form.description"
                    type="textarea"
                    :rows="4"
                    placeholder="Short introduction shoppers see on your store page and in listings."
                    maxlength="600"
                    show-word-limit
                  />
                </el-form-item>

                <el-form-item>
                  <template #label>
                    <span>Store logo</span>
                    <span class="ml-1 font-normal text-zinc-400">(avatar on storefront)</span>
                  </template>
                  <input
                    ref="logoFileInputRef"
                    type="file"
                    class="sr-only"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    aria-hidden="true"
                    @change="onLogoFileInputChange"
                  />
                  <div class="flex flex-col gap-4 sm:flex-row sm:items-stretch">
                    <div class="relative w-full max-w-[10.5rem] shrink-0">
                      <button
                        type="button"
                        class="group flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed bg-zinc-50 p-2 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:bg-zinc-800/40"
                        :class="
                          logoDropActive
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40'
                            : 'border-zinc-200 hover:border-amber-300 hover:bg-amber-50/40 dark:border-zinc-600 dark:hover:border-amber-600/50 dark:hover:bg-amber-950/20'
                        "
                        aria-label="Upload logo by click or drop image"
                        @click="triggerLogoFilePick"
                        @keydown.enter.prevent="triggerLogoFilePick"
                        @keydown.space.prevent="triggerLogoFilePick"
                        @dragover.prevent="logoDropActive = true"
                        @dragleave.prevent="logoDropActive = false"
                        @drop.prevent="onLogoDrop"
                      >
                        <div
                          class="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-1.5"
                        >
                          <div
                            class="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center overflow-hidden rounded-lg border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-600 dark:bg-zinc-900"
                          >
                            <img
                              v-if="previewLogo"
                              :src="form.logo"
                              alt=""
                              class="h-full w-full object-cover"
                              @error="onPreviewImgError"
                            />
                            <ImageIcon v-else class="h-9 w-9 text-zinc-300 dark:text-zinc-600" />
                          </div>
                          <span class="text-[10px] font-medium leading-tight text-zinc-500 dark:text-zinc-400">
                            Drop image here or click
                          </span>
                          <span class="inline-flex items-center gap-0.5 text-[10px] text-amber-700/80 dark:text-amber-400/90">
                            <UploadIcon class="h-3 w-3" />
                            Local file
                          </span>
                        </div>
                      </button>
                      <button
                        v-if="hasLogo"
                        type="button"
                        class="absolute -right-1.5 -top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-md transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-red-500/50 dark:hover:bg-red-950/50"
                        title="Remove logo"
                        aria-label="Remove logo"
                        @click.stop="clearLogo"
                      >
                        <XIcon class="h-4 w-4" />
                      </button>
                    </div>
                    <div class="min-w-0 flex-1 space-y-2">
                      <p class="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                        JPG, PNG, WebP or GIF · max {{ MAX_LOGO_MB }} MB. Uploads to the platform server;
                        in mock mode a local preview is used instead.
                      </p>
                      <div>
                        <span class="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">Image URL</span>
                        <el-input
                          v-model="form.logo"
                          clearable
                          placeholder="https://example.com/logo.png"
                          class="w-full"
                        />
                        <p class="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                          Paste a direct link to an image — or clear with the × on the preview.
                        </p>
                      </div>
                    </div>
                  </div>
                </el-form-item>

                <div class="grid gap-4 sm:grid-cols-2">
                  <el-form-item label="Location">
                    <template #label>
                      <span class="inline-flex items-center gap-1">
                        <MapPinIcon class="h-3.5 w-3.5 text-zinc-400" />
                        Location
                      </span>
                    </template>
                    <el-input v-model="form.location" placeholder="e.g. San Francisco, CA" maxlength="120" />
                  </el-form-item>

                  <el-form-item>
                    <template #label>
                      <span class="inline-flex items-center gap-1">
                        <ClockIcon class="h-3.5 w-3.5 text-zinc-400" />
                        Typical reply time
                      </span>
                    </template>
                    <el-select
                      v-model="form.responseTime"
                      filterable
                      allow-create
                      default-first-option
                      class="w-full"
                      placeholder="How fast you usually reply"
                    >
                      <el-option v-for="opt in responseTimePresets" :key="opt" :label="opt" :value="opt" />
                    </el-select>
                  </el-form-item>
                </div>

                <el-divider content-position="left" class="!my-6">
                  <span class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Store policies</span>
                </el-divider>

                <el-form-item>
                  <template #label>
                    <span class="inline-flex items-center gap-1">
                      <TruckIcon class="h-3.5 w-3.5 text-zinc-400" />
                      Shipping policy
                    </span>
                  </template>
                  <el-input
                    v-model="form.policies.shipping"
                    type="textarea"
                    :rows="3"
                    placeholder="Shipping regions, fees, and delivery time — shown in the store sidebar."
                    maxlength="800"
                    show-word-limit
                  />
                </el-form-item>

                <el-form-item>
                  <template #label>
                    <span class="inline-flex items-center gap-1">
                      <RotateCcwIcon class="h-3.5 w-3.5 text-zinc-400" />
                      Returns & refunds
                    </span>
                  </template>
                  <el-input
                    v-model="form.policies.returns"
                    type="textarea"
                    :rows="3"
                    placeholder="Return window and conditions — shown next to shipping policy."
                    maxlength="800"
                    show-word-limit
                  />
                </el-form-item>
              </el-form>

              <el-divider />

              <div>
                <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Account only</h3>
                <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Not displayed on your public store page.</p>
              </div>

              <el-form :model="form" label-position="top">
                <el-form-item label="Contact email">
                  <el-input v-model="form.email" placeholder="contact@example.com" type="email" />
                  <p class="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                    Used for platform notifications and buyer support workflows.
                  </p>
                </el-form-item>
              </el-form>
            </div>

            <!-- Customer preview: fixed width column, closer to form -->
            <aside
              class="mt-6 h-fit rounded-xl border border-zinc-200/90 bg-gradient-to-b from-zinc-50/90 to-white p-3 shadow-sm ring-1 ring-zinc-100/80 dark:border-zinc-600/80 dark:from-zinc-800/50 dark:to-zinc-900 dark:ring-white/5 lg:mt-0 lg:sticky lg:top-4 lg:self-start lg:p-4"
            >
              <div class="mb-2.5 flex items-center justify-between gap-2">
                <span class="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Customer preview
                </span>
                <EyeIcon class="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
              </div>

              <div class="rounded-lg border border-zinc-200/80 bg-white p-3 shadow-sm dark:border-zinc-600/80 dark:bg-zinc-950/50">
                <div class="flex gap-2.5">
                  <div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                    <img
                      v-if="previewLogo"
                      :src="previewLogo"
                      alt=""
                      class="h-full w-full object-cover"
                      @error="onPreviewImgError"
                    />
                    <div v-else class="flex h-full w-full items-center justify-center text-zinc-300 dark:text-zinc-600">
                      <ImageIcon class="h-5 w-5" />
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">{{ previewName }}</div>
                    <p class="mt-0.5 line-clamp-3 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                      {{ previewDescription }}
                    </p>
                  </div>
                </div>

                <div class="mt-2.5 flex flex-wrap gap-x-2.5 gap-y-1 border-t border-zinc-100 pt-2.5 text-[10px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  <span class="inline-flex items-center gap-0.5">
                    <StarIcon class="h-3 w-3 text-amber-500" />
                    <span class="font-medium text-zinc-700 dark:text-zinc-200">—</span>
                    <span class="text-zinc-400">(ratings)</span>
                  </span>
                  <span v-if="previewLocation" class="inline-flex items-center gap-0.5">
                    <MapPinIcon class="h-3 w-3" />
                    {{ previewLocation }}
                  </span>
                  <span v-if="previewResponse" class="inline-flex items-center gap-0.5">
                    <ClockIcon class="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    Replies {{ previewResponse }}
                  </span>
                </div>

                <div class="mt-2.5 space-y-1.5 border-t border-zinc-100 pt-2.5 dark:border-zinc-700">
                  <p class="text-[10px] font-semibold text-zinc-700 dark:text-zinc-200">Policies</p>
                  <div class="flex gap-2 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                    <TruckIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <p class="line-clamp-3">{{ previewShipping || 'Shipping policy…' }}</p>
                  </div>
                  <div class="flex gap-2 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                    <RotateCcwIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <p class="line-clamp-3">{{ previewReturns || 'Returns policy…' }}</p>
                  </div>
                </div>

                <p class="mt-2.5 border-t border-zinc-100 pt-2 text-[10px] leading-snug text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                  Product count, sales, and ratings come from the platform. A verified badge may appear next to your
                  name when your store qualifies.
                </p>
              </div>
            </aside>
          </div>
        </el-tab-pane>

        <el-tab-pane label="Notifications" name="notifications">
          <div class="max-w-xl space-y-6 px-4 pb-6 pt-4 sm:px-5">
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <div class="font-medium text-zinc-900 dark:text-zinc-100">Email Notifications</div>
                <div class="text-sm text-zinc-500 dark:text-zinc-400">
                  Receive daily summaries and critical alerts via email.
                </div>
              </div>
              <el-switch v-model="form.notifications.email" class="shrink-0" />
            </div>

            <el-divider class="border-zinc-200 dark:border-zinc-700" />

            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <div class="font-medium text-zinc-900 dark:text-zinc-100">Push Notifications</div>
                <div class="text-sm text-zinc-500 dark:text-zinc-400">
                  Receive real-time alerts for new orders on your device.
                </div>
              </div>
              <el-switch v-model="form.notifications.push" class="shrink-0" />
            </div>

            <el-divider class="border-zinc-200 dark:border-zinc-700" />

            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <div class="font-medium text-zinc-900 dark:text-zinc-100">SMS Alerts</div>
                <div class="text-sm text-zinc-500 dark:text-zinc-400">Get text messages for urgent account issues.</div>
              </div>
              <el-switch v-model="form.notifications.sms" class="shrink-0" />
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="Security" name="security">
          <div class="max-w-xl px-4 pb-6 pt-4 sm:px-5">
            <el-alert
              title="Security Settings Managed by Admin"
              type="info"
              description="Password changes and 2FA settings are currently managed through the main account portal."
              show-icon
              :closable="false"
              class="mb-6"
            />

            <el-button type="default" disabled>Change Password</el-button>
            <el-button type="default" disabled class="ml-4">Enable 2FA</el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import {
  Save as SaveIcon,
  Image as ImageIcon,
  Upload as UploadIcon,
  X as XIcon,
  MapPin as MapPinIcon,
  Clock as ClockIcon,
  Truck as TruckIcon,
  RotateCcw as RotateCcwIcon,
  Eye as EyeIcon,
  Star as StarIcon
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import { getMerchantSettings, updateMerchantSettings, type MerchantSettings } from '@/api/modules/merchantSettings'
import { uploadFile } from '@/api/modules/upload'
import { RUNTIME_USE_MOCK } from '@/config/env'

const responseTimePresets = ['< 30 minutes', '< 1 hour', '< 2 hours', '< 24 hours', '1–3 business days'] as const

const MAX_LOGO_MB = 2
const MAX_LOGO_BYTES = MAX_LOGO_MB * 1024 * 1024
const LOGO_MIME = /^image\/(jpeg|png|webp|gif)$/i

function normalizeSettings(data: Partial<MerchantSettings>): MerchantSettings {
  return {
    storeName: data.storeName ?? '',
    description: data.description ?? '',
    email: data.email ?? '',
    logo: data.logo ?? '',
    location: data.location ?? '',
    responseTime: data.responseTime ?? '< 1 hour',
    policies: {
      shipping: data.policies?.shipping ?? '',
      returns: data.policies?.returns ?? ''
    },
    notifications: {
      email: data.notifications?.email ?? false,
      push: data.notifications?.push ?? false,
      sms: data.notifications?.sms ?? false
    }
  }
}

const activeTab = ref('profile')
const saving = ref(false)
const previewLogoBroken = ref(false)
const logoDropActive = ref(false)
const logoFileInputRef = ref<HTMLInputElement | null>(null)

function validateLogoFile(file: File): string | null {
  if (!file.type || !LOGO_MIME.test(file.type)) {
    return 'Please use JPG, PNG, WebP, or GIF.'
  }
  if (file.size > MAX_LOGO_BYTES) {
    return `Image must be ${MAX_LOGO_MB} MB or smaller.`
  }
  return null
}

async function applyLogoFromFile(file: File) {
  const msg = validateLogoFile(file)
  if (msg) {
    ElMessage.warning(msg)
    return
  }
  if (RUNTIME_USE_MOCK.value) {
    // Mock mode: keep the local data-URL preview (no backend).
    const reader = new FileReader()
    reader.onload = () => {
      const r = reader.result
      if (typeof r === 'string') form.logo = r
    }
    reader.onerror = () => ElMessage.error('Could not read the file.')
    reader.readAsDataURL(file)
    return
  }
  // Real backend: upload to /file/upload and store the returned URL.
  try {
    ElMessage.info('Uploading logo…')
    const { url } = await uploadFile(file)
    form.logo = url
    ElMessage.success('Logo uploaded')
  } catch {
    ElMessage.error('Upload failed. You can paste an image URL instead.')
  }
}

function triggerLogoFilePick() {
  logoFileInputRef.value?.click()
}

function onLogoFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) applyLogoFromFile(file)
}

function onLogoDrop(e: DragEvent) {
  logoDropActive.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) applyLogoFromFile(file)
}

const form = reactive<MerchantSettings>(normalizeSettings({}))

const previewName = computed(() => form.storeName.trim() || 'Your store name')
const previewDescription = computed(() => form.description.trim() || 'Store description will appear here.')
const previewLocation = computed(() => form.location.trim())
const previewResponse = computed(() => form.responseTime.trim())
const previewShipping = computed(() => form.policies.shipping.trim())
const previewReturns = computed(() => form.policies.returns.trim())
const hasLogo = computed(() => form.logo.trim().length > 0)

const previewLogo = computed(() => {
  if (previewLogoBroken.value) return ''
  const u = form.logo.trim()
  return u
})

function clearLogo() {
  form.logo = ''
  previewLogoBroken.value = false
}

function onPreviewImgError() {
  previewLogoBroken.value = true
}

watch(
  () => form.logo,
  () => {
    previewLogoBroken.value = false
  }
)

const loadData = async () => {
  try {
    const data = await getMerchantSettings()
    Object.assign(form, normalizeSettings(data))
  } catch {
    ElMessage.error('Failed to load settings')
  }
}

const handleSave = async () => {
  saving.value = true
  try {
    await updateMerchantSettings(form)
    ElMessage.success('Settings saved successfully')
  } catch {
    ElMessage.error('Failed to save settings')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.merchant-settings-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 1rem;
  border-bottom: 1px solid rgb(228 228 231 / 0.9);
}

@media (min-width: 640px) {
  .merchant-settings-tabs :deep(.el-tabs__header) {
    padding-left: 1.25rem;
    padding-right: 1.25rem;
  }
}

.dark .merchant-settings-tabs :deep(.el-tabs__header) {
  border-bottom-color: rgb(63 63 70 / 0.85);
}

.merchant-settings-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.merchant-settings-tabs :deep(.el-tabs__item) {
  font-weight: 500;
  color: rgb(113 113 122);
}

.dark .merchant-settings-tabs :deep(.el-tabs__item) {
  color: rgb(161 161 170);
}

.merchant-settings-tabs :deep(.el-tabs__item.is-active) {
  color: rgb(24 24 27);
  font-weight: 600;
}

.dark .merchant-settings-tabs :deep(.el-tabs__item.is-active) {
  color: rgb(250 250 250);
}

.merchant-settings-tabs :deep(.el-tabs__active-bar) {
  height: 2px;
  border-radius: 2px 2px 0 0;
}
</style>

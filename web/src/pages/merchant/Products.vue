<template>
  <div class="merchant-page w-full max-w-full space-y-4">
    <!-- Toolbar + table in one panel: better horizontal space use, no orphan action row -->
    <el-card shadow="never" class="merchant-data-panel overflow-hidden rounded-xl border border-gray-100/90 bg-white shadow-sm">
      <div class="merchant-data-panel-toolbar border-b border-gray-100 bg-white">
        <div class="min-w-0 max-sm:overflow-x-auto max-sm:pb-0.5 filter-row-scroll">
          <div class="flex w-full min-w-0 flex-nowrap items-center gap-4">
            <div class="min-w-0 flex-1 basis-0">
              <el-input
                v-model="searchQuery"
                placeholder="Search by name or category..."
                clearable
                class="w-full"
                @input="handleSearch"
                @keyup.enter="fetchProducts"
              >
                <template #prefix>
                  <search-icon class="h-5 w-5 text-gray-400" />
                </template>
              </el-input>
            </div>

            <div class="merchant-products-status-select w-[11.5rem] shrink-0">
              <el-select
                v-model="statusFilter"
                placeholder="Filter by Status"
                class="w-full"
                @change="handleSearch"
              >
                <el-option label="All Status" value="all" />
                <el-option label="Active" value="active" />
                <el-option label="Draft" value="draft" />
                <el-option label="Archived" value="archived" />
              </el-select>
            </div>

            <el-button
              type="default"
              class="shrink-0 !rounded-lg border-gray-200 bg-white text-gray-700 shadow-sm hover:border-gray-300 hover:bg-gray-50"
              :loading="loading"
              @click="refreshData"
            >
              <refresh-cw-icon v-if="!loading" class="mr-1.5 h-[18px] w-[18px]" />
              Refresh
            </el-button>

            <el-button type="primary" class="shrink-0 !rounded-lg px-4 shadow-sm" @click="openCreateDialog">
              <plus-icon class="mr-1.5 h-[18px] w-[18px]" />
              Add Product
            </el-button>
          </div>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="products"
        row-key="id"
        size="large"
        class="merchant-products-table"
        style="width: 100%"
        highlight-current-row
      >
        <el-table-column label="Product" min-width="260">
          <template #default="{ row }">
            <div class="flex items-center gap-3.5 py-1">
              <el-image
                :key="row.id"
                :src="row.image"
                lazy
                class="h-[52px] w-[52px] shrink-0 rounded-lg border border-gray-200/90 bg-gray-50 object-cover shadow-sm"
                fit="cover"
              >
                <template #error>
                  <div class="flex h-full w-full items-center justify-center bg-gray-50 text-gray-400">
                    <image-icon class="h-7 w-7" />
                  </div>
                </template>
              </el-image>
              <div class="min-w-0">
                <div class="text-[15px] font-bold leading-snug tracking-tight text-gray-900">{{ row.title }}</div>
                <div class="mt-0.5 text-sm text-gray-500">{{ row.category }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="price" label="Price" width="128" sortable align="left">
          <template #default="{ row }">
            <span class="text-[15px] font-bold tabular-nums text-gray-900">${{ row.price.toFixed(2) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="stock" label="Stock" width="104" sortable align="left">
          <template #default="{ row }">
            <span
              class="text-[15px] font-bold tabular-nums"
              :class="stockTextClass(row.stock)"
            >
              {{ row.stock }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="sales" label="Sales" width="100" sortable align="left">
          <template #default="{ row }">
            <span class="text-[15px] tabular-nums text-gray-500">{{ row.sales }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="Status" width="128">
          <template #default="{ row }">
            <span
              class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide"
              :class="statusPillClass(row.status)"
            >
              {{ row.status.toUpperCase() }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="Actions" width="140" align="right">
          <template #default="{ row }">
            <div class="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                class="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
                @click="openEditDialog(row)"
              >
                Edit
              </button>
              <button
                type="button"
                class="text-sm font-medium text-red-600 transition-colors hover:text-red-700"
                @click="handleDelete(row)"
              >
                Delete
              </button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Dialog: product create / edit -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditMode ? 'Edit Product' : 'Add New Product'"
      class="merchant-product-dialog"
      width="720px"
      destroy-on-close
      align-center
      append-to-body
      @opened="onDialogOpened"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-position="top"
        require-asterisk-position="right"
        class="product-form space-y-1"
      >
        <p class="form-section-label">Basic info</p>
        <el-form-item label="Product title" prop="title">
          <el-input
            v-model="formData.title"
            maxlength="120"
            show-word-limit
            placeholder="e.g. Nexus VR Pro"
            clearable
          />
        </el-form-item>

        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
          <el-form-item label="Price (USD)" prop="price">
            <el-input-number
              v-model="formData.price"
              :min="0"
              :max="999999.99"
              :precision="2"
              :step="0.01"
              controls-position="right"
              class="w-full product-form-input-number"
            />
          </el-form-item>
          <el-form-item label="Stock quantity" prop="stock">
            <el-input-number
              v-model="formData.stock"
              :min="0"
              :max="999999"
              :precision="0"
              :step="1"
              controls-position="right"
              class="w-full product-form-input-number"
            />
          </el-form-item>
        </div>

        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
          <el-form-item label="Category" prop="category">
            <el-select
              v-model="formData.category"
              placeholder="Select category"
              class="w-full"
              filterable
            >
              <el-option
                v-for="cat in merchantCategoryOptions"
                :key="cat"
                :label="cat"
                :value="cat"
              />
            </el-select>
            <p class="mt-1.5 text-xs text-gray-500">
              Same taxonomy as the storefront product detail page (filters, specs, and variants use this value in mock mode).
            </p>
          </el-form-item>
          <el-form-item label="Status" prop="status">
            <el-select v-model="formData.status" placeholder="Select status" class="w-full">
              <el-option label="Active — visible to customers" value="active" />
              <el-option label="Draft — not listed" value="draft" />
              <el-option label="Archived — hidden, keep history" value="archived" />
            </el-select>
          </el-form-item>
        </div>

        <el-divider class="!my-6" />

        <el-form-item label="Cover image" prop="image" class="cover-image-form-item !mb-0">
          <div class="cover-image-row">
            <div class="cover-image-source">
              <input
                ref="coverFileInputRef"
                type="file"
                class="cover-file-input"
                accept="image/jpeg,image/png,image/webp,image/gif"
                @change="onCoverFileInputChange"
              />

              <div
                class="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-5 transition-colors select-none sm:py-6"
                :class="
                  coverDragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 bg-gray-50/80 hover:border-gray-300'
                "
                role="button"
                tabindex="0"
                @click="triggerCoverFilePick"
                @keydown.enter.prevent="triggerCoverFilePick"
                @keydown.space.prevent="triggerCoverFilePick"
                @dragenter.prevent="onCoverDragEnter"
                @dragover.prevent="onCoverDragOver"
                @dragleave.prevent="onCoverDragLeave"
                @drop.prevent="onCoverDrop"
              >
                <upload-icon class="h-8 w-8 shrink-0 text-gray-400 sm:h-9 sm:w-9" />
                <p class="text-center text-xs text-gray-600 sm:text-sm">
                  Drop an image here, or click to choose
                </p>
                <p class="text-center text-[11px] text-gray-400 sm:text-xs">
                  JPG, PNG, WebP, GIF · max {{ COVER_IMAGE_MAX_LABEL }}
                </p>
              </div>

              <div class="mt-3">
                <p class="mb-1.5 text-xs font-medium text-gray-500">Or paste an image URL</p>
                <template v-if="isDataImageCover">
                  <div
                    class="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                  >
                    <span class="min-w-0 flex-1 truncate">
                      Local: {{ lastLocalCoverName || 'image' }}
                    </span>
                    <el-button link type="primary" size="small" @click.stop="triggerCoverFilePick">
                      Replace
                    </el-button>
                    <el-button link size="small" @click.stop="switchCoverToUrlMode">
                      Use URL
                    </el-button>
                  </div>
                </template>
                <el-input
                  v-else
                  v-model="formData.image"
                  type="textarea"
                  :rows="2"
                  placeholder="https://…"
                  clearable
                />
                <p class="mt-1.5 text-xs text-gray-500">
                  Local files are preview-only in session; prefer HTTPS CDN URLs in production.
                </p>
              </div>
            </div>

            <div class="cover-image-preview-aside">
              <div class="cover-preview-card">
                <div class="cover-preview-card__head">
                  <span class="text-xs font-medium text-gray-600">Preview</span>
                  <el-tag v-if="effectiveCoverSrc && imagePreviewError" type="warning" size="small" effect="plain">
                    Failed
                  </el-tag>
                </div>
                <div class="cover-preview-card__body">
                  <template v-if="effectiveCoverSrc">
                    <el-image
                      :key="coverPreviewKey"
                      :src="effectiveCoverSrc"
                      fit="contain"
                      referrerpolicy="no-referrer"
                      class="cover-preview-el-image"
                      @error="imagePreviewError = true"
                      @load="imagePreviewError = false"
                    >
                      <template #error>
                        <div class="flex flex-col items-center justify-center gap-2 px-2 py-6 text-center text-gray-400">
                          <image-icon class="h-8 w-8 shrink-0" />
                          <span class="text-xs leading-snug">Could not load. Check URL or file.</span>
                        </div>
                      </template>
                    </el-image>
                  </template>
                  <div
                    v-else
                    class="flex h-full flex-col items-center justify-center gap-2 px-3 py-6 text-center text-gray-400"
                  >
                    <image-icon class="h-8 w-8 opacity-60" />
                    <span class="text-xs leading-snug">Preview appears here after you add an image.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-4">
          <el-button @click="dialogVisible = false">Cancel</el-button>
          <el-button type="primary" :loading="submitting" @click="submitForm">
            {{ isEditMode ? 'Save changes' : 'Create product' }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { 
  Plus as PlusIcon, 
  Search as SearchIcon, 
  RefreshCw as RefreshCwIcon,
  Image as ImageIcon,
  Upload as UploadIcon
} from 'lucide-vue-next'
import { debounce } from 'lodash-es'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { 
  getMerchantProducts, 
  createMerchantProduct, 
  updateMerchantProduct, 
  deleteMerchantProduct,
  type MerchantProduct 
} from '@/api/modules/merchantProducts'
import { PRODUCT_STORE_CATEGORIES } from '@/api/modules/product'

/** Legacy values that may still exist in localStorage mock data */
const LEGACY_MERCHANT_CATEGORIES = ['Home'] as const

const merchantCategoryOptions = [
  ...PRODUCT_STORE_CATEGORIES,
  ...LEGACY_MERCHANT_CATEGORIES.filter((c) => !PRODUCT_STORE_CATEGORIES.includes(c))
]

const COVER_IMAGE_MAX_BYTES = Math.floor(2.5 * 1024 * 1024)
const COVER_IMAGE_MAX_LABEL = '2.5 MB'
const COVER_ACCEPT_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function isValidImageFieldValue(raw: string): boolean {
  const v = (raw || '').trim()
  if (!v) return false
  if (/^data:image\/(jpeg|jpg|png|gif|webp);base64,/i.test(v)) return true
  try {
    const u = new URL(v)
    return /^https?:$/i.test(u.protocol)
  } catch {
    return false
  }
}

// State
const loading = ref(false)
const submitting = ref(false)
const products = ref<MerchantProduct[]>([])
const searchQuery = ref('')
const statusFilter = ref('all')
const dialogVisible = ref(false)
const isEditMode = ref(false)
const formRef = ref<FormInstance>()

// Form Data
const formData = reactive<Omit<MerchantProduct, 'id' | 'sales'>>({
  title: '',
  price: 0,
  stock: 0,
  category: '',
  status: 'draft',
  image: ''
})

const editingId = ref<number | null>(null)
const imagePreviewError = ref(false)
const coverFileInputRef = ref<HTMLInputElement | null>(null)
const coverDragOver = ref(false)
const lastLocalCoverName = ref('')
const coverPreviewKey = ref(0)

const isDataImageCover = computed(() =>
  /^data:image\//i.test(formData.image?.trim() ?? '')
)

const effectiveCoverSrc = computed(() => {
  const s = formData.image?.trim() ?? ''
  if (!s) return ''
  if (/^data:image\//i.test(s)) return s
  try {
    const u = new URL(s)
    if (!/^https?:$/i.test(u.protocol)) return ''
    return s
  } catch {
    return ''
  }
})

watch(
  () => formData.image,
  () => {
    imagePreviewError.value = false
    coverPreviewKey.value += 1
  }
)

// Validation Rules
const formRules = reactive<FormRules>({
  title: [
    { required: true, message: 'Please enter product title', trigger: 'blur' },
    { min: 3, max: 120, message: 'Use 3–120 characters', trigger: 'blur' }
  ],
  price: [
    { required: true, message: 'Price is required', trigger: 'blur' },
    {
      type: 'number',
      min: 0,
      max: 999999.99,
      message: 'Price must be between 0 and 999,999.99',
      trigger: 'blur'
    }
  ],
  stock: [
    { required: true, message: 'Stock is required', trigger: 'blur' },
    {
      type: 'number',
      min: 0,
      max: 999999,
      message: 'Stock must be an integer from 0 to 999,999',
      trigger: 'blur'
    }
  ],
  category: [
    { required: true, message: 'Please select a category', trigger: 'change' }
  ],
  status: [
    { required: true, message: 'Please select a status', trigger: 'change' }
  ],
  image: [
    { required: true, message: 'Add a cover image (file or URL)', trigger: 'change' },
    {
      validator: (_rule, value: string, callback) => {
        if (!isValidImageFieldValue(value || '')) {
          callback(new Error('Use an image file or a valid http(s) URL'))
          return
        }
        callback()
      },
      trigger: 'blur'
    }
  ]
})

// Methods — 首次进入可全屏 loading；搜索防抖用 silent 避免闪烁；点「Refresh」须 showLoading 才有反馈
const loadData = async (options?: { silent?: boolean; showLoading?: boolean }) => {
  const useOverlay =
    options?.showLoading === true ||
    (!options?.silent && products.value.length === 0)
  if (useOverlay) loading.value = true
  try {
    const data = await getMerchantProducts({
      q: searchQuery.value,
      status: statusFilter.value
    })
    products.value = data
  } catch (error) {
    console.error('Failed to load products:', error)
    ElMessage.error('Failed to load products')
  } finally {
    if (useOverlay) loading.value = false
  }
}

const debouncedSearch = debounce(() => {
  loadData({ silent: products.value.length > 0 })
}, 300)

const handleSearch = () => {
  debouncedSearch()
}

const refreshData = () => {
  loadData({ showLoading: true })
}

const fetchProducts = () => {
  loadData({ showLoading: true })
}

watch(statusFilter, () => {
  loadData({ silent: products.value.length > 0 })
})

function statusPillClass(status: string) {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100/80'
    case 'archived':
      return 'bg-red-50 text-red-700 ring-1 ring-red-100/80'
    case 'draft':
      return 'bg-gray-100 text-gray-600 ring-1 ring-gray-200/90'
    default:
      return 'bg-gray-100 text-gray-600 ring-1 ring-gray-200/90'
  }
}

function stockTextClass(stock: number) {
  if (stock === 0) return 'text-red-600'
  if (stock > 0 && stock < 10) return 'text-amber-600'
  return 'text-emerald-600'
}

function applyCoverFile(file: File) {
  if (!COVER_ACCEPT_MIME.has(file.type)) {
    ElMessage.error('Please choose a JPG, PNG, WebP, or GIF image')
    return
  }
  if (file.size > COVER_IMAGE_MAX_BYTES) {
    ElMessage.error(`Image must be ${COVER_IMAGE_MAX_LABEL} or smaller`)
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const result = reader.result
    if (typeof result === 'string') {
      formData.image = result
      lastLocalCoverName.value = file.name
      formRef.value?.validateField('image').catch(() => {})
    }
  }
  reader.onerror = () => {
    ElMessage.error('Could not read this file')
  }
  reader.readAsDataURL(file)
}

function triggerCoverFilePick() {
  coverFileInputRef.value?.click()
}

function onCoverFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) applyCoverFile(file)
}

function onCoverDragEnter(e: DragEvent) {
  e.preventDefault()
  coverDragOver.value = true
}

function onCoverDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onCoverDragLeave(e: DragEvent) {
  const cur = e.currentTarget as HTMLElement
  const rel = e.relatedTarget as Node | null
  if (rel && cur.contains(rel)) return
  coverDragOver.value = false
}

function onCoverDrop(e: DragEvent) {
  coverDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) applyCoverFile(file)
}

function switchCoverToUrlMode() {
  formData.image = ''
  lastLocalCoverName.value = ''
}

const openCreateDialog = () => {
  isEditMode.value = false
  editingId.value = null
  imagePreviewError.value = false
  lastLocalCoverName.value = ''
  coverDragOver.value = false
  formData.title = ''
  formData.price = 0
  formData.stock = 0
  formData.category = ''
  formData.status = 'draft'
  formData.image = ''
  dialogVisible.value = true
}

const openEditDialog = (row: MerchantProduct) => {
  isEditMode.value = true
  editingId.value = row.id
  imagePreviewError.value = false
  lastLocalCoverName.value = ''
  coverDragOver.value = false
  formData.title = row.title
  formData.price = row.price
  formData.stock = row.stock
  formData.category = row.category
  formData.status = row.status
  formData.image = row.image
  dialogVisible.value = true
}

const onDialogOpened = () => {
  imagePreviewError.value = false
  nextTick(() => formRef.value?.clearValidate())
}

function normalizeProductPayload(): Omit<MerchantProduct, 'id' | 'sales'> {
  return {
    title: formData.title.trim(),
    price: Math.round(Number(formData.price) * 100) / 100,
    stock: Math.min(999999, Math.max(0, Math.floor(Number(formData.stock)))),
    category: formData.category,
    status: formData.status,
    image: formData.image.trim()
  }
}

const submitForm = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  const payload = normalizeProductPayload()
  if (payload.status === 'active' && payload.stock === 0) {
    try {
      await ElMessageBox.confirm(
        'This product is Active but stock is 0. Customers may see it as out of stock. Continue?',
        'Stock warning',
        {
          confirmButtonText: 'Save anyway',
          cancelButtonText: 'Go back',
          type: 'warning'
        }
      )
    } catch {
      return
    }
  }

  submitting.value = true
  try {
    if (isEditMode.value && editingId.value) {
      await updateMerchantProduct(editingId.value, payload)
      ElMessage.success('Product updated successfully')
    } else {
      await createMerchantProduct(payload)
      ElMessage.success('Product created successfully')
    }
    dialogVisible.value = false
    loadData({ silent: true })
  } catch (error) {
    console.error(error)
    ElMessage.error(isEditMode.value ? 'Failed to update product' : 'Failed to create product')
  } finally {
    submitting.value = false
  }
}

const handleDelete = (row: MerchantProduct) => {
  ElMessageBox.confirm(
    `Are you sure you want to delete "${row.title}"? This action cannot be undone.`,
    'Warning',
    {
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      type: 'warning',
    }
  ).then(async () => {
    try {
      await deleteMerchantProduct(row.id)
      ElMessage.success('Product deleted')
      loadData({ silent: true })
    } catch (error) {
      ElMessage.error('Failed to delete product')
    }
  })
}

// Lifecycle
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.merchant-data-panel :deep(.el-card__body) {
  padding: 0;
}

.merchant-data-panel-toolbar {
  padding: 12px 16px;
}

@media (min-width: 640px) {
  .merchant-data-panel-toolbar {
    padding: 14px 20px;
  }
}

.merchant-products-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.merchant-products-table :deep(.el-table) {
  --el-table-border-color: transparent;
  --el-table-bg-color: #fff;
  --el-table-tr-bg-color: #fff;
  --el-table-header-bg-color: #fff;
  --el-table-row-hover-bg-color: rgb(249 250 251);
}

.merchant-products-table :deep(thead th.el-table__cell) {
  padding-top: 14px;
  padding-bottom: 14px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgb(107 114 128);
  border-bottom: 1px solid rgb(243 244 246) !important;
  border-right: none !important;
  background-color: #fff !important;
}

.merchant-products-table :deep(tbody td.el-table__cell) {
  padding-top: 18px;
  padding-bottom: 18px;
  border-right: none !important;
  border-bottom: 1px solid rgb(243 244 246) !important;
}

.merchant-products-table :deep(.el-table__body tr:last-child td.el-table__cell) {
  border-bottom: none !important;
}

.merchant-products-table :deep(.el-table__body-wrapper .el-scrollbar__wrap) {
  border-radius: 0 0 0.75rem 0.75rem;
}

.merchant-products-status-select :deep(.el-select) {
  width: 100%;
}

.merchant-products-status-select :deep(.el-select__wrapper) {
  width: 100%;
}

.filter-row-scroll {
  scrollbar-width: thin;
}

.filter-row-scroll::-webkit-scrollbar {
  height: 6px;
}

.filter-row-scroll::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background-color: rgb(0 0 0 / 0.2);
}

.form-section-label {
  margin-bottom: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgb(107 114 128);
}

.cover-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>

<!-- Dialog is teleported: unscoped hooks for wrapper class -->
<style>
.merchant-product-dialog.el-dialog {
  max-width: min(94vw, 720px);
  border-radius: 14px;
  margin-top: 1rem !important;
  margin-bottom: 1rem !important;
}

.merchant-product-dialog .el-dialog__header {
  padding-bottom: 4px;
  margin-right: 0;
}

.merchant-product-dialog .el-dialog__title {
  font-size: 1.125rem;
  font-weight: 600;
}

.merchant-product-dialog .el-dialog__body {
  padding-top: 8px;
  max-height: calc(100vh - 11rem);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

.merchant-product-dialog .product-form-input-number {
  width: 100%;
}

.merchant-product-dialog .product-form-input-number.el-input-number {
  width: 100%;
}

/* Cover: source (left) + fixed-height preview (right) */
.merchant-product-dialog .cover-image-row {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

@media (min-width: 640px) {
  .merchant-product-dialog .cover-image-row {
    flex-direction: row;
    align-items: flex-start;
    gap: 1rem;
  }
}

.merchant-product-dialog .cover-image-source {
  flex: 1;
  min-width: 0;
}

.merchant-product-dialog .cover-image-preview-aside {
  width: 100%;
  display: flex;
  justify-content: center;
}

@media (min-width: 640px) {
  .merchant-product-dialog .cover-image-preview-aside {
    width: 228px;
    flex-shrink: 0;
    justify-content: stretch;
  }
}

.merchant-product-dialog .cover-preview-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 320px;
  height: 220px;
  border-radius: 12px;
  border: 1px solid rgb(229 231 235);
  background: rgb(249 250 251);
  overflow: hidden;
}

@media (min-width: 640px) {
  .merchant-product-dialog .cover-preview-card {
    max-width: none;
    height: 260px;
  }
}

.merchant-product-dialog .cover-preview-card__head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgb(243 244 246);
  background: rgb(255 255 255 / 0.85);
  padding: 0.5rem 0.75rem;
}

.merchant-product-dialog .cover-preview-card__body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 0.5rem;
}

.merchant-product-dialog .cover-preview-el-image {
  width: 100%;
  max-width: 100%;
  max-height: 100%;
}

.merchant-product-dialog .cover-preview-el-image .el-image__wrapper,
.merchant-product-dialog .cover-preview-el-image .el-image__inner {
  max-width: 100% !important;
  max-height: 100% !important;
}

.merchant-product-dialog .cover-preview-el-image .el-image__inner {
  width: auto !important;
  height: auto !important;
  object-fit: contain;
}
</style>

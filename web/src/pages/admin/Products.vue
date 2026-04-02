<template>
  <div class="p-6">
    <div class="admin-toolbar-shell">
      <div class="admin-toolbar-inner">
        <div class="admin-toolbar-search">
          <el-input
            v-model="searchQuery"
            placeholder="Search by name or merchant..."
            clearable
            class="!w-full"
            @input="debouncedLoadData"
            @clear="loadData"
            @keyup.enter="loadData"
          >
            <template #prefix>
              <el-icon><SearchIcon /></el-icon>
            </template>
          </el-input>
        </div>

        <div class="admin-toolbar-select">
          <el-select v-model="statusFilter" placeholder="All Status" class="!w-full" @change="loadData">
            <el-option label="All Status" value="all" />
            <el-option label="Active" value="active" />
            <el-option label="Draft" value="draft" />
            <el-option label="Archived" value="archived" />
            <el-option label="Banned" value="banned" />
          </el-select>
        </div>

        <el-button class="admin-toolbar-refresh-btn" :loading="loading" @click="refreshList">
          <RefreshCw v-if="!loading" class="mr-1.5 inline h-4 w-4" />
          Refresh
        </el-button>
      </div>
    </div>

    <div
      v-loading="loading"
      class="admin-grid-shell [--el-loading-spinner-size:42px] [--el-mask-color:rgb(24_24_27/0.72)]"
      element-loading-background="transparent"
    >
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div
          v-for="product in products"
          :key="product.id"
          class="admin-list-item-card group flex cursor-pointer flex-col overflow-hidden hover:border-violet-500/35"
          @click="openDrawer(product)"
        >
        <div class="relative aspect-video bg-black/40">
          <img
            :key="`${product.id}-${mediaReloadKey}`"
            :src="product.image"
            class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
            referrerpolicy="no-referrer"
            @error="onImgError"
          />
          <div class="absolute top-2 right-2">
             <span 
              class="px-2 py-1 rounded-md text-xs font-medium shadow-sm backdrop-blur-md"
              :class="{
                'bg-emerald-500/20 text-emerald-400': product.status === 'active',
                'bg-rose-500/20 text-rose-400': product.status === 'banned',
                'bg-zinc-500/20 text-zinc-400': product.status === 'draft' || product.status === 'archived'
              }"
            >
              {{ product.status.toUpperCase() }}
            </span>
          </div>
        </div>
        <div class="p-4 flex-1 flex flex-col">
          <h3 class="font-semibold text-zinc-200 truncate">{{ product.title }}</h3>
          <div class="text-sm text-zinc-500 mb-2">{{ product.merchant }}</div>
          <div class="flex items-center justify-between mt-auto">
            <span class="text-purple-400 font-bold">${{ product.price }}</span>
            <el-button 
              v-if="product.status !== 'banned'" 
              size="small" 
              type="danger" 
              plain
              @click.stop="handleBan(product)"
            >
              Ban Item
            </el-button>
          </div>
        </div>
        </div>
      </div>
    </div>

    <!-- Product Details Drawer -->
    <DetailDrawer v-model="drawerVisible" title="Product Inspection" size="500px">
      <div v-if="selectedProduct" class="space-y-6">
        <div class="aspect-video overflow-hidden rounded-xl border border-white/10 bg-black/20">
          <img
            :key="`${selectedProduct.id}-${mediaReloadKey}`"
            :src="selectedProduct.image"
            class="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            referrerpolicy="no-referrer"
          />
        </div>

        <div>
          <h2 class="text-2xl font-bold text-white mb-2">{{ selectedProduct.title }}</h2>
          <div class="flex items-center gap-2 mb-4">
            <span class="text-zinc-400 text-sm">Sold by:</span>
            <span class="text-purple-400 font-medium">{{ selectedProduct.merchant }}</span>
          </div>
          <div class="text-3xl font-bold text-white mb-4">${{ selectedProduct.price }}</div>
          <p class="text-zinc-400 leading-relaxed">
            This is a placeholder description for the admin view. In a real app, we would fetch the full product description here to check for prohibited content or policy violations.
          </p>
        </div>

        <el-descriptions :column="1" border class="dark-desc">
          <el-descriptions-item label="Product ID">{{ selectedProduct.id }}</el-descriptions-item>
          <el-descriptions-item label="Status">
             <el-tag :type="selectedProduct.status === 'active' ? 'success' : selectedProduct.status === 'banned' ? 'danger' : 'info'" size="small">
              {{ selectedProduct.status.toUpperCase() }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="Category">Electronics</el-descriptions-item>
          <el-descriptions-item label="Stock">45 units</el-descriptions-item>
          <el-descriptions-item label="Reports">
            <span class="text-rose-400 font-bold" v-if="selectedProduct.id === 99">3 User Reports</span>
            <span class="text-emerald-400" v-else>Clean</span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="pt-4 border-t border-white/10" v-if="selectedProduct.status !== 'banned'">
          <h4 class="font-medium text-white mb-3">Moderation Actions</h4>
          <el-button type="danger" class="w-full" @click="handleBan(selectedProduct); drawerVisible = false">
            Ban Product (Violation of Terms)
          </el-button>
        </div>
         <div class="pt-4 border-t border-white/10" v-else>
          <h4 class="font-medium text-white mb-3">Moderation Actions</h4>
          <el-button type="success" plain class="w-full" disabled>
            Unban Product (Requires Appeal)
          </el-button>
        </div>
      </div>
    </DetailDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { RefreshCw, Search as SearchIcon } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAdminProducts, banProduct, type AdminProduct } from '@/api/modules/adminProducts'
import DetailDrawer from '@/components/ui/admin/DetailDrawer.vue'
import { debounce } from 'lodash-es'

const loading = ref(false)
const products = ref<AdminProduct[]>([])
const searchQuery = ref('')
const statusFilter = ref('all')
const drawerVisible = ref(false)
const selectedProduct = ref<AdminProduct | null>(null)
/** 刷新后递增，强制 <img>  remount 以重试加载外链图 */
const mediaReloadKey = ref(0)

const loadData = async (options?: { bumpMediaKey?: boolean; minSpinnerMs?: number }) => {
  loading.value = true
  const started = Date.now()
  try {
    const data = await getAdminProducts({
      q: searchQuery.value,
      status: statusFilter.value
    })
    products.value = data
    if (options?.bumpMediaKey) mediaReloadKey.value += 1
  } catch (error) {
    ElMessage.error('Failed to load products')
  } finally {
    const minMs = options?.minSpinnerMs ?? 0
    const elapsed = Date.now() - started
    if (minMs > 0 && elapsed < minMs) {
      await new Promise((r) => setTimeout(r, minMs - elapsed))
    }
    loading.value = false
  }
}

function refreshList() {
  // Mock 接口可能瞬间返回，保证至少短暂显示 loading，避免「点了没反应」
  loadData({ bumpMediaKey: true, minSpinnerMs: 280 })
}

function onImgError(e: Event) {
  const el = e.target as HTMLImageElement
  el.style.opacity = '0.35'
}

// Debounce search（输入时不反复 bump 媒体 key，避免列表闪动）
const debouncedLoadData = debounce(() => loadData(), 300)
watch(searchQuery, () => {
  debouncedLoadData()
})

const handleBan = (product: AdminProduct) => {
  ElMessageBox.prompt('Reason for banning:', 'Ban Product', {
    confirmButtonText: 'Ban',
    cancelButtonText: 'Cancel',
    inputPattern: /.+/,
    inputErrorMessage: 'Reason is required'
  }).then(async ({ value }) => {
    try {
      await banProduct(product.id)
      product.status = 'banned'
      ElMessage.success(`Product banned: ${value}`)
    } catch (error) {
      ElMessage.error('Failed to ban product')
    }
  })
}

const openDrawer = (product: AdminProduct) => {
  selectedProduct.value = product
  drawerVisible.value = true
}

onMounted(loadData)
</script>

<style>
/* Reusing dark theme styles */
</style>

<template>
  <div class="p-6">
    <div class="admin-toolbar-shell">
      <div class="admin-toolbar-inner">
        <div class="admin-toolbar-search">
          <el-input
            v-model="searchQuery"
            placeholder="Search reviews, users, or products..."
            clearable
            class="!w-full"
            @input="debouncedLoad"
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
            <el-option label="Visible" value="visible" />
            <el-option label="Hidden" value="hidden" />
          </el-select>
        </div>

        <el-button class="admin-toolbar-refresh-btn" @click="loadData">
          <RefreshCw class="mr-1.5 inline h-4 w-4" />
          Refresh
        </el-button>
      </div>
    </div>

    <div class="admin-table-shell">
      <el-table v-loading="loading" :data="pagedReviews" stripe class="admin-data-table min-w-[960px]">
        <el-table-column prop="id" label="ID" width="108">
          <template #default="{ row }">
            <span class="font-mono text-zinc-400 text-xs">{{ row.id }}</span>
          </template>
        </el-table-column>

        <el-table-column label="Product" min-width="140">
          <template #default="{ row }">
            <button
              type="button"
              class="text-left text-purple-400 hover:underline font-medium text-sm"
              @click="router.push(`/product/${row.productId}`)"
            >
              {{ row.productTitle }}
            </button>
            <div class="text-[11px] text-zinc-500">#{{ row.productId }}</div>
          </template>
        </el-table-column>

        <el-table-column label="User" min-width="120">
          <template #default="{ row }">
            <div class="text-zinc-200 text-sm">{{ row.userName }}</div>
            <div v-if="row.userEmail" class="text-[11px] text-zinc-500 truncate max-w-[180px]">
              {{ row.userEmail }}
            </div>
          </template>
        </el-table-column>

        <el-table-column label="Rating" width="100" align="center">
          <template #default="{ row }">
            <span class="text-amber-400 font-semibold">{{ row.rating }}</span>
            <span class="text-zinc-500 text-xs"> /5</span>
          </template>
        </el-table-column>

        <el-table-column prop="content" label="Content" min-width="200">
          <template #default="{ row }">
            <p class="text-zinc-300 text-sm line-clamp-2 m-0">{{ row.content }}</p>
            <el-button link type="primary" class="!p-0 !h-auto mt-1" @click="openDrawer(row as AdminReview)">
              View full
            </el-button>
          </template>
        </el-table-column>

        <el-table-column prop="createdAt" label="Date" width="118">
          <template #default="{ row }">
            <span class="text-zinc-400 text-xs">{{ formatDate(row.createdAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="Status" width="108">
          <template #default="{ row }">
            <span
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset"
              :class="
                row.status === 'visible'
                  ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25'
                  : 'bg-zinc-500/20 text-zinc-400 ring-zinc-500/30'
              "
            >
              {{ row.status }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="Actions" min-width="200" width="220" fixed="right" align="right">
          <template #default="{ row }">
            <div class="flex flex-wrap items-center justify-end gap-1.5">
              <button
                v-if="row.status === 'visible'"
                type="button"
                class="h-9 shrink-0 rounded-full border border-amber-500/40 bg-amber-950/50 px-3 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-900/40"
                @click="setStatus(row as AdminReview, 'hidden')"
              >
                Hide
              </button>
              <button
                v-else
                type="button"
                class="h-9 shrink-0 rounded-full border border-emerald-500/40 bg-emerald-950/55 px-3 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-900/45"
                @click="setStatus(row as AdminReview, 'visible')"
              >
                Show
              </button>
              <button
                type="button"
                class="h-9 shrink-0 rounded-full border border-rose-500/35 bg-rose-950/50 px-3 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-900/40"
                @click="requestDelete(row as AdminReview)"
              >
                Delete
              </button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div
        v-if="reviews.length > pageSize"
        class="flex justify-end border-t border-zinc-700/50 bg-zinc-900/50 px-4 py-3"
      >
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="reviews.length"
          layout="total, sizes, prev, pager, next"
          background
        />
      </div>
    </div>

    <DetailDrawer v-model="drawerVisible" title="Review detail" size="480px">
      <div v-if="selected" class="space-y-4 text-zinc-300">
        <div class="flex items-center justify-between">
          <span class="text-xs text-zinc-500">ID</span>
          <span class="font-mono text-sm text-zinc-200">{{ selected.id }}</span>
        </div>
        <div>
          <span class="text-xs text-zinc-500 block mb-1">Product</span>
          <button
            type="button"
            class="text-purple-400 hover:underline font-medium"
            @click="router.push(`/product/${selected.productId}`)"
          >
            {{ selected.productTitle }} (#{{ selected.productId }})
          </button>
        </div>
        <div>
          <span class="text-xs text-zinc-500 block mb-1">User</span>
          <div class="text-white font-medium">{{ selected.userName }}</div>
          <div v-if="selected.userEmail" class="text-sm text-zinc-400">{{ selected.userEmail }}</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-zinc-500">Rating</span>
          <span class="text-amber-400 font-bold text-lg">{{ selected.rating }} / 5</span>
          <el-tag v-if="selected.verifiedPurchase" size="small" type="success" effect="plain">
            Verified purchase
          </el-tag>
        </div>
        <div>
          <span class="text-xs text-zinc-500 block mb-1">Content</span>
          <p class="text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">{{ selected.content }}</p>
        </div>
        <div v-if="selected.images?.length" class="space-y-2">
          <span class="text-xs text-zinc-500">Images</span>
          <div class="flex flex-wrap gap-2">
            <a
              v-for="(img, i) in selected.images"
              :key="i"
              :href="img"
              target="_blank"
              rel="noopener noreferrer"
              class="block w-24 h-24 rounded-lg overflow-hidden border border-white/10"
            >
              <img :src="img" class="w-full h-full object-cover" alt="" />
            </a>
          </div>
        </div>
        <div class="text-xs text-zinc-500">{{ formatDate(selected.createdAt) }}</div>
      </div>
    </DetailDrawer>

    <ConfirmDialog
      v-model="deleteDialogVisible"
      title="Delete review"
      description="This permanently removes the review from the platform."
      confirm-text="Delete"
      cancel-text="Cancel"
      :danger="true"
      @cancel="closeDelete"
      @confirm="confirmDelete"
    >
      <template #icon>
        <StarIcon class="w-4 h-4" />
      </template>
      <p v-if="deleteTarget">
        Delete review <span class="font-semibold">{{ deleteTarget.id }}</span> by
        {{ deleteTarget.userName }}?
      </p>
    </ConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { RefreshCw, Search as SearchIcon, Star as StarIcon } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import {
  getAdminReviews,
  updateAdminReviewStatus,
  deleteAdminReview,
  type AdminReview,
  type AdminReviewStatus
} from '@/api/modules/adminReviews'
import DetailDrawer from '@/components/ui/admin/DetailDrawer.vue'
import ConfirmDialog from '@/components/ui/dialog/ConfirmDialog.vue'
import { debounce } from 'lodash-es'

const router = useRouter()
const loading = ref(false)
const reviews = ref<AdminReview[]>([])
const searchQuery = ref('')
const statusFilter = ref('all')
const drawerVisible = ref(false)
const selected = ref<AdminReview | null>(null)
const deleteDialogVisible = ref(false)
const deleteTarget = ref<AdminReview | null>(null)

const currentPage = ref(1)
const pageSize = ref(10)

const pagedReviews = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return reviews.value.slice(start, start + pageSize.value)
})

watch([() => reviews.value.length, pageSize], () => {
  const maxPage = Math.max(1, Math.ceil(reviews.value.length / pageSize.value) || 1)
  if (currentPage.value > maxPage) currentPage.value = maxPage
})

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const data = await getAdminReviews({
      q: searchQuery.value,
      status: statusFilter.value
    })
    reviews.value = data
    currentPage.value = 1
  } catch {
    ElMessage.error('Failed to load reviews')
  } finally {
    loading.value = false
  }
}

const debouncedLoad = debounce(loadData, 300)
watch(searchQuery, () => debouncedLoad())

async function setStatus(row: AdminReview, status: AdminReviewStatus) {
  try {
    await updateAdminReviewStatus(row.id, status)
    row.status = status
    ElMessage.success(status === 'hidden' ? 'Review hidden' : 'Review visible')
  } catch {
    ElMessage.error('Update failed')
  }
}

function openDrawer(row: AdminReview) {
  selected.value = row
  drawerVisible.value = true
}

function requestDelete(row: AdminReview) {
  deleteTarget.value = row
  deleteDialogVisible.value = true
}

function closeDelete() {
  deleteDialogVisible.value = false
  deleteTarget.value = null
}

async function confirmDelete() {
  const t = deleteTarget.value
  if (!t) return
  try {
    await deleteAdminReview(t.id)
    reviews.value = reviews.value.filter((r) => r.id !== t.id)
    ElMessage.success('Review deleted')
    if (selected.value?.id === t.id) drawerVisible.value = false
  } catch {
    ElMessage.error('Delete failed')
  } finally {
    closeDelete()
  }
}

onMounted(loadData)
</script>

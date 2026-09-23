<template>
  <div class="p-6">
    <DataTablePanel :error="errorRef" @retry="reloadNow">
      <template #toolbar>
        <div class="admin-toolbar-search">
          <!-- 搜索只走 watch(searchQuery) → debounce 这一条路。原先还挂着
               @input（与 watch 重复）和 @clear（立即发一次，watch 随后又补发一次
               —— 清空搜索实打实发两个请求）。回车改走 reloadNow：它先取消挂起的
               debounce，所以「刚打完字就回车」也只发一次。 -->
          <el-input
            v-model="searchQuery"
            placeholder="Search reviews, users, or products..."
            clearable
            class="!w-full"
            @keyup.enter="reloadNow"
          >
            <template #prefix>
              <el-icon><SearchIcon /></el-icon>
            </template>
          </el-input>
        </div>

        <div class="admin-toolbar-select">
          <el-select
            v-model="statusFilter"
            data-testid="list-status-filter"
            placeholder="All Status"
            class="!w-full"
            @change="reloadNow"
          >
            <el-option label="All Status" value="all" />
            <el-option label="Visible" value="visible" />
            <el-option label="Hidden" value="hidden" />
          </el-select>
        </div>

        <el-button class="admin-toolbar-refresh-btn" @click="reloadNow">
          <RefreshCw class="mr-1.5 inline h-4 w-4" />
          Refresh
        </el-button>
      </template>
      <el-table
        v-loading="loading"
        :data="pagedReviews"
        stripe
        class="admin-data-table min-w-[960px]"
      >
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
            <el-button
              link
              type="primary"
              class="!p-0 !h-auto mt-1"
              @click="openDrawer(row as AdminReview)"
            >
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

        <!-- EP 内建空态是英文 "No Data"，与全站的 图标+标题+说明 不一致。
             用 class 去掉自带的虚线边框：表格外壳本身已有边框，套两层会变成盒中盒。 -->
        <template #empty>
          <EmptyState
            :icon="StarIcon"
            title="No reviews found"
            description="Try a different search or filter."
            class="border-0 py-10"
          />
        </template>
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
    </DataTablePanel>

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
          <div v-if="selected.userEmail" class="text-sm text-zinc-400">
            {{ selected.userEmail }}
          </div>
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
          <p class="text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">
            {{ selected.content }}
          </p>
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
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { RefreshCw, Search as SearchIcon, Star as StarIcon } from 'lucide-vue-next'
import {
  getAdminReviews,
  updateAdminReviewStatus,
  deleteAdminReview,
  type AdminReview,
  type AdminReviewStatus,
} from '@/api/modules/adminReviews'
import DetailDrawer from '@/components/ui/admin/DetailDrawer.vue'
import ConfirmDialog from '@/components/ui/dialog/ConfirmDialog.vue'
import DataTablePanel from '@/components/ui/admin/DataTablePanel.vue'
import EmptyState from '@/components/ui/state/EmptyState.vue'
import { useListQuery } from '@/composables/useListQuery'
import { useToast } from '@/composables/useToast'

const { toast } = useToast()
const router = useRouter()

const currentPage = ref(1)
const pageSize = ref(10)

// 取数失败由 ErrorState 承担持久态（原先只弹瞬时 toast，表格照常渲染成空态 —— 用户看到的
// 是「没有评价」而不是「加载失败」，且无重试入口）；删除等操作类 catch 仍用 toast。
const {
  items: reviews,
  searchQuery,
  filter: statusFilter,
  isLoading: loading,
  error: errorRef,
  reloadNow,
} = useListQuery<AdminReview>({
  fallbackMessage: 'Failed to load reviews',
  task: async ({ q, filter, commit }) => {
    commit(await getAdminReviews({ q, status: filter }))
    // 新结果回来要回到第一页。写在 commit 之后（即 run 回调内部），与迁移前
    // 「if (result.ok)」的语义一致：失败时不重置页码。
    currentPage.value = 1
  },
})

const drawerVisible = ref(false)
const selected = ref<AdminReview | null>(null)
const deleteDialogVisible = ref(false)
const deleteTarget = ref<AdminReview | null>(null)

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

async function setStatus(row: AdminReview, status: AdminReviewStatus) {
  try {
    await updateAdminReviewStatus(row.id, status)
    row.status = status
    toast({ title: status === 'hidden' ? 'Review hidden' : 'Review visible', variant: 'success' })
  } catch {
    toast({ title: 'Update failed', variant: 'destructive' })
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
    toast({ title: 'Review deleted', variant: 'success' })
    if (selected.value?.id === t.id) drawerVisible.value = false
  } catch {
    toast({ title: 'Delete failed', variant: 'destructive' })
  } finally {
    closeDelete()
  }
}
</script>

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
            placeholder="Search by order ID, customer, or merchant..."
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
            <el-option label="Pending" value="pending" />
            <el-option label="Processing" value="processing" />
            <el-option label="Shipped" value="shipped" />
            <el-option label="Delivered" value="delivered" />
            <el-option label="Cancelled" value="cancelled" />
          </el-select>
        </div>

        <el-button class="admin-toolbar-refresh-btn" @click="reloadNow">
          <RefreshCw class="mr-1.5 inline h-4 w-4" />
          Refresh
        </el-button>
      </template>
      <el-table v-loading="loading" :data="orders" stripe class="admin-data-table min-w-[900px]">
        <el-table-column prop="id" label="Order ID" width="150">
          <template #default="{ row }">
            <span class="font-mono text-sm text-zinc-300">{{ row.id }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="user" label="Customer" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="text-zinc-200">{{ row.user }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="merchant" label="Merchant" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="text-zinc-300">{{ row.merchant }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="total" label="Total" width="112" align="right">
          <template #default="{ row }">
            <span class="font-medium tabular-nums text-zinc-100">${{ row.total }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="Status" width="128">
          <template #default="{ row }">
            <span
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset"
              :class="{
                'bg-amber-500/15 text-amber-300 ring-amber-500/25': row.status === 'pending',
                'bg-sky-500/15 text-sky-300 ring-sky-500/25': row.status === 'processing',
                'bg-violet-500/15 text-violet-300 ring-violet-500/25': row.status === 'shipped',
                'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25':
                  row.status === 'delivered',
                'bg-rose-500/15 text-rose-300 ring-rose-500/25': row.status === 'cancelled',
              }"
            >
              {{ row.status }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="date" label="Date" width="138" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="text-zinc-400 text-sm">{{ row.date }}</span>
          </template>
        </el-table-column>

        <el-table-column label="Actions" width="120" fixed="right" align="right">
          <template #default="{ row }">
            <button
              v-if="row.status !== 'cancelled' && row.status !== 'delivered'"
              type="button"
              class="h-9 rounded-full border border-rose-500/35 bg-rose-950/50 px-3 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-900/40"
              @click="requestCancel(row as AdminOrder)"
            >
              Cancel
            </button>
            <span v-else class="text-xs text-zinc-500">—</span>
          </template>
        </el-table-column>

        <!-- EP 内建空态是英文 "No Data"，与全站的 图标+标题+说明 不一致。
             用 class 去掉自带的虚线边框：表格外壳本身已有边框，套两层会变成盒中盒。 -->
        <template #empty>
          <EmptyState
            :icon="ShoppingCartIcon"
            title="No orders found"
            description="Try a different search or filter."
            class="border-0 py-10"
          />
        </template>
      </el-table>
    </DataTablePanel>

    <ConfirmDialog
      v-model="cancelDialogVisible"
      title="Force Cancel Order"
      description="This will immediately mark the order as cancelled."
      confirm-text="Yes, Cancel"
      cancel-text="No"
      :danger="true"
      @cancel="closeCancel"
      @confirm="confirmCancel"
    >
      <template #icon>
        <ShoppingCartIcon class="w-4 h-4" />
      </template>

      <p>
        Are you sure you want to force cancel
        <span class="font-semibold">{{ cancelTarget?.id }}</span
        >?
      </p>
      <div
        class="rounded-md border border-border/30 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-300"
      >
        This is an admin action and should only be used when necessary.
      </div>
    </ConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RefreshCw, Search as SearchIcon, ShoppingCart as ShoppingCartIcon } from 'lucide-vue-next'
import { getAdminOrders, adminCancelOrder, type AdminOrder } from '@/api/modules/adminOrders'
import ConfirmDialog from '@/components/ui/dialog/ConfirmDialog.vue'
import DataTablePanel from '@/components/ui/admin/DataTablePanel.vue'
import EmptyState from '@/components/ui/state/EmptyState.vue'
import { useListQuery } from '@/composables/useListQuery'
import { useToast } from '@/composables/useToast'

const { toast } = useToast()

// 取数失败由 ErrorState 承担持久态（原先只弹瞬时 toast，表格照常渲染成空态 ——
// 用户看到的是「没有订单」而不是「加载失败」，且无重试入口）；取消订单等操作类 catch 仍用 toast。
const {
  items: orders,
  searchQuery,
  filter: statusFilter,
  isLoading: loading,
  error: errorRef,
  reloadNow,
} = useListQuery<AdminOrder>({
  fallbackMessage: 'Failed to load orders',
  task: async ({ q, filter, commit }) => {
    commit(await getAdminOrders({ q, status: filter }))
  },
})

const cancelDialogVisible = ref(false)
const cancelTarget = ref<AdminOrder | null>(null)

const requestCancel = (order: AdminOrder) => {
  cancelTarget.value = order
  cancelDialogVisible.value = true
}

const closeCancel = () => {
  cancelDialogVisible.value = false
  cancelTarget.value = null
}

const confirmCancel = async () => {
  const target = cancelTarget.value
  if (!target) return
  try {
    await adminCancelOrder(target.id)
    target.status = 'cancelled'
    toast({ title: 'Order cancelled', variant: 'success' })
  } catch {
    toast({ title: 'Failed to cancel order', variant: 'destructive' })
  } finally {
    closeCancel()
  }
}
</script>

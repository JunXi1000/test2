<template>
  <div class="p-6">
    <div class="admin-toolbar-shell">
      <div class="admin-toolbar-inner">
        <div class="admin-toolbar-search">
          <el-input
            v-model="searchQuery"
            placeholder="Search by order ID, customer, or merchant..."
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
            <el-option label="Pending" value="pending" />
            <el-option label="Processing" value="processing" />
            <el-option label="Shipped" value="shipped" />
            <el-option label="Delivered" value="delivered" />
            <el-option label="Cancelled" value="cancelled" />
          </el-select>
        </div>

        <el-button class="admin-toolbar-refresh-btn" @click="loadData">
          <RefreshCw class="mr-1.5 inline h-4 w-4" />
          Refresh
        </el-button>
      </div>
    </div>

    <div class="admin-table-shell">
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
                'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25': row.status === 'delivered',
                'bg-rose-500/15 text-rose-300 ring-rose-500/25': row.status === 'cancelled'
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
      </el-table>
    </div>

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
        <span class="font-semibold">{{ cancelTarget?.id }}</span>?
      </p>
      <div class="rounded-md border border-border/30 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-300">
        This is an admin action and should only be used when necessary.
      </div>
    </ConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { RefreshCw, Search as SearchIcon, ShoppingCart as ShoppingCartIcon } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import { getAdminOrders, adminCancelOrder, type AdminOrder } from '@/api/modules/adminOrders'
import { debounce } from 'lodash-es'
import ConfirmDialog from '@/components/ui/dialog/ConfirmDialog.vue'

const loading = ref(false)
const orders = ref<AdminOrder[]>([])
const searchQuery = ref('')
const statusFilter = ref('all')
const cancelDialogVisible = ref(false)
const cancelTarget = ref<AdminOrder | null>(null)

const loadData = async () => {
  loading.value = true
  try {
    const data = await getAdminOrders({ 
      q: searchQuery.value, 
      status: statusFilter.value 
    })
    orders.value = data
  } catch (error) {
    ElMessage.error('Failed to load orders')
  } finally {
    loading.value = false
  }
}

// Debounce search
const debouncedLoadData = debounce(loadData, 300)
watch(searchQuery, () => {
  debouncedLoadData()
})

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
    ElMessage.success('Order cancelled')
  } catch {
    ElMessage.error('Failed to cancel order')
  } finally {
    closeCancel()
  }
}

onMounted(loadData)
</script>

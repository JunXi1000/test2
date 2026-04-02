<template>
  <div class="merchant-page w-full max-w-full space-y-4">
    <el-card shadow="never" class="merchant-data-panel overflow-hidden rounded-xl border border-gray-100/90 bg-white shadow-sm">
      <div class="merchant-data-panel-toolbar border-b border-gray-100 bg-white">
        <div class="min-w-0 max-sm:overflow-x-auto max-sm:pb-0.5 filter-row-scroll">
          <div class="flex w-full min-w-0 flex-nowrap items-center gap-4">
            <div class="min-w-0 flex-1 basis-0">
              <el-input
                v-model="searchQuery"
                placeholder="Search order ID or customer..."
                clearable
                class="w-full"
                @input="handleSearch"
                @keyup.enter="fetchOrders"
              >
                <template #prefix>
                  <search-icon class="h-5 w-5 text-gray-400" />
                </template>
              </el-input>
            </div>

            <div class="merchant-orders-status-select w-[12.5rem] shrink-0">
              <el-select
                v-model="statusFilter"
                placeholder="All statuses"
                class="w-full"
                @change="fetchOrders"
              >
                <el-option label="All Status" value="all" />
                <el-option label="Pending" value="pending" />
                <el-option label="Processing" value="processing" />
                <el-option label="Shipped" value="shipped" />
                <el-option label="Delivered" value="delivered" />
                <el-option label="Cancelled" value="cancelled" />
              </el-select>
            </div>

            <el-button
              type="default"
              class="shrink-0 !rounded-lg border-gray-200 bg-white text-gray-700 shadow-sm hover:border-gray-300 hover:bg-gray-50"
              :loading="loading"
              @click="refreshData"
            >
              <refresh-cw-icon class="mr-1.5 h-[18px] w-[18px]" />
              Refresh
            </el-button>
          </div>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="orders"
        row-key="id"
        size="large"
        class="merchant-orders-table"
        style="width: 100%"
        highlight-current-row
      >
        <el-table-column prop="id" label="Order ID" width="168" sortable>
          <template #default="{ row }">
            <button
              type="button"
              class="font-mono text-[15px] font-semibold text-violet-600 transition-colors hover:text-violet-700 hover:underline"
              @click="viewDetails(row)"
            >
              {{ row.id }}
            </button>
          </template>
        </el-table-column>

        <el-table-column label="Customer" min-width="228">
          <template #default="{ row }">
            <div class="py-1">
              <div class="text-[15px] font-bold leading-snug tracking-tight text-gray-900">{{ row.customer.name }}</div>
              <div class="mt-0.5 text-sm text-gray-500">{{ row.customer.email }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="date" label="Date" width="132" sortable>
          <template #default="{ row }">
            <span class="text-[15px] text-gray-500 tabular-nums">{{ row.date }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="total" label="Total" width="128" sortable align="left">
          <template #default="{ row }">
            <span class="text-[15px] font-bold tabular-nums text-gray-900">${{ row.total.toFixed(2) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="items" label="Items" width="88" align="center">
          <template #default="{ row }">
            <span class="text-[15px] tabular-nums text-gray-700">{{ row.items }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="Status" width="152">
          <template #default="{ row }">
            <span
              class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide"
              :class="orderStatusPillClass(row.status)"
            >
              {{ row.status.toUpperCase() }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="Actions" width="128" align="right">
          <template #default="{ row }">
            <button
              type="button"
              class="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
              @click="viewDetails(row)"
            >
              View Details
            </button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Order Details Drawer -->
    <el-drawer
      v-model="drawerVisible"
      title="Order Details"
      size="50%"
      destroy-on-close
    >
      <div v-if="selectedOrder" class="space-y-6">
        <!-- Status Bar -->
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/90 p-4">
          <div>
            <div class="text-xs font-medium text-gray-500">Current status</div>
            <span
              class="mt-1.5 inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
              :class="orderStatusPillClass(selectedOrder.status)"
            >
              {{ selectedOrder.status.toUpperCase() }}
            </span>
          </div>
          <div class="space-x-2">
             <el-button 
               v-if="selectedOrder.status === 'pending'" 
               type="primary" 
               size="small"
               @click="updateStatus('processing')"
             >
               Start Processing
             </el-button>
             <el-button 
               v-if="selectedOrder.status === 'processing'" 
               type="success" 
               size="small"
               @click="updateStatus('shipped')"
             >
               Mark as Shipped
             </el-button>
             <el-button 
               v-if="['pending', 'processing'].includes(selectedOrder.status)" 
               type="danger" 
               size="small" 
               plain
               @click="updateStatus('cancelled')"
             >
               Cancel Order
             </el-button>
          </div>
        </div>

        <!-- Customer Info -->
        <el-descriptions title="Customer Information" :column="1" border>
          <el-descriptions-item label="Name">{{ selectedOrder.customer.name }}</el-descriptions-item>
          <el-descriptions-item label="Email">{{ selectedOrder.customer.email }}</el-descriptions-item>
          <el-descriptions-item label="Shipping Address">{{ selectedOrder.shippingAddress }}</el-descriptions-item>
          <el-descriptions-item label="Payment Method">{{ selectedOrder.paymentMethod }}</el-descriptions-item>
        </el-descriptions>

        <!-- Order Items -->
        <div>
          <h3 class="text-lg font-medium mb-2">Order Items</h3>
          <el-table :data="selectedOrder.lineItems" border style="width: 100%">
            <el-table-column label="Product" min-width="200">
              <template #default="{ row }">
                <div class="flex items-center gap-3">
                  <el-image :src="row.image" class="w-10 h-10 rounded bg-gray-100" />
                  <span>{{ row.title }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="price" label="Price" width="100">
              <template #default="{ row }">${{ row.price.toFixed(2) }}</template>
            </el-table-column>
            <el-table-column prop="quantity" label="Qty" width="80" align="center" />
            <el-table-column label="Total" width="100" align="right">
              <template #default="{ row }">${{ (row.price * row.quantity).toFixed(2) }}</template>
            </el-table-column>
          </el-table>
          <div class="flex justify-end mt-4">
             <div class="text-xl font-bold">Total: ${{ selectedOrder.total.toFixed(2) }}</div>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { 
  Search as SearchIcon, 
  RefreshCw as RefreshCwIcon 
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import { 
  getMerchantOrders, 
  getMerchantOrderDetails, 
  updateMerchantOrderStatus,
  type MerchantOrder,
  type MerchantOrderDetail
} from '@/api/modules/merchantOrders'
import { debounce } from 'lodash-es'

// State
const loading = ref(false)
const orders = ref<MerchantOrder[]>([])
const searchQuery = ref('')
const statusFilter = ref('all')
const drawerVisible = ref(false)
const selectedOrder = ref<MerchantOrderDetail | null>(null)

// Methods
const loadData = async () => {
  loading.value = true
  try {
    // Mock filtering logic
    const allOrders = await getMerchantOrders({ status: 'all' })
    let filtered = allOrders

    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      filtered = filtered.filter(o => 
        o.id.toLowerCase().includes(q) || 
        o.customer.name.toLowerCase().includes(q) ||
        o.customer.email.toLowerCase().includes(q)
      )
    }

    if (statusFilter.value !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter.value)
    }

    orders.value = filtered
  } catch (error) {
    ElMessage.error('Failed to load orders')
  } finally {
    loading.value = false
  }
}

const debouncedSearch = debounce(loadData, 300)

const handleSearch = () => {
  debouncedSearch()
}

const refreshData = () => {
  loadData()
}

// Template compatibility: some bindings use fetchOrders
const fetchOrders = () => {
  loadData()
}

function orderStatusPillClass(status: MerchantOrder['status']) {
  switch (status) {
    case 'pending':
      return 'bg-amber-50 text-amber-800 ring-1 ring-amber-100/90'
    case 'processing':
      return 'bg-blue-50 text-blue-800 ring-1 ring-blue-100/90'
    case 'shipped':
      return 'bg-gray-100 text-gray-800 ring-1 ring-gray-200/90'
    case 'delivered':
      return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100/90'
    case 'cancelled':
      return 'bg-red-50 text-red-800 ring-1 ring-red-100/90'
    default:
      return 'bg-gray-100 text-gray-700 ring-1 ring-gray-200/80'
  }
}

const viewDetails = async (row: MerchantOrder) => {
  try {
    // In a real app, fetch full details here.
    // Since our mock list is simple, we simulate fetching details
    const details = await getMerchantOrderDetails(row.id)
    selectedOrder.value = details
    drawerVisible.value = true
  } catch (error) {
    ElMessage.error('Failed to load order details')
  }
}

const updateStatus = async (newStatus: MerchantOrder['status']) => {
  if (!selectedOrder.value) return
  try {
    await updateMerchantOrderStatus(selectedOrder.value.id, newStatus)
    selectedOrder.value.status = newStatus
    ElMessage.success(`Order updated to ${newStatus}`)
    loadData() // Refresh list
  } catch (error) {
    ElMessage.error('Failed to update status')
  }
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

.merchant-orders-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.merchant-orders-table :deep(.el-table) {
  --el-table-border-color: transparent;
  --el-table-bg-color: #fff;
  --el-table-tr-bg-color: #fff;
  --el-table-header-bg-color: rgb(249 250 251);
  --el-table-row-hover-bg-color: rgb(249 250 251);
}

.merchant-orders-table :deep(thead th.el-table__cell) {
  padding-top: 14px;
  padding-bottom: 14px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgb(75 85 99);
  border-bottom: 1px solid rgb(243 244 246) !important;
  border-right: none !important;
  background-color: rgb(249 250 251) !important;
}

.merchant-orders-table :deep(tbody td.el-table__cell) {
  padding-top: 18px;
  padding-bottom: 18px;
  border-right: none !important;
  border-bottom: 1px solid rgb(243 244 246) !important;
}

.merchant-orders-table :deep(.el-table__body tr:last-child td.el-table__cell) {
  border-bottom: none !important;
}

.merchant-orders-status-select :deep(.el-select) {
  width: 100%;
}

.merchant-orders-status-select :deep(.el-select__wrapper) {
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
</style>

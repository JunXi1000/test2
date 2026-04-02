<template>
  <div class="p-6">
    <div class="admin-toolbar-shell">
      <div class="admin-toolbar-inner">
        <div class="admin-toolbar-search">
          <el-input
            v-model="searchQuery"
            placeholder="Search by store, owner, or email..."
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
            <el-option label="Pending Review" value="pending" />
            <el-option label="Active" value="active" />
            <el-option label="Suspended" value="suspended" />
          </el-select>
        </div>

        <el-button class="admin-toolbar-refresh-btn" @click="loadData">
          <RefreshCw class="mr-1.5 inline h-4 w-4" />
          Refresh
        </el-button>

        <el-button type="primary" class="admin-toolbar-primary-btn" @click="openCreateDialog">
          <Plus class="mr-1.5 inline h-4 w-4" />
          Add Merchant
        </el-button>
      </div>
    </div>

    <div class="admin-table-shell">
      <el-table v-loading="loading" :data="merchants" stripe class="admin-data-table min-w-[880px]">
        <el-table-column prop="storeName" label="Store" min-width="160">
          <template #default="{ row }">
            <div class="font-semibold tracking-tight text-white">{{ row.storeName }}</div>
          </template>
        </el-table-column>

        <el-table-column prop="ownerName" label="Owner" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="text-sm text-zinc-400">{{ row.ownerName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="Email" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="text-sm text-zinc-400">{{ row.email }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="joinedAt" label="Joined" width="132" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="text-sm text-zinc-400">{{ row.joinedAt }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="revenue" label="Total Revenue" width="138" min-width="128" sortable align="right">
          <template #default="{ row }">
            <span class="tabular-nums font-medium text-zinc-100">${{ row.revenue.toLocaleString() }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="Status" width="130">
          <template #default="{ row }">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset"
              :class="statusBadgeClass(row.status)"
            >
              <span
                class="h-1.5 w-1.5 shrink-0 rounded-full"
                :class="statusDotClass(row.status)"
              />
              {{ statusLabel(row.status) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="Actions" min-width="240" width="268" fixed="right" align="right">
          <template #default="{ row }">
            <div class="flex flex-wrap items-center justify-end gap-2">
              <el-tooltip content="Details" placement="top" :show-after="350">
                <button
                  type="button"
                  class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-600/70 bg-zinc-800/95 text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40"
                  @click="openDrawer(row)"
                >
                  <Eye class="h-4 w-4" aria-hidden="true" />
                </button>
              </el-tooltip>
              <el-tooltip content="Edit" placement="top" :show-after="350">
                <button
                  type="button"
                  class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-600/70 bg-zinc-800/95 text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40"
                  @click="handleEditMerchant(row)"
                >
                  <Pencil class="h-4 w-4" aria-hidden="true" />
                </button>
              </el-tooltip>

              <template v-if="row.status === 'pending'">
                <button
                  type="button"
                  class="h-9 shrink-0 rounded-full border border-emerald-500/40 bg-emerald-950/55 px-3 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-900/45"
                  @click="handleApprove(row)"
                >
                  Approve
                </button>
                <button
                  type="button"
                  class="h-9 shrink-0 rounded-full border border-rose-500/35 bg-rose-950/50 px-3 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-900/40"
                  @click="handleReject(row)"
                >
                  Reject
                </button>
              </template>
              <button
                v-else-if="row.status === 'active'"
                type="button"
                class="h-9 shrink-0 rounded-full border border-rose-500/35 bg-rose-950/50 px-3 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-900/40"
                @click="handleSuspend(row)"
              >
                Suspend
              </button>
              <button
                v-else-if="row.status === 'suspended'"
                type="button"
                class="h-9 shrink-0 rounded-full border border-emerald-500/40 bg-emerald-950/55 px-3 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-900/45"
                @click="handleActivate(row)"
              >
                Activate
              </button>
              <button
                v-else-if="row.status === 'rejected'"
                type="button"
                class="h-9 shrink-0 rounded-full border border-zinc-500/45 bg-zinc-800/80 px-3 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700/90"
                @click="handleReopenAsPending(row)"
              >
                Reopen
              </button>

              <el-tooltip content="Delete" placement="top" :show-after="350">
                <button
                  type="button"
                  class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose-500/30 bg-rose-950/35 text-rose-300 transition-colors hover:border-rose-400/50 hover:bg-rose-900/45 hover:text-rose-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30"
                  aria-label="Delete merchant"
                  @click="handleDelete(row)"
                >
                  <Trash2 class="h-4 w-4" aria-hidden="true" />
                </button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Merchant Details Drawer -->
    <DetailDrawer v-model="drawerVisible" title="Merchant Details" size="500px">
      <div v-if="selectedMerchant" class="space-y-5">
        <div class="rounded-2xl border border-zinc-800/60 bg-zinc-950/35 p-4 ring-1 ring-white/[0.03]">
          <div class="flex items-center gap-4">
            <div
              class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-zinc-700/50 bg-[#141416] text-zinc-300"
            >
              <StoreIcon class="h-8 w-8" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-lg font-semibold tracking-tight text-white">{{ selectedMerchant.storeName }}</h3>
              <p class="text-sm text-zinc-400">Owner: {{ selectedMerchant.ownerName }}</p>
              <button
                type="button"
                class="mt-1.5 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
                @click="handleEditMerchant(selectedMerchant)"
              >
                Edit info
              </button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
            <div class="mb-1 text-xs text-zinc-500">Total Revenue</div>
            <div class="text-lg font-semibold tabular-nums text-white">${{ selectedMerchant.revenue.toLocaleString() }}</div>
          </div>
          <div class="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
            <div class="mb-1 text-xs text-zinc-500">Platform Fee (5%)</div>
            <div class="text-lg font-semibold tabular-nums text-white">
              ${{ (selectedMerchant.revenue * 0.05).toLocaleString() }}
            </div>
          </div>
        </div>

        <el-descriptions :column="1" border class="dark-desc">
          <el-descriptions-item label="Merchant ID">{{ selectedMerchant.id }}</el-descriptions-item>
          <el-descriptions-item label="Email">{{ selectedMerchant.email }}</el-descriptions-item>
          <el-descriptions-item label="Status">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset"
              :class="statusBadgeClass(selectedMerchant.status)"
            >
              <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="statusDotClass(selectedMerchant.status)" />
              {{ statusLabel(selectedMerchant.status) }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="Joined Date">{{ selectedMerchant.joinedAt }}</el-descriptions-item>
          <el-descriptions-item label="Business License">
            <a href="#" class="text-violet-400 transition-colors hover:text-violet-300 hover:underline">View document</a>
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="selectedMerchant.status === 'pending'" class="border-t border-zinc-800/80 pt-5">
          <h4 class="mb-3 text-sm font-medium text-zinc-200">Review application</h4>
          <div class="flex gap-3">
            <button
              type="button"
              class="h-10 flex-1 rounded-full border border-emerald-500/40 bg-emerald-950/55 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-900/45"
              @click="handleApprove(selectedMerchant); drawerVisible = false"
            >
              Approve
            </button>
            <button
              type="button"
              class="h-10 flex-1 rounded-full border border-rose-500/35 bg-rose-950/50 text-sm font-medium text-rose-300 transition-colors hover:bg-rose-900/40"
              @click="handleReject(selectedMerchant); drawerVisible = false"
            >
              Reject
            </button>
          </div>
        </div>

        <div v-else-if="selectedMerchant.status === 'active'" class="border-t border-zinc-800/80 pt-5">
          <h4 class="mb-3 text-sm font-medium text-zinc-200">Store controls</h4>
          <button
            type="button"
            class="h-10 w-full rounded-full border border-rose-500/35 bg-rose-950/50 text-sm font-medium text-rose-300 transition-colors hover:bg-rose-900/40"
            @click="handleSuspend(selectedMerchant)"
          >
            Suspend store
          </button>
        </div>

        <div v-else-if="selectedMerchant.status === 'suspended'" class="border-t border-zinc-800/80 pt-5">
          <h4 class="mb-3 text-sm font-medium text-zinc-200">Store controls</h4>
          <button
            type="button"
            class="h-10 w-full rounded-full border border-emerald-500/40 bg-emerald-950/55 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-900/45"
            @click="handleActivate(selectedMerchant)"
          >
            Activate store
          </button>
        </div>

        <div v-else-if="selectedMerchant.status === 'rejected'" class="border-t border-zinc-800/80 pt-5">
          <h4 class="mb-3 text-sm font-medium text-zinc-200">Rejected application</h4>
          <div class="flex flex-col gap-2.5">
            <button
              type="button"
              class="h-10 w-full rounded-full border border-zinc-500/45 bg-zinc-800/80 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700/90"
              @click="handleReopenAsPending(selectedMerchant)"
            >
              Reopen as pending
            </button>
            <button
              type="button"
              class="h-10 w-full rounded-full border border-rose-500/35 bg-rose-950/40 text-sm font-medium text-rose-300 transition-colors hover:bg-rose-900/45"
              @click="handleDelete(selectedMerchant)"
            >
              Delete record
            </button>
          </div>
        </div>
      </div>
    </DetailDrawer>

    <!-- Create/Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditMode ? 'Edit Merchant' : 'Add Merchant'"
      width="500px"
      append-to-body
      class="admin-dialog"
    >
      <el-form :model="form" label-position="top">
        <el-form-item label="Store Name">
          <el-input v-model="form.storeName" />
        </el-form-item>
        <el-form-item label="Owner Name">
          <el-input v-model="form.ownerName" />
        </el-form-item>
        <el-form-item label="Email">
          <el-input v-model="form.email" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button class="admin-toolbar-refresh-btn" @click="dialogVisible = false">Cancel</el-button>
        <el-button type="primary" class="admin-toolbar-primary-btn !px-6" @click="handleSubmit">
          {{ isEditMode ? 'Save' : 'Create' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, toRaw, watch } from 'vue'
import {
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search as SearchIcon,
  Store as StoreIcon,
  Trash2
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getAdminMerchants,
  approveMerchant,
  rejectMerchant,
  createMerchant,
  updateMerchant,
  deleteMerchant,
  type AdminMerchant
} from '@/api/modules/adminMerchants'
import DetailDrawer from '@/components/ui/admin/DetailDrawer.vue'
import { debounce } from 'lodash-es'

function statusLabel(s: AdminMerchant['status']) {
  return s === 'pending' ? 'Pending' : s === 'active' ? 'Active' : s === 'suspended' ? 'Suspended' : 'Rejected'
}

function statusBadgeClass(s: AdminMerchant['status']) {
  if (s === 'pending') return 'bg-amber-500/12 text-amber-300 ring-amber-500/25'
  if (s === 'active') return 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/25'
  if (s === 'suspended') return 'bg-rose-500/12 text-rose-300 ring-rose-500/25'
  return 'bg-rose-500/10 text-rose-300/95 ring-rose-500/22'
}

function statusDotClass(s: AdminMerchant['status']) {
  if (s === 'pending') return 'bg-amber-400'
  if (s === 'active') return 'bg-emerald-400'
  if (s === 'suspended') return 'bg-rose-400'
  return 'bg-rose-400'
}

const loading = ref(false)
const merchants = ref<AdminMerchant[]>([])
const searchQuery = ref('')
const statusFilter = ref('all')
const drawerVisible = ref(false)
const selectedMerchant = ref<AdminMerchant | null>(null)

// Create/Edit Dialog
const dialogVisible = ref(false)
const isEditMode = ref(false)
const form = reactive({
  storeName: '',
  ownerName: '',
  email: ''
})

const loadData = async () => {
  loading.value = true
  try {
    const data = await getAdminMerchants({ 
      q: searchQuery.value, 
      status: statusFilter.value 
    })
    merchants.value = data
  } catch (error) {
    ElMessage.error('Failed to load merchants')
  } finally {
    loading.value = false
  }
}

// Debounce search
const debouncedLoadData = debounce(loadData, 300)
watch(searchQuery, () => {
  debouncedLoadData()
})

function syncSelectedRow(row: AdminMerchant, patch: Partial<AdminMerchant>) {
  Object.assign(row, patch)
  if (selectedMerchant.value?.id === row.id) {
    Object.assign(selectedMerchant.value, patch)
  }
}

const handleApprove = async (row: AdminMerchant) => {
  try {
    await approveMerchant(row.id)
    syncSelectedRow(row, { status: 'active' })
    ElMessage.success('Merchant approved')
  } catch (error) {
    ElMessage.error('Action failed')
  }
}

const handleReject = async (row: AdminMerchant) => {
  try {
    await ElMessageBox.confirm('Reject this merchant application?', 'Confirm', {
      confirmButtonText: 'Reject',
      cancelButtonText: 'Cancel',
      type: 'warning'
    })
    await rejectMerchant(row.id)
    syncSelectedRow(row, { status: 'rejected' })
    ElMessage.success('Merchant rejected')
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('Action failed')
  }
}

const handleSuspend = async (row: AdminMerchant) => {
  try {
    await ElMessageBox.confirm(
      'This merchant will not be able to sell while suspended. Continue?',
      'Suspend merchant',
      { confirmButtonText: 'Suspend', cancelButtonText: 'Cancel', type: 'warning' }
    )
    const updated = await updateMerchant(row.id, { status: 'suspended' })
    syncSelectedRow(row, updated)
    ElMessage.success('Merchant suspended')
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('Action failed')
  }
}

const handleActivate = async (row: AdminMerchant) => {
  try {
    const updated = await updateMerchant(row.id, { status: 'active' })
    syncSelectedRow(row, updated)
    ElMessage.success('Merchant activated')
  } catch {
    ElMessage.error('Action failed')
  }
}

const handleReopenAsPending = async (row: AdminMerchant) => {
  try {
    await ElMessageBox.confirm(
      'Move this application back to pending review?',
      'Reopen application',
      { confirmButtonText: 'Reopen', cancelButtonText: 'Cancel', type: 'info' }
    )
    const updated = await updateMerchant(row.id, { status: 'pending' })
    syncSelectedRow(row, updated)
    ElMessage.success('Merchant is now pending review')
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('Action failed')
  }
}

const handleDelete = async (row: AdminMerchant) => {
  try {
    await ElMessageBox.confirm(
      'Permanently remove this merchant from the list? This cannot be undone.',
      'Delete merchant',
      { confirmButtonText: 'Delete', cancelButtonText: 'Cancel', type: 'warning' }
    )
    await deleteMerchant(row.id)
    merchants.value = merchants.value.filter(m => m.id !== row.id)
    if (selectedMerchant.value?.id === row.id) {
      drawerVisible.value = false
      selectedMerchant.value = null
    }
    ElMessage.success('Merchant removed')
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('Action failed')
  }
}

const openDrawer = (row: AdminMerchant) => {
  selectedMerchant.value = row
  drawerVisible.value = true
}

const openCreateDialog = () => {
  selectedMerchant.value = null
  isEditMode.value = false
  form.storeName = ''
  form.ownerName = ''
  form.email = ''
  dialogVisible.value = true
}

const handleEditMerchant = (row: AdminMerchant) => {
  selectedMerchant.value = row
  isEditMode.value = true
  form.storeName = row.storeName
  form.ownerName = row.ownerName
  form.email = row.email
  dialogVisible.value = true
}

const handleSubmit = async () => {
  try {
    const payload = toRaw(form)
    if (isEditMode.value && selectedMerchant.value) {
      const updated = await updateMerchant(selectedMerchant.value.id, payload)
      const idx = merchants.value.findIndex(m => m.id === updated.id)
      if (idx !== -1) merchants.value[idx] = updated
      selectedMerchant.value = merchants.value[idx] ?? updated
      ElMessage.success('Merchant updated')
    } else {
      await createMerchant(payload)
      ElMessage.success('Merchant created')
      await loadData() // Reload list to see new item
    }
    dialogVisible.value = false
  } catch (error) {
    console.error(error)
    ElMessage.error('Operation failed')
  }
}

onMounted(loadData)
</script>

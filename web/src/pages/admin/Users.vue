<template>
  <div class="p-6">
    <div class="admin-toolbar-shell">
      <div class="admin-toolbar-inner">
        <div class="admin-toolbar-search">
          <el-input
            v-model="searchQuery"
            placeholder="Search by name or email..."
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
          <el-select v-model="roleFilter" placeholder="All Roles" class="!w-full" @change="loadData">
            <el-option label="All Roles" value="all" />
            <el-option label="User" value="user" />
            <el-option label="Merchant" value="merchant" />
            <el-option label="Admin" value="admin" />
          </el-select>
        </div>

        <el-button class="admin-toolbar-refresh-btn" @click="loadData">
          <RefreshCw class="mr-1.5 inline h-4 w-4" />
          Refresh
        </el-button>
      </div>
    </div>

    <div class="admin-table-shell">
      <el-table v-loading="loading" :data="users" stripe class="admin-data-table min-w-[680px]">
        <el-table-column prop="name" label="Name" min-width="140">
          <template #default="{ row }">
            <div class="font-semibold tracking-tight text-white">{{ row.name }}</div>
          </template>
        </el-table-column>

        <el-table-column prop="email" label="Email" min-width="190" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="text-sm text-zinc-400">{{ row.email }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="role" label="Role" width="118">
          <template #default="{ row }">
            <span
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset"
              :class="{
                'bg-sky-500/15 text-sky-300 ring-sky-500/25': row.role === 'user',
                'bg-amber-500/15 text-amber-300 ring-amber-500/25': row.role === 'merchant',
                'bg-violet-500/15 text-violet-300 ring-violet-500/25': row.role === 'admin'
              }"
            >
              {{ row.role }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="Status" width="124">
          <template #default="{ row }">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
              :class="
                row.status === 'active'
                  ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25'
                  : 'bg-rose-500/15 text-rose-300 ring-rose-500/25'
              "
            >
              <span
                class="h-1.5 w-1.5 shrink-0 rounded-full"
                :class="row.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'"
              />
              {{ row.status === 'active' ? 'Active' : 'Suspended' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="joinedAt" label="Joined" width="138" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="text-zinc-400 text-sm">{{ row.joinedAt }}</span>
          </template>
        </el-table-column>

        <el-table-column label="Actions" min-width="200" width="216" fixed="right" align="right">
          <template #default="{ row }">
            <div class="flex flex-wrap items-center justify-end gap-1.5">
              <el-tooltip content="Details" placement="top" :show-after="350">
                <button
                  type="button"
                  class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-600/70 bg-zinc-800/95 text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40"
                  @click="openDrawer(row as AdminUser)"
                >
                  <Eye class="h-4 w-4" aria-hidden="true" />
                </button>
              </el-tooltip>
              <el-tooltip content="Edit" placement="top" :show-after="350">
                <button
                  type="button"
                  class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-600/70 bg-zinc-800/95 text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40"
                  @click="openEditFromTable(row as AdminUser)"
                >
                  <Pencil class="h-4 w-4" aria-hidden="true" />
                </button>
              </el-tooltip>
              <button
                type="button"
                class="h-9 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors"
                :class="
                  row.status === 'active'
                    ? 'border-rose-500/35 bg-rose-950/50 text-rose-300 hover:bg-rose-900/40'
                    : 'border-emerald-500/40 bg-emerald-950/55 text-emerald-300 hover:bg-emerald-900/45'
                "
                @click="handleToggleStatus(row as AdminUser)"
              >
                {{ row.status === 'active' ? 'Suspend' : 'Activate' }}
              </button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- User Details Drawer -->
    <DetailDrawer v-model="drawerVisible" title="User Details" size="400px">
      <div v-if="selectedUser" class="space-y-6">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-2xl font-bold text-zinc-400">
            {{ selectedUser.name.charAt(0) }}
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-bold text-white mb-1">{{ selectedUser.name }}</h3>
            <p class="text-zinc-400 text-sm mb-2">{{ selectedUser.email }}</p>
            <div class="flex gap-2">
              <el-button size="small" @click="handleResetPassword(selectedUser)">Reset Password</el-button>
              <el-button size="small" type="primary" plain @click="handleEditUser(selectedUser)">Edit Info</el-button>
            </div>
          </div>
        </div>

        <el-descriptions :column="1" border class="dark-desc">
          <el-descriptions-item label="User ID">{{ selectedUser.id }}</el-descriptions-item>
          <el-descriptions-item label="Role">
            <span class="capitalize">{{ selectedUser.role }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="Status">
            <el-tag :type="selectedUser.status === 'active' ? 'success' : 'danger'" size="small">
              {{ selectedUser.status.toUpperCase() }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="Joined Date">{{ selectedUser.joinedAt }}</el-descriptions-item>
          <el-descriptions-item label="Last Login">2023-11-15 14:30</el-descriptions-item>
          <el-descriptions-item label="IP Address">192.168.1.10</el-descriptions-item>
        </el-descriptions>

        <div class="pt-4 border-t border-white/10">
          <h4 class="font-medium text-white mb-3">Activity Log</h4>
          <el-timeline>
            <el-timeline-item timestamp="2023-11-15" placement="top">
              <div class="text-zinc-400 text-sm">Logged in from Chrome on Windows</div>
            </el-timeline-item>
            <el-timeline-item timestamp="2023-11-10" placement="top">
              <div class="text-zinc-400 text-sm">Updated profile information</div>
            </el-timeline-item>
            <el-timeline-item timestamp="2023-10-01" placement="top">
              <div class="text-zinc-400 text-sm">Account created</div>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>
    </DetailDrawer>

    <!-- Edit User Dialog -->
    <el-dialog v-model="editDialogVisible" title="Edit User" width="400px" append-to-body>
      <el-form label-position="top">
        <el-form-item label="Name">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="Email">
          <el-input v-model="editForm.email" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="saveUserEdit">Save</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Eye, Pencil, RefreshCw, Search as SearchIcon } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAdminUsers, toggleUserStatus, resetUserPassword, updateUser, type AdminUser } from '@/api/modules/adminUsers'
import DetailDrawer from '@/components/ui/admin/DetailDrawer.vue'
import { debounce } from 'lodash-es'

const loading = ref(false)
const users = ref<AdminUser[]>([])
const searchQuery = ref('')
const roleFilter = ref('all')
const drawerVisible = ref(false)
const selectedUser = ref<AdminUser | null>(null)

// Edit User Dialog
const editDialogVisible = ref(false)
const editForm = ref({ name: '', email: '' })

const loadData = async () => {
  loading.value = true
  try {
    const data = await getAdminUsers({ 
      q: searchQuery.value, 
      role: roleFilter.value 
    })
    users.value = data
  } catch (error) {
    ElMessage.error('Failed to load users')
  } finally {
    loading.value = false
  }
}

// Debounce search input
const debouncedLoadData = debounce(loadData, 300)

watch(searchQuery, () => {
  debouncedLoadData()
})

const handleToggleStatus = async (user: AdminUser) => {
  try {
    const updated = await toggleUserStatus(user.id)
    user.status = updated.status
    if (selectedUser.value && selectedUser.value.id === user.id) {
      selectedUser.value.status = updated.status
    }
    ElMessage.success(`User ${updated.status === 'active' ? 'activated' : 'suspended'}`)
  } catch (error) {
    ElMessage.error('Failed to update status')
  }
}

const handleResetPassword = (user: AdminUser) => {
  ElMessageBox.confirm(
    `Are you sure you want to reset password for ${user.name}?`,
    'Warning',
    { confirmButtonText: 'Reset', cancelButtonText: 'Cancel', type: 'warning' }
  ).then(async () => {
    try {
      await resetUserPassword(user.id)
      ElMessage.success('Password reset email sent')
    } catch (error) {
      ElMessage.error('Failed to reset password')
    }
  })
}

const handleEditUser = (user: AdminUser) => {
  editForm.value = { name: user.name, email: user.email }
  editDialogVisible.value = true
}

const saveUserEdit = async () => {
  if (!selectedUser.value) return
  try {
    const updated = await updateUser(selectedUser.value.id, editForm.value)
    selectedUser.value.name = updated.name
    selectedUser.value.email = updated.email
    
    // Update list
    const index = users.value.findIndex(u => u.id === updated.id)
    if (index !== -1) users.value[index] = { ...users.value[index], ...updated }
    
    editDialogVisible.value = false
    ElMessage.success('User updated successfully')
  } catch (error) {
    ElMessage.error('Failed to update user')
  }
}

const openDrawer = (user: AdminUser) => {
  selectedUser.value = user
  drawerVisible.value = true
}

const openEditFromTable = (user: AdminUser) => {
  selectedUser.value = user
  handleEditUser(user)
}

onMounted(loadData)
</script>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { MapPin, Plus, Edit2, Trash2, Check } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { 
  getAddresses, 
  createAddress, 
  updateAddress, 
  deleteAddress, 
  setDefaultAddress, 
  type Address 
} from '@/api/modules/address'
import ErrorState from '@/components/ui/state/ErrorState.vue'
import { ElMessageBox } from 'element-plus'
import { useToast } from '@/composables/useToast'
import type { FormInstance, FormRules } from 'element-plus'

const addresses = ref<Address[]>([])
const isLoadingRef = ref<boolean>(true)
const errorRef = ref<string>('')
const { toast } = useToast()

// Dialog State
const dialogVisible = ref(false)
const isEditMode = ref(false)
const isSubmitting = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
  id: 0,
  type: 'Home' as 'Home' | 'Work',
  name: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  country: 'United States',
  isDefault: false
})

const rules = reactive<FormRules>({
  type: [{ required: true, message: 'Type is required', trigger: 'change' }],
  name: [{ required: true, message: 'Full Name is required', trigger: 'blur' }],
  phone: [{ required: true, message: 'Phone number is required', trigger: 'blur' }],
  address: [{ required: true, message: 'Street address is required', trigger: 'blur' }],
  city: [{ required: true, message: 'City is required', trigger: 'blur' }],
  state: [{ required: true, message: 'State/Province is required', trigger: 'blur' }],
  zip: [{ required: true, message: 'Zip/Postal code is required', trigger: 'blur' }],
  country: [{ required: true, message: 'Country is required', trigger: 'blur' }]
})

async function fetchAddresses() {
  try {
    isLoadingRef.value = true
    errorRef.value = ''
    addresses.value = await getAddresses()
  } catch (e: any) {
    errorRef.value = e?.message || 'Failed to load addresses'
  } finally {
    isLoadingRef.value = false
  }
}

onMounted(fetchAddresses)

function resetForm() {
  form.id = 0
  form.type = 'Home'
  form.name = ''
  form.phone = ''
  form.address = ''
  form.city = ''
  form.state = ''
  form.zip = ''
  form.country = 'United States'
  form.isDefault = false
  if (formRef.value) formRef.value.resetFields()
}

function openAddDialog() {
  isEditMode.value = false
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(addr: Address) {
  isEditMode.value = true
  form.id = addr.id
  form.type = addr.type
  form.name = addr.name
  form.phone = addr.phone
  form.address = addr.address
  form.city = addr.city
  form.state = addr.state
  form.zip = addr.zip
  form.country = addr.country
  form.isDefault = addr.isDefault
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      isSubmitting.value = true
      try {
        if (isEditMode.value) {
          const updated = await updateAddress(form.id, { ...form })
          // Update local list
          const index = addresses.value.findIndex(a => a.id === form.id)
          if (index !== -1) addresses.value[index] = updated
          if (updated.isDefault) {
            addresses.value.forEach(a => { if (a.id !== updated.id) a.isDefault = false })
          }
          toast({ title: 'Address updated', description: 'Changes saved successfully.', variant: 'success' })
        } else {
          // Create
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...payload } = form
          const created = await createAddress(payload)
          if (created.isDefault) {
            addresses.value.forEach(a => a.isDefault = false)
          }
          addresses.value.push(created)
          toast({ title: 'Address added', description: 'New address has been saved.', variant: 'success' })
        }
        dialogVisible.value = false
      } catch (e: any) {
        toast({ title: 'Error', description: e?.message || 'Operation failed', variant: 'destructive' })
      } finally {
        isSubmitting.value = false
      }
    }
  })
}

async function handleSetDefault(id: number) {
  try {
    await setDefaultAddress(id)
    addresses.value.forEach(a => a.isDefault = (a.id === id))
    toast({ title: 'Default updated', description: 'Primary shipping address changed.', variant: 'success' })
  } catch (e: any) {
    toast({ title: 'Error', description: e?.message || 'Failed to set default', variant: 'destructive' })
  }
}

async function confirmRemoveAddress(id: number) {
  try {
    await ElMessageBox.confirm(
      'This address will be permanently removed. Continue?',
      'Delete Address',
      { type: 'warning', confirmButtonText: 'Delete', cancelButtonText: 'Cancel' }
    )
    await deleteAddress(id)
    addresses.value = addresses.value.filter(a => a.id !== id)
    toast({ title: 'Address removed', description: 'The address has been deleted.', variant: 'success' })
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Addresses</h1>
      <Button size="sm" @click="openAddDialog">
        <Plus class="w-4 h-4 mr-2" />
        Add New Address
      </Button>
    </div>

    <div v-if="isLoadingRef" class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div v-for="i in 2" :key="i" class="border rounded-xl p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <Skeleton class="w-4 h-4 rounded-full" />
            <Skeleton class="h-5 w-16 rounded-md" />
          </div>
          <Skeleton class="h-6 w-16 rounded-md" />
        </div>
        <div class="space-y-2">
          <Skeleton class="h-4 w-24 rounded-md" />
          <Skeleton class="h-4 w-48 rounded-md" />
          <Skeleton class="h-4 w-40 rounded-md" />
          <Skeleton class="h-4 w-28 rounded-md" />
        </div>
      </div>
    </div>

    <ErrorState v-if="!isLoadingRef && errorRef" :message="errorRef" @retry="fetchAddresses" />
    
    <div v-else-if="!isLoadingRef && addresses.length === 0" class="text-center py-12 border rounded-xl bg-card">
      <MapPin class="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <h3 class="text-lg font-medium mb-2">No addresses found</h3>
      <p class="text-muted-foreground mb-6">Add your shipping details for faster checkout.</p>
      <Button @click="openAddDialog">Add Address</Button>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div 
        v-for="addr in addresses" 
        :key="addr.id"
        class="border rounded-xl p-6 relative transition-all hover:shadow-md group cursor-pointer"
        :class="addr.isDefault ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'"
        @click="handleSetDefault(addr.id)"
      >
        <div class="flex justify-between items-start mb-4">
          <div class="flex items-center gap-2">
            <MapPin class="w-4 h-4" :class="addr.isDefault ? 'text-primary' : 'text-muted-foreground'" />
            <span class="font-bold">{{ addr.type }}</span>
            <span v-if="addr.isDefault" class="px-2 py-0.5 bg-primary text-primary-foreground text-[10px] rounded-full font-medium">Default</span>
          </div>
          <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="p-1.5 hover:bg-secondary rounded-md text-muted-foreground hover:text-foreground transition-colors" @click.stop="openEditDialog(addr)">
              <Edit2 class="w-4 h-4" />
            </button>
            <button class="p-1.5 hover:bg-destructive/10 rounded-md text-muted-foreground hover:text-destructive transition-colors" @click.stop="confirmRemoveAddress(addr.id)">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div class="space-y-1 text-sm text-muted-foreground">
          <p class="font-medium text-foreground">{{ addr.name }}</p>
          <p>{{ addr.address }}</p>
          <p>{{ addr.city }}, {{ addr.state }} {{ addr.zip }}</p>
          <p>{{ addr.country }}</p>
          <p class="pt-2">{{ addr.phone }}</p>
        </div>
      </div>
    </div>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditMode ? 'Edit Address' : 'New Address'"
      width="500px"
      append-to-body
      destroy-on-close
    >
      <el-form 
        ref="formRef"
        :model="form" 
        :rules="rules" 
        label-position="top"
        class="mt-2"
      >
        <div class="grid grid-cols-2 gap-4">
          <el-form-item label="Type" prop="type">
            <el-select v-model="form.type" placeholder="Select type" class="w-full">
              <el-option label="Home" value="Home" />
              <el-option label="Work" value="Work" />
            </el-select>
          </el-form-item>
          <el-form-item label="Full Name" prop="name">
            <el-input v-model="form.name" placeholder="John Doe" />
          </el-form-item>
        </div>

        <el-form-item label="Phone" prop="phone">
          <el-input v-model="form.phone" placeholder="+1 (555) 000-0000" />
        </el-form-item>

        <el-form-item label="Address" prop="address">
          <el-input v-model="form.address" placeholder="123 Main St" />
        </el-form-item>

        <div class="grid grid-cols-2 gap-4">
          <el-form-item label="City" prop="city">
            <el-input v-model="form.city" />
          </el-form-item>
          <el-form-item label="State/Province" prop="state">
            <el-input v-model="form.state" />
          </el-form-item>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <el-form-item label="Zip Code" prop="zip">
            <el-input v-model="form.zip" />
          </el-form-item>
          <el-form-item label="Country" prop="country">
            <el-input v-model="form.country" />
          </el-form-item>
        </div>

        <el-form-item>
          <div class="flex items-center gap-2">
            <el-switch v-model="form.isDefault" />
            <span class="text-sm">Set as default address</span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer flex gap-2 justify-end">
          <Button variant="outline" @click="dialogVisible = false">Cancel</Button>
          <Button @click="handleSubmit" :disabled="isSubmitting">
            {{ isEditMode ? 'Save Changes' : 'Create Address' }}
          </Button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>
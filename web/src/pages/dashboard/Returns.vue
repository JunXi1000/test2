<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useReturnStore } from '@/stores/returns'
import { useToast } from '@/composables/useToast'
import Button from '@/components/ui/button/Button.vue'
import Card from '@/components/ui/card/Card.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import StatusBadge from '@/components/ui/badge/StatusBadge.vue'
import { RotateCcw, Clock, CheckCircle, XCircle, DollarSign, Package } from 'lucide-vue-next'

const returnStore = useReturnStore()
const { toast } = useToast()
const isLoadingRef = ref(true)
const showForm = ref(false)

// Form
const formOrderId = ref('')
const formProduct = ref('')
const formProductImage = ref('')
const formReason = ref('')
const formDetail = ref('')
const formAmount = ref(0)

const reasons = [
  'Defective item',
  'Wrong item received',
  'Not as described',
  'Arrived too late',
  'Changed my mind',
  'Damaged in transit',
  'Size/fit issue',
  'Other',
]

onMounted(async () => {
  await returnStore.load()
  isLoadingRef.value = false
})

function openReturnForm(orderId?: string, productTitle?: string, productImage?: string, amount?: number) {
  formOrderId.value = orderId || ''
  formProduct.value = productTitle || ''
  formProductImage.value = productImage || ''
  formAmount.value = amount || 0
  formReason.value = ''
  formDetail.value = ''
  showForm.value = true
}

function submitReturn() {
  if (!formOrderId.value || !formReason.value) {
    toast({ title: 'Required fields missing', description: 'Please fill in the order ID and reason.', variant: 'destructive' })
    return
  }
  returnStore.submitRequest({
    orderId: formOrderId.value,
    productTitle: formProduct.value || 'Unknown Product',
    productImage: formProductImage.value || '',
    reason: formReason.value,
    detail: formDetail.value,
    refundAmount: formAmount.value,
  })
  toast({ title: 'Return Requested', description: 'Your return request has been submitted for review.', variant: 'success' })
  showForm.value = false
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'pending': return Clock
    case 'approved': return CheckCircle
    case 'rejected': return XCircle
    case 'refunded': return DollarSign
    default: return Package
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Returns & Refunds</h1>
        <p class="text-sm text-muted-foreground mt-1">Track your return requests</p>
      </div>
      <Button @click="openReturnForm()" size="sm">
        <RotateCcw class="w-4 h-4 mr-2" />
        New Return
      </Button>
    </div>

    <!-- Return Form Modal -->
    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" @click.self="showForm = false">
      <Card class="w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-bold mb-4">Request a Return</h3>
        <div class="space-y-4">
          <div>
            <label class="text-sm font-medium">Order ID <span class="text-destructive">*</span></label>
            <input v-model="formOrderId" placeholder="e.g. ORD-123456" class="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm mt-1 outline-none focus:border-primary" />
          </div>
          <div>
            <label class="text-sm font-medium">Product Name</label>
            <input v-model="formProduct" placeholder="Product name" class="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm mt-1 outline-none focus:border-primary" />
          </div>
          <div>
            <label class="text-sm font-medium">Refund Amount</label>
            <input v-model.number="formAmount" type="number" step="0.01" placeholder="0.00" class="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm mt-1 outline-none focus:border-primary" />
          </div>
          <div>
            <label class="text-sm font-medium">Reason <span class="text-destructive">*</span></label>
            <select v-model="formReason" class="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm mt-1 outline-none focus:border-primary">
              <option value="">-- Select reason --</option>
              <option v-for="r in reasons" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
          <div>
            <label class="text-sm font-medium">Details</label>
            <textarea v-model="formDetail" rows="3" placeholder="Describe the issue..." class="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm mt-1 outline-none focus:border-primary resize-none" />
          </div>
          <div class="flex gap-2 pt-2">
            <Button @click="submitReturn" class="flex-1">Submit Request</Button>
            <Button variant="outline" @click="showForm = false">Cancel</Button>
          </div>
        </div>
      </Card>
    </div>

    <!-- Loading -->
    <div v-if="isLoadingRef" class="space-y-3">
      <Card v-for="i in 3" :key="i" class="p-5 space-y-3">
        <Skeleton class="h-5 w-1/3" />
        <Skeleton class="h-4 w-2/3" />
      </Card>
    </div>

    <!-- Requests list -->
    <template v-else>
      <div v-if="returnStore.requests.length === 0" class="text-center py-16 border border-dashed border-border rounded-xl">
        <RotateCcw class="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 class="text-lg font-semibold mb-1">No return requests</h3>
        <p class="text-muted-foreground text-sm mb-4">Need to return something? Submit a request above.</p>
      </div>

      <div class="space-y-3">
        <Card
          v-for="req in returnStore.requests"
          :key="req.id"
          class="p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <img v-if="req.productImage" :src="req.productImage" :alt="req.productTitle" class="w-12 h-12 rounded-lg object-cover" />
              <div v-else class="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                <Package class="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h3 class="font-semibold text-sm">{{ req.productTitle }}</h3>
                <p class="text-xs text-muted-foreground">{{ req.id }} · Order {{ req.orderId }}</p>
                <p class="text-xs text-muted-foreground mt-0.5">Reason: {{ req.reason }}</p>
                <p v-if="req.detail" class="text-xs text-muted-foreground line-clamp-1">{{ req.detail }}</p>
              </div>
            </div>
            <div class="text-right shrink-0">
              <StatusBadge :status="req.status" class="mb-1" />
              <p class="text-sm font-bold text-primary">${{ req.refundAmount.toFixed(2) }}</p>
              <p class="text-[10px] text-muted-foreground">{{ new Date(req.createdAt).toLocaleDateString() }}</p>
            </div>
          </div>
        </Card>
      </div>
    </template>
  </div>
</template>

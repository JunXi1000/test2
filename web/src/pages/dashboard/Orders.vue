<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Package, Search, Filter, MapPin, CreditCard, Truck, Copy, FileText, ShoppingBag, RotateCcw, MessageSquare } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { getOrders, persistUserCheckoutOrderStatus, type Order } from '@/api/modules/orders'
import ErrorState from '@/components/ui/state/ErrorState.vue'
import { useToast } from '@/composables/useToast'
import { normalizeForSearch } from '@/utils/search'
import StatusBadge from '@/components/ui/badge/StatusBadge.vue'
import ConfirmDialog from '@/components/ui/dialog/ConfirmDialog.vue'
import { useCartStore } from '@/stores/cart'

const isLoadingRef = ref<boolean>(true)
const route = useRoute()
const orders = ref<Order[]>([])
const errorRef = ref<string>('')
const { toast } = useToast()
const router = useRouter()
const cartStore = useCartStore()
const searchQuery = ref('')
const statusFilter = ref<'all' | 'In Transit' | 'Delivered' | 'Cancelled'>('all')
const detailsDialogVisible = ref(false)
const trackingDialogVisible = ref(false)
const cancelDialogVisible = ref(false)
const activeOrder = ref<Order | null>(null)
const cancelTargetOrder = ref<Order | null>(null)

async function fetchOrders() {
  try {
    isLoadingRef.value = true
    errorRef.value = ''
    orders.value = await getOrders()
  } catch (e: any) {
    errorRef.value = e?.message || 'Failed to load orders'
  } finally {
    isLoadingRef.value = false
  }
}

onMounted(fetchOrders)

watch(
  () => route.query.q,
  (q) => {
    searchQuery.value = typeof q === 'string' ? q : ''
  },
  { immediate: true }
)

// Status color is centralized in StatusBadge

const filteredOrders = computed(() => {
  const keyword = normalizeForSearch(searchQuery.value)
  return orders.value.filter((order) => {
    const hitStatus = statusFilter.value === 'all' || order.status === statusFilter.value
    if (!keyword) return hitStatus
    const itemText = normalizeForSearch(order.items.map((i) => i.name).join(' '))
    const hitKeyword =
      normalizeForSearch(order.id).includes(keyword) ||
      normalizeForSearch(order.date).includes(keyword) ||
      normalizeForSearch(order.status).includes(keyword) ||
      itemText.includes(keyword)
    return hitStatus && hitKeyword
  })
})

const ordersPage = ref(1)
const ordersPageSize = ref(10)

const pagedOrders = computed(() => {
  const list = filteredOrders.value
  const start = (ordersPage.value - 1) * ordersPageSize.value
  return list.slice(start, start + ordersPageSize.value)
})

const filteredOrdersTotal = computed(() => filteredOrders.value.length)

watch([searchQuery, statusFilter], () => {
  ordersPage.value = 1
})

watch([filteredOrdersTotal, ordersPageSize], () => {
  const maxPage = Math.max(1, Math.ceil(filteredOrdersTotal.value / ordersPageSize.value) || 1)
  if (ordersPage.value > maxPage) ordersPage.value = maxPage
})

function handleStatusCommand(cmd: string) {
  if (cmd === 'all' || cmd === 'In Transit' || cmd === 'Delivered' || cmd === 'Cancelled') {
    statusFilter.value = cmd
  }
}

function requestCancelOrder(order: Order) {
  if (!canCancelOrder(order)) {
    toast({ title: 'Cannot cancel', description: 'This order can no longer be cancelled.', variant: 'warning' })
    return
  }
  cancelTargetOrder.value = order
  cancelDialogVisible.value = true
}

function confirmCancelOrder() {
  const pending = cancelTargetOrder.value
  if (!pending) return
  const id = pending.id
  const target = orders.value.find(o => o.id === id)
  if (!target || target.status === 'Delivered' || target.status === 'Cancelled') {
    toast({ title: 'Cannot cancel', description: 'This order can no longer be cancelled.', variant: 'warning' })
    cancelDialogVisible.value = false
    cancelTargetOrder.value = null
    return
  }
  target.status = 'Cancelled'
  persistUserCheckoutOrderStatus(id, 'Cancelled')
  cancelDialogVisible.value = false
  cancelTargetOrder.value = null
  toast({ title: 'Order cancelled', description: `Order ${id} has been cancelled.`, variant: 'success' })
}

function closeCancelDialog() {
  cancelDialogVisible.value = false
  cancelTargetOrder.value = null
}

function canCancelOrder(order: Order) {
  return order.status !== 'Delivered' && order.status !== 'Cancelled'
}

function getCancelButtonLabel(order: Order) {
  if (order.status === 'Cancelled') return 'Cancelled'
  if (order.status === 'Delivered') return 'Completed'
  return 'Cancel'
}

function openOrderDetails(order: Order) {
  activeOrder.value = order
  detailsDialogVisible.value = true
}

function openTracking(order: Order) {
  activeOrder.value = order
  trackingDialogVisible.value = true
}

function buildTrackingSteps(order: Order) {
  const base = [
    { label: 'Order Placed', desc: `${order.date} - Payment confirmed.` },
    { label: 'Packed', desc: 'Warehouse prepared your package.' }
  ]
  if (order.status === 'Cancelled') {
    return [...base, { label: 'Cancelled', desc: 'This order was cancelled.' }]
  }
  if (order.status === 'In Transit') {
    return [...base, { label: 'In Transit', desc: 'Carrier picked up and is transporting.' }]
  }
  return [
    ...base,
    { label: 'In Transit', desc: 'Package left the sorting center.' },
    { label: 'Delivered', desc: 'Package delivered successfully.' }
  ]
}

function downloadInvoice(order: Order) {
  const lines = [
    `Invoice for ${order.id}`,
    `Date: ${order.date}`,
    `Status: ${order.status}`,
    '',
    'Items:'
  ]
  order.items.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.name} x${item.quantity} - $${item.price.toFixed(2)}`)
  })
  lines.push('', `Total: $${order.total.toFixed(2)}`)
  const content = lines.join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${order.id}-invoice.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast({ title: 'Invoice downloaded', description: `${order.id} invoice has been downloaded.`, variant: 'success' })
}

function formatPrice(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function paymentLabel(order: Order) {
  if (order.payment.method === 'apple_pay') return 'Apple Pay'
  if (order.payment.method === 'paypal') return 'PayPal'
  return `${order.payment.cardBrand || 'Card'} •••• ${order.payment.cardLast4 || '****'}`
}

function copyTrackingNumber(num: string) {
  navigator.clipboard.writeText(num)
  toast({ title: 'Copied', description: 'Tracking number copied to clipboard.', variant: 'success' })
}

function buyAgain(order: Order) {
  for (const item of order.items) {
    cartStore.addItem(
      { id: item.productId || 0, title: item.name, price: item.price, image: item.image },
      { color: item.color || 'Default', size: item.size || 'One Size', quantity: item.quantity }
    )
  }
  toast({ title: 'Added to cart', description: `${order.items.length} item(s) added to your cart.`, variant: 'success' })
  router.push('/cart')
}

function contactSupport() {
  router.push('/dashboard/messages')
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">My Orders</h1>
      
      <div class="flex gap-2">
        <div class="relative">
          <Search class="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Search orders..." 
            class="h-9 w-full sm:w-64 rounded-lg bg-secondary pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <el-dropdown trigger="click" @command="handleStatusCommand">
          <Button variant="outline" size="icon" class="h-9 w-9">
            <Filter class="h-4 w-4" />
          </Button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="all" :class="{ 'text-primary bg-primary/10': statusFilter === 'all' }">All status</el-dropdown-item>
              <el-dropdown-item command="In Transit" :class="{ 'text-primary bg-primary/10': statusFilter === 'In Transit' }">In Transit</el-dropdown-item>
              <el-dropdown-item command="Delivered" :class="{ 'text-primary bg-primary/10': statusFilter === 'Delivered' }">Delivered</el-dropdown-item>
              <el-dropdown-item command="Cancelled" :class="{ 'text-primary bg-primary/10': statusFilter === 'Cancelled' }">Cancelled</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div v-if="isLoadingRef" class="space-y-4">
      <div v-for="i in 3" :key="i" class="border border-border rounded-xl p-4 sm:p-6 bg-card">
        <div class="flex flex-col sm:flex-row justify-between mb-6 gap-4">
          <div class="space-y-2">
            <Skeleton class="h-5 w-28 rounded-md" />
            <Skeleton class="h-3 w-44 rounded-md" />
          </div>
          <div class="flex gap-2">
            <Skeleton class="h-8 w-24 rounded-lg" />
            <Skeleton class="h-8 w-24 rounded-lg" />
          </div>
        </div>
        <div class="flex items-center gap-4">
          <div class="flex -space-x-3">
            <Skeleton class="w-12 h-12 rounded-lg" />
            <Skeleton class="w-12 h-12 rounded-lg" />
          </div>
          <div class="flex-1">
            <Skeleton class="h-4 w-2/3 rounded-md" />
          </div>
          <Skeleton class="h-8 w-28 rounded-lg" />
        </div>
      </div>
    </div>
    <ErrorState v-if="!isLoadingRef && errorRef" :message="errorRef" @retry="fetchOrders" />
    <div v-else class="space-y-4">
      <div
        v-for="order in pagedOrders"
        :key="order.id"
        role="button"
        tabindex="0"
        class="border border-border rounded-xl bg-card transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 cursor-pointer"
        @click="openOrderDetails(order)"
        @keydown.enter.prevent="openOrderDetails(order)"
        @keydown.space.prevent="openOrderDetails(order)"
      >
        <div class="p-4 sm:p-6">
          <div class="flex flex-col sm:flex-row justify-between mb-6 gap-4">
            <div class="space-y-1">
              <div class="flex items-center gap-3">
                <span class="font-bold text-lg">{{ order.id }}</span>
                <StatusBadge :status="order.status" size="md" />
              </div>
              <div class="text-sm text-muted-foreground flex items-center gap-2">
                <span>{{ order.date }}</span>
                <span>•</span>
                <span>Total: ${{ order.total.toFixed(2) }}</span>
              </div>
            </div>

            <div class="flex gap-2" @click.stop>
              <Button variant="outline" size="sm" @click="openTracking(order)">Track Order</Button>
              <Button variant="outline" size="sm" @click="downloadInvoice(order)">Invoice</Button>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div class="flex -space-x-3 overflow-hidden">
              <div
                v-for="(item, idx) in order.items"
                :key="idx"
                class="w-12 h-12 rounded-lg border-2 border-card bg-secondary overflow-hidden"
              >
                <img :src="item.image" :alt="item.name" class="w-full h-full object-cover" />
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">
                {{ order.items.map((i) => i.name).join(', ') }}
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{ order.items.length }} item{{ order.items.length > 1 ? 's' : '' }}
              </p>
            </div>
            <div class="flex items-center gap-2" @click.stop>
              <Button
                variant="outline"
                size="sm"
                class="border-red-200 disabled:opacity-60"
                :class="
                  canCancelOrder(order)
                    ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10'
                    : 'text-muted-foreground cursor-not-allowed'
                "
                :disabled="!canCancelOrder(order)"
                @click="requestCancelOrder(order)"
              >
                {{ getCancelButtonLabel(order) }}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="filteredOrders.length === 0"
        class="border border-border rounded-xl p-8 bg-card text-center text-muted-foreground text-sm"
      >
        No matching orders found.
      </div>
      <div
        v-if="filteredOrders.length > ordersPageSize"
        class="flex flex-wrap items-center justify-center gap-2 pt-2 sm:justify-end"
      >
        <el-pagination
          v-model:current-page="ordersPage"
          v-model:page-size="ordersPageSize"
          :page-sizes="[5, 10, 20, 50]"
          :total="filteredOrders.length"
          layout="total, sizes, prev, pager, next"
        />
      </div>
    </div>

    <el-drawer
      v-model="detailsDialogVisible"
      :title="activeOrder ? `Order ${activeOrder.id}` : 'Order Details'"
      size="480px"
      direction="rtl"
    >
      <template v-if="activeOrder">
        <div class="space-y-6 pb-4">
          <!-- Status & Date -->
          <div class="flex items-center justify-between">
            <StatusBadge :status="activeOrder.status" size="md" />
            <span class="text-xs text-muted-foreground">{{ activeOrder.date }}</span>
          </div>

          <!-- Tracking Info -->
          <div v-if="activeOrder.trackingNumber && activeOrder.status !== 'Cancelled'" class="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
            <div class="flex items-center gap-2 text-sm font-bold">
              <Truck class="w-4 h-4 text-primary" />
              <span>Shipping Status</span>
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-muted-foreground">Tracking Number</p>
                <div class="flex items-center gap-1.5">
                  <span class="text-sm font-mono font-bold">{{ activeOrder.trackingNumber }}</span>
                  <button @click="copyTrackingNumber(activeOrder.trackingNumber!)" class="text-muted-foreground hover:text-primary transition-colors">
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div v-if="activeOrder.estimatedDelivery" class="text-right">
                <p class="text-xs text-muted-foreground">Est. Delivery</p>
                <p class="text-sm font-bold">{{ activeOrder.estimatedDelivery }}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" class="w-full text-xs mt-1 gap-1.5" @click="openTracking(activeOrder)">
              <Truck class="w-3.5 h-3.5" />
              View Full Tracking
            </Button>
          </div>

          <!-- Items -->
          <div class="space-y-2">
            <h3 class="text-sm font-bold flex items-center gap-2">
              <ShoppingBag class="w-4 h-4" />
              Items ({{ activeOrder.items.length }})
            </h3>
            <div
              v-for="(item, idx) in activeOrder.items"
              :key="`${activeOrder.id}-detail-${idx}`"
              class="flex gap-3 border border-border rounded-xl p-3 hover:bg-secondary/30 transition-colors"
            >
              <router-link v-if="item.productId" :to="`/product/${item.productId}`" class="flex-shrink-0">
                <img :src="item.image" :alt="item.name" class="w-16 h-16 rounded-lg object-cover bg-secondary" />
              </router-link>
              <img v-else :src="item.image" :alt="item.name" class="w-16 h-16 rounded-lg object-cover bg-secondary flex-shrink-0" />
              <div class="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <router-link v-if="item.productId" :to="`/product/${item.productId}`" class="hover:text-primary transition-colors">
                    <p class="font-bold text-sm truncate">{{ item.name }}</p>
                  </router-link>
                  <p v-else class="font-bold text-sm truncate">{{ item.name }}</p>
                  <div class="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span v-if="item.color">{{ item.color }}</span>
                    <span v-if="item.color && item.size">·</span>
                    <span v-if="item.size">{{ item.size }}</span>
                  </div>
                </div>
                <div class="flex items-center justify-between mt-1">
                  <div class="text-xs text-muted-foreground">
                    ${{ formatPrice(item.price) }} × {{ item.quantity }}
                  </div>
                  <span class="text-sm font-bold">${{ formatPrice(item.price * item.quantity) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Price Breakdown -->
          <div class="rounded-xl border border-border bg-card p-4 space-y-2.5">
            <h3 class="text-sm font-bold mb-3">Price Summary</h3>
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Subtotal</span>
              <span>${{ formatPrice(activeOrder.subtotal) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Shipping</span>
              <span :class="activeOrder.shippingFee === 0 ? 'text-emerald-500 font-medium' : ''">
                {{ activeOrder.shippingFee === 0 ? 'Free' : `$${formatPrice(activeOrder.shippingFee)}` }}
              </span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Tax</span>
              <span>${{ formatPrice(activeOrder.tax) }}</span>
            </div>
            <div v-if="activeOrder.discount > 0" class="flex justify-between text-sm">
              <span class="text-muted-foreground">Discount</span>
              <span class="text-emerald-500 font-medium">-${{ formatPrice(activeOrder.discount) }}</span>
            </div>
            <div class="border-t border-border pt-2.5 flex justify-between items-center">
              <span class="font-bold">Total</span>
              <span class="font-black text-lg text-primary">${{ formatPrice(activeOrder.total) }}</span>
            </div>
          </div>

          <!-- Shipping Address -->
          <div class="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 class="text-sm font-bold flex items-center gap-2">
              <MapPin class="w-4 h-4" />
              Shipping Address
            </h3>
            <div class="text-sm space-y-0.5">
              <p class="font-medium">{{ activeOrder.shipping.name }}</p>
              <p class="text-muted-foreground">{{ activeOrder.shipping.phone }}</p>
              <p class="text-muted-foreground">{{ activeOrder.shipping.address }}</p>
              <p class="text-muted-foreground">{{ activeOrder.shipping.city }}, {{ activeOrder.shipping.zip }}</p>
              <p class="text-muted-foreground">{{ activeOrder.shipping.country }}</p>
            </div>
          </div>

          <!-- Payment Info -->
          <div class="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 class="text-sm font-bold flex items-center gap-2">
              <CreditCard class="w-4 h-4" />
              Payment
            </h3>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">Method</span>
              <span class="font-medium">{{ paymentLabel(activeOrder) }}</span>
            </div>
            <div v-if="activeOrder.payment.paidAt" class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">Paid at</span>
              <span>{{ activeOrder.payment.paidAt }}</span>
            </div>
          </div>

          <!-- Order Note -->
          <div v-if="activeOrder.note" class="rounded-xl border border-border bg-card p-4 space-y-1">
            <h3 class="text-sm font-bold">Order Note</h3>
            <p class="text-sm text-muted-foreground">{{ activeOrder.note }}</p>
          </div>

          <!-- Actions -->
          <div class="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" size="sm" class="gap-1.5 text-xs" @click="downloadInvoice(activeOrder)">
              <FileText class="w-3.5 h-3.5" />
              Download Invoice
            </Button>
            <Button variant="outline" size="sm" class="gap-1.5 text-xs" @click="contactSupport">
              <MessageSquare class="w-3.5 h-3.5" />
              Contact Support
            </Button>
            <Button
              v-if="activeOrder.status === 'Delivered'"
              size="sm"
              class="col-span-2 gap-1.5 text-xs"
              @click="buyAgain(activeOrder)"
            >
              <RotateCcw class="w-3.5 h-3.5" />
              Buy Again
            </Button>
            <Button
              v-if="canCancelOrder(activeOrder)"
              variant="outline"
              size="sm"
              class="col-span-2 gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-500/10"
              @click="detailsDialogVisible = false; requestCancelOrder(activeOrder)"
            >
              Cancel Order
            </Button>
          </div>
        </div>
      </template>
    </el-drawer>

    <el-dialog
      v-model="trackingDialogVisible"
      width="620px"
      :title="activeOrder ? `Tracking - ${activeOrder.id}` : 'Tracking'"
    >
      <template v-if="activeOrder">
        <el-timeline>
          <el-timeline-item
            v-for="(step, idx) in buildTrackingSteps(activeOrder)"
            :key="`${activeOrder.id}-tracking-${idx}`"
            :timestamp="step.label"
            placement="top"
          >
            {{ step.desc }}
          </el-timeline-item>
        </el-timeline>
      </template>
    </el-dialog>

    <ConfirmDialog
      v-model="cancelDialogVisible"
      title="Cancel Order"
      description="This action cannot be undone."
      confirm-text="Confirm Cancel"
      cancel-text="Keep Order"
      :danger="true"
      @cancel="closeCancelDialog"
      @confirm="confirmCancelOrder"
    >
      <template #icon>
        <Package class="w-4 h-4" />
      </template>

      <p>
        Are you sure you want to cancel
        <span class="font-semibold">{{ cancelTargetOrder?.id }}</span>?
      </p>
      <div class="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
        After cancellation, this order will be marked as <span class="font-medium">Cancelled</span>.
      </div>
    </ConfirmDialog>
  </div>
</template>

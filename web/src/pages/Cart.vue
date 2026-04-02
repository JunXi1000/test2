<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { Trash2, Minus, Plus, ArrowRight, ShoppingBag, Edit2, XCircle, Tag } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import ConfirmDialog from '@/components/ui/dialog/ConfirmDialog.vue'
import { useCartStore, type CartItem } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { getProductById } from '@/api/modules/product'
import { applyPromoCode } from '@/api/modules/checkout'
import type { Product } from '@/types/product'
import { useToast } from '@/composables/useToast'
import { useRouter } from 'vue-router'

const MAX_QUANTITY = 99
const FREE_SHIPPING_THRESHOLD = 200
const SHIPPING_FEE = 12
const TAX_RATE = 0.08

const cartStore = useCartStore()
const authStore = useAuthStore()
const { toast } = useToast()
const router = useRouter()

const subtotal = computed(() => cartStore.subtotal)
const shipping = computed(() => subtotal.value >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE)
const freeShippingRemaining = computed(() => {
  const remaining = FREE_SHIPPING_THRESHOLD - subtotal.value
  return remaining > 0 ? remaining : 0
})
const tax = computed(() => +(subtotal.value * TAX_RATE).toFixed(2))
const discount = ref(0)
const promoCode = ref('')
const promoApplied = ref(false)
const total = computed(() => +(subtotal.value + shipping.value + tax.value - discount.value).toFixed(2))

const isLoadingRef = ref<boolean>(true)
const editDialogVisible = ref(false)
const isEditing = ref(false)
const currentEditItem = ref<CartItem | null>(null)
const editProductDetails = ref<Product | null>(null)
const editForm = reactive({
  color: '',
  size: '',
  image: ''
})

const removeConfirmVisible = ref(false)
const pendingRemoveItem = ref<CartItem | null>(null)
const clearConfirmVisible = ref(false)

onMounted(() => {
  setTimeout(() => {
    isLoadingRef.value = false
  }, 300)
})

function incrementQuantity(item: CartItem) {
  if (item.quantity >= MAX_QUANTITY) {
    toast({ title: 'Quantity limit', description: `Maximum ${MAX_QUANTITY} items per product.`, variant: 'destructive' })
    return
  }
  cartStore.updateQuantity(item.cartItemId, 1)
}

function decrementQuantity(item: CartItem) {
  if (item.quantity <= 1) {
    confirmRemove(item)
    return
  }
  cartStore.updateQuantity(item.cartItemId, -1)
}

function confirmRemove(item: CartItem) {
  pendingRemoveItem.value = item
  removeConfirmVisible.value = true
}

function executeRemove() {
  if (!pendingRemoveItem.value) return
  const title = pendingRemoveItem.value.title
  cartStore.removeItem(pendingRemoveItem.value.cartItemId)
  removeConfirmVisible.value = false
  pendingRemoveItem.value = null
  toast({ title: 'Item removed', description: `${title} has been removed from your cart.` })
}

function confirmClearCart() {
  clearConfirmVisible.value = true
}

function executeClearCart() {
  cartStore.clearCart()
  clearConfirmVisible.value = false
  discount.value = 0
  promoApplied.value = false
  promoCode.value = ''
  toast({ title: 'Cart cleared', description: 'All items have been removed.' })
}

async function handleApplyPromo() {
  const code = promoCode.value.trim()
  if (!code) {
    toast({ title: 'Enter a code', description: 'Please type a promo code first.', variant: 'destructive' })
    return
  }
  if (promoApplied.value) {
    toast({ title: 'Already applied', description: 'A promo code is already in effect. Remove it first.', variant: 'destructive' })
    return
  }
  try {
    const result = await applyPromoCode(code, subtotal.value)
    if (result.discount <= 0) {
      toast({ title: 'Invalid code', description: 'This promo code is not valid or has expired.', variant: 'destructive' })
      return
    }
    discount.value = result.discount
    promoApplied.value = true
    toast({ title: 'Promo applied!', description: `You saved $${result.discount.toFixed(2)}`, variant: 'success' })
  } catch (e: any) {
    toast({ title: 'Invalid code', description: e?.message || 'Please try another code.', variant: 'destructive' })
  }
}

function removePromo() {
  discount.value = 0
  promoApplied.value = false
  promoCode.value = ''
  toast({ title: 'Promo removed', description: 'Discount has been removed.' })
}

function handleCheckout() {
  if (!authStore.isAuthenticated) {
    toast({ title: 'Login required', description: 'Please sign in to proceed to checkout.', variant: 'destructive' })
    router.push({ name: 'Login', query: { redirect: '/checkout' } })
    return
  }
  router.push('/checkout')
}

function formatPrice(price: number) {
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function openEditDialog(item: CartItem) {
  currentEditItem.value = item
  editDialogVisible.value = true
  isEditing.value = true
  editProductDetails.value = null
  
  editForm.color = item.color
  editForm.size = item.size
  editForm.image = item.image

  try {
    const product = await getProductById(item.id)
    editProductDetails.value = product
  } catch (e) {
    toast({ title: 'Error', description: 'Failed to load product options', variant: 'destructive' })
    editDialogVisible.value = false
  } finally {
    isEditing.value = false
  }
}

function saveEdit() {
  if (!currentEditItem.value) return
  
  if (editProductDetails.value?.colors?.length && !editForm.color) {
    toast({ title: 'Selection required', description: 'Please select a color.', variant: 'destructive' })
    return
  }
  if (editProductDetails.value?.sizes?.length && !editForm.size) {
    toast({ title: 'Selection required', description: 'Please select a size.', variant: 'destructive' })
    return
  }
  
  cartStore.updateItemOptions(currentEditItem.value.cartItemId, {
    color: editForm.color,
    size: editForm.size,
    image: editForm.image
  })
  
  toast({ title: 'Cart updated', description: 'Item options have been changed.', variant: 'success' })
  editDialogVisible.value = false
}

function selectColor(color: string) {
  editForm.color = color
  if (editProductDetails.value?.variantImages && editProductDetails.value.variantImages[color]) {
    editForm.image = editProductDetails.value.variantImages[color]
  }
}
</script>

<template>
  <div class="min-h-screen bg-background pb-20 pt-10">
    <div class="container px-4 max-w-6xl mx-auto">
      <h1 class="text-3xl font-bold tracking-tight mb-8 text-center lg:text-left">Shopping Cart</h1>

      <div v-if="isLoadingRef" class="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div class="lg:col-span-8 space-y-6">
          <div v-for="i in 3" :key="i" class="p-4 rounded-xl border border-border bg-card/50">
            <div class="flex gap-4">
              <Skeleton class="w-24 h-24 rounded-lg" />
              <div class="flex-1 space-y-3">
                <Skeleton class="h-5 w-1/2 rounded-md" />
                <Skeleton class="h-4 w-1/3 rounded-md" />
                <Skeleton class="h-9 w-28 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
        <div class="lg:col-span-4">
          <div class="sticky top-24 rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
            <Skeleton class="h-6 w-1/2 rounded-md" />
            <Skeleton class="h-4 w-full rounded-md" />
            <Skeleton class="h-4 w-3/4 rounded-md" />
            <Skeleton class="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>

      <div v-else-if="cartStore.items.length > 0" class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <!-- Cart Items List -->
        <div class="lg:col-span-8 space-y-4">
          <!-- Cart header bar -->
          <div class="flex justify-between items-center">
            <p class="text-sm text-muted-foreground">{{ cartStore.totalItems }} item{{ cartStore.totalItems > 1 ? 's' : '' }} in your cart</p>
            <button
              @click="confirmClearCart"
              class="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-destructive/10"
            >
              <XCircle class="w-3.5 h-3.5" />
              Clear All
            </button>
          </div>

          <!-- Free shipping progress -->
          <div v-if="freeShippingRemaining > 0" class="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center gap-3">
            <Tag class="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p class="text-sm text-emerald-700 dark:text-emerald-400">
              Add <span class="font-bold">${{ formatPrice(freeShippingRemaining) }}</span> more for <span class="font-bold">free shipping</span>!
            </p>
          </div>
          <div v-else class="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center gap-3">
            <Tag class="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p class="text-sm text-emerald-700 dark:text-emerald-400 font-medium">You've qualified for free shipping!</p>
          </div>

          <div 
            v-for="item in cartStore.items" 
            :key="item.cartItemId || item.id"
            class="flex gap-4 sm:gap-6 p-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm transition-all hover:border-primary/30"
          >
            <!-- Image -->
            <router-link :to="`/product/${item.id}`" class="w-24 h-24 sm:w-32 sm:h-32 rounded-lg overflow-hidden bg-secondary flex-shrink-0 border border-border block hover:opacity-80 transition-opacity">
              <img 
                :src="item.image || '/placeholder-image.jpg'" 
                :alt="item.title" 
                class="w-full h-full object-cover" 
                loading="lazy" 
                @error="($event.target as HTMLImageElement).src = '/placeholder-image.jpg'"
              />
            </router-link>

            <!-- Content -->
            <div class="flex-1 flex flex-col justify-between">
              <div class="flex justify-between items-start gap-4">
                <div>
                  <router-link :to="`/product/${item.id}`" class="hover:underline hover:text-primary transition-colors">
                    <h3 class="font-bold text-lg leading-tight mb-1 text-foreground">{{ item.title || 'Untitled Product' }}</h3>
                  </router-link>
                  <p class="text-sm text-muted-foreground">{{ item.color || 'Default' }} / {{ item.size || 'Standard' }}</p>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="font-bold text-lg text-primary">${{ formatPrice(item.price * item.quantity) }}</p>
                  <p v-if="item.quantity > 1" class="text-xs text-muted-foreground">${{ formatPrice(item.price) }} each</p>
                </div>
              </div>

              <div class="flex items-center gap-2 mt-2">
                <button 
                  class="text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                  @click="openEditDialog(item)"
                >
                  <Edit2 class="w-3 h-3" />
                  Edit Options
                </button>
              </div>

              <div class="flex justify-between items-end mt-4">
                <!-- Quantity Control -->
                <div class="flex items-center border border-input rounded-lg h-9 w-28 bg-background">
                  <button @click="decrementQuantity(item)" class="w-9 h-full flex items-center justify-center hover:bg-secondary rounded-l-lg transition-colors text-muted-foreground hover:text-foreground">
                    <Minus class="w-3.5 h-3.5" />
                  </button>
                  <div class="flex-1 text-center text-sm font-medium">{{ item.quantity }}</div>
                  <button
                    @click="incrementQuantity(item)"
                    :disabled="item.quantity >= MAX_QUANTITY"
                    class="w-9 h-full flex items-center justify-center hover:bg-secondary rounded-r-lg transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus class="w-3.5 h-3.5" />
                  </button>
                </div>

                <!-- Remove -->
                <button 
                  @click="confirmRemove(item)"
                  class="text-sm text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-destructive/10"
                >
                  <Trash2 class="w-4 h-4" />
                  <span class="hidden sm:inline">Remove</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Continue Shopping link -->
          <div class="text-center pt-2">
            <router-link to="/" class="text-sm text-primary hover:underline transition-colors">
              &larr; Continue Shopping
            </router-link>
          </div>
        </div>

        <!-- Order Summary -->
        <div class="lg:col-span-4">
          <div class="sticky top-24 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 class="text-lg font-bold mb-6">Order Summary</h2>
            
            <div class="space-y-4 mb-6">
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">Subtotal ({{ cartStore.totalItems }} items)</span>
                <span class="font-medium">${{ formatPrice(subtotal) }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">Shipping</span>
                <span :class="shipping === 0 ? 'font-medium text-emerald-500' : 'font-medium'">
                  {{ shipping === 0 ? 'Free' : `$${formatPrice(shipping)}` }}
                </span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">Tax (8%)</span>
                <span class="font-medium">${{ formatPrice(tax) }}</span>
              </div>
              <div v-if="discount > 0" class="flex justify-between text-sm">
                <span class="text-muted-foreground">Discount</span>
                <span class="font-medium text-emerald-500">- ${{ formatPrice(discount) }}</span>
              </div>
              <div class="border-t border-border pt-4 flex justify-between items-center">
                <span class="font-bold text-lg">Total</span>
                <span class="font-bold text-2xl text-primary">${{ formatPrice(total) }}</span>
              </div>
            </div>

            <!-- Coupon Code -->
            <div v-if="!promoApplied" class="flex gap-2 mb-6">
              <input 
                v-model="promoCode"
                type="text" 
                placeholder="Promo code" 
                class="flex-1 h-10 rounded-lg bg-secondary border border-transparent px-3 text-sm outline-none focus:border-primary transition-colors uppercase"
                @keyup.enter="handleApplyPromo"
              />
              <Button variant="outline" class="h-10" @click="handleApplyPromo">Apply</Button>
            </div>
            <div v-else class="mb-6 flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
              <div class="flex items-center gap-2">
                <Tag class="w-4 h-4 text-emerald-600" />
                <span class="text-sm font-medium text-emerald-700 dark:text-emerald-400">{{ promoCode.toUpperCase() }}</span>
                <span class="text-xs text-emerald-600">(-${{ formatPrice(discount) }})</span>
              </div>
              <button @click="removePromo" class="text-xs text-muted-foreground hover:text-destructive transition-colors">Remove</button>
            </div>

            <Button class="w-full h-12 text-base font-bold shadow-lg shadow-primary/20" @click="handleCheckout">
              Checkout <ArrowRight class="ml-2 w-4 h-4" />
            </Button>
            
            <p class="text-xs text-center text-muted-foreground mt-4 flex items-center justify-center gap-2">
              <ShoppingBag class="w-3 h-3" />
              Secure Checkout
            </p>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-20 bg-card rounded-2xl border border-border max-w-3xl mx-auto">
        <div class="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingBag class="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 class="text-2xl font-bold mb-2">Your cart is empty</h2>
        <p class="text-muted-foreground mb-8">Looks like you haven't added anything to your cart yet.</p>
        <Button size="lg" @click="$router.push('/')">
          Start Shopping
        </Button>
      </div>
    </div>

    <!-- Remove Item Confirmation -->
    <ConfirmDialog
      v-model="removeConfirmVisible"
      title="Remove Item"
      :description="pendingRemoveItem?.title || ''"
      confirm-text="Remove"
      danger
      @confirm="executeRemove"
    >
      <template #icon><Trash2 class="w-5 h-5" /></template>
      <p>Are you sure you want to remove <strong>{{ pendingRemoveItem?.title }}</strong> from your cart?</p>
    </ConfirmDialog>

    <!-- Clear Cart Confirmation -->
    <ConfirmDialog
      v-model="clearConfirmVisible"
      title="Clear Cart"
      description="This action cannot be undone"
      confirm-text="Clear All"
      danger
      @confirm="executeClearCart"
    >
      <template #icon><XCircle class="w-5 h-5" /></template>
      <p>Are you sure you want to remove all <strong>{{ cartStore.totalItems }}</strong> items from your cart?</p>
    </ConfirmDialog>

    <!-- Edit Options Dialog -->
    <el-dialog
      v-model="editDialogVisible"
      title="Edit Options"
      width="400px"
      append-to-body
      destroy-on-close
    >
      <div v-if="isEditing" class="py-8 space-y-4">
        <Skeleton class="h-4 w-24 rounded-md" />
        <Skeleton class="h-10 w-full rounded-lg" />
        <Skeleton class="h-4 w-24 rounded-md" />
        <Skeleton class="h-10 w-full rounded-lg" />
      </div>
      <div v-else-if="editProductDetails" class="space-y-6">
        <div class="flex gap-4">
          <div class="w-20 h-20 rounded-lg overflow-hidden border border-border">
            <img :src="editForm.image || editProductDetails.image" class="w-full h-full object-cover transition-opacity duration-300" />
          </div>
          <div>
            <h3 class="font-bold">{{ editProductDetails.title }}</h3>
            <p class="text-primary font-bold mt-1">${{ editProductDetails.price }}</p>
          </div>
        </div>

        <div class="space-y-4">
          <div v-if="editProductDetails.colors?.length">
            <label class="text-sm font-medium mb-2 block">Color</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in editProductDetails.colors"
                :key="color.name"
                @click="selectColor(color.name)"
                class="px-3 py-1.5 rounded-lg text-sm border transition-all"
                :class="editForm.color === color.name ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:border-primary/50'"
              >
                {{ color.name }}
              </button>
            </div>
          </div>

          <div v-if="editProductDetails.sizes?.length">
            <label class="text-sm font-medium mb-2 block">Size</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="size in editProductDetails.sizes"
                :key="size"
                @click="editForm.size = size"
                class="px-3 py-1.5 rounded-lg text-sm border transition-all"
                :class="editForm.size === size ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:border-primary/50'"
              >
                {{ size }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer flex gap-2 justify-end">
          <Button variant="outline" @click="editDialogVisible = false">Cancel</Button>
          <Button @click="saveEdit" :disabled="isEditing">Save Changes</Button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

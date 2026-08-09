<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import { useCouponStore } from '@/stores/coupons'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import Button from '@/components/ui/button/Button.vue'
import { CheckCircle2, CreditCard, Truck, ShieldCheck, Lock, MapPin, Tag, ChevronLeft, Mail } from 'lucide-vue-next'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import ErrorState from '@/components/ui/state/ErrorState.vue'
import { calculateOrderSummary, applyPromoCode, type OrderSummary } from '@/api/modules/checkout'
import { createPaymentIntent, confirmPayment } from '@/api/modules/payment'
import { appendCheckoutOrder, type Order, type OrderItem } from '@/api/modules/orders'
import { USE_MOCK } from '@/config/env'
import { getAddresses, type Address } from '@/api/modules/address'
import { getProfile } from '@/api/modules/account'

const router = useRouter()
const route = useRoute()
const cartStore = useCartStore()
const couponStore = useCouponStore()
const authStore = useAuthStore()
const { toast } = useToast()

// ── Empty cart guard ──
const checkoutItems = computed(() => {
  if (route.query.mode === 'direct' && cartStore.directBuyItem) {
    return [cartStore.directBuyItem]
  }
  return cartStore.items
})

onMounted(() => {
  if (checkoutItems.value.length === 0) {
    toast({ title: 'Cart is empty', description: 'Add items before checking out.', variant: 'destructive' })
    router.replace('/cart')
  }
  couponStore.load()
})

watch(checkoutItems, (items) => {
  if (items.length === 0 && !isProcessing.value) {
    router.replace('/cart')
  }
})

// ── Steps ──
const steps = ['Shipping', 'Payment', 'Review']
const currentStep = ref(0)
const isProcessing = ref(false)

// ── Form data ──
const formData = reactive({
  email: '',
  firstName: '',
  lastName: '',
  address: '',
  city: '',
  country: 'United States',
  zip: '',
  cardNumber: '',
  expiry: '',
  cvc: ''
})

// ── Inline validation errors ──
const fieldErrors = reactive<Record<string, string>>({})
const fieldTouched = reactive<Record<string, boolean>>({})

function markTouched(field: string) {
  fieldTouched[field] = true
  validateField(field)
}

function validateField(field: string) {
  delete fieldErrors[field]
  const v = (formData as any)[field]?.trim?.() ?? ''

  switch (field) {
    case 'email':
      if (!v) fieldErrors.email = 'Email is required'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fieldErrors.email = 'Enter a valid email address'
      break
    case 'firstName':
      if (!v) fieldErrors.firstName = 'First name is required'
      break
    case 'lastName':
      if (!v) fieldErrors.lastName = 'Last name is required'
      break
    case 'address':
      if (!v) fieldErrors.address = 'Address is required'
      break
    case 'city':
      if (!v) fieldErrors.city = 'City is required'
      break
    case 'zip':
      if (!v) fieldErrors.zip = 'ZIP code is required'
      else if (!/^[A-Za-z0-9\s\-]{3,10}$/.test(v)) fieldErrors.zip = 'Enter a valid ZIP code'
      break
    case 'cardNumber': {
      const digits = formData.cardNumber.replace(/\s/g, '')
      if (!digits) fieldErrors.cardNumber = 'Card number is required'
      else if (!/^\d{13,19}$/.test(digits)) fieldErrors.cardNumber = 'Enter a valid card number'
      break
    }
    case 'expiry': {
      if (!v) fieldErrors.expiry = 'Expiry date is required'
      else if (!/^\d{2}\/\d{2}$/.test(v)) fieldErrors.expiry = 'Use MM/YY format'
      else {
        const [mm, yy] = v.split('/').map(Number)
        if (mm < 1 || mm > 12) fieldErrors.expiry = 'Invalid month'
        else {
          const now = new Date()
          const expDate = new Date(2000 + yy, mm)
          if (expDate <= now) fieldErrors.expiry = 'Card has expired'
        }
      }
      break
    }
    case 'cvc':
      if (!v) fieldErrors.cvc = 'CVC is required'
      else if (!/^\d{3,4}$/.test(v)) fieldErrors.cvc = 'Enter 3 or 4 digits'
      break
  }
}

function validateShipping(): boolean {
  const fields = ['email', 'firstName', 'lastName', 'address', 'city', 'zip']
  fields.forEach(f => {
    fieldTouched[f] = true
    validateField(f)
  })
  return !fields.some(f => fieldErrors[f])
}

function validatePayment(): boolean {
  const fields = ['cardNumber', 'expiry', 'cvc']
  fields.forEach(f => {
    fieldTouched[f] = true
    validateField(f)
  })
  return !fields.some(f => fieldErrors[f])
}

// ── Card number formatting ──
function onCardNumberInput(e: Event) {
  const input = e.target as HTMLInputElement
  let raw = input.value.replace(/\D/g, '').slice(0, 16)
  const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ')
  formData.cardNumber = formatted
  nextTick(() => { input.value = formatted })
  if (fieldTouched.cardNumber) validateField('cardNumber')
}

function onExpiryInput(e: Event) {
  const input = e.target as HTMLInputElement
  let raw = input.value.replace(/\D/g, '').slice(0, 4)
  if (raw.length >= 3) raw = raw.slice(0, 2) + '/' + raw.slice(2)
  formData.expiry = raw
  nextTick(() => { input.value = raw })
  if (fieldTouched.expiry) validateField('expiry')
}

function onCvcInput(e: Event) {
  const input = e.target as HTMLInputElement
  const raw = input.value.replace(/\D/g, '').slice(0, 4)
  formData.cvc = raw
  nextTick(() => { input.value = raw })
  if (fieldTouched.cvc) validateField('cvc')
}

const cardBrand = computed(() => {
  const d = formData.cardNumber.replace(/\s/g, '')
  if (/^4/.test(d)) return 'Visa'
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return 'Mastercard'
  if (/^3[47]/.test(d)) return 'Amex'
  if (/^6(?:011|5)/.test(d)) return 'Discover'
  return ''
})

// ── Country list ──
const countries = [
  'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany',
  'France', 'Japan', 'South Korea', 'China', 'India',
  'Brazil', 'Mexico', 'Singapore', 'Netherlands', 'Sweden'
]

// ── Saved addresses ──
const savedAddresses = ref<Address[]>([])
const selectedAddressId = ref<number | null>(null)
const showAddressPicker = ref(false)

function pickAddress(addr: Address) {
  selectedAddressId.value = addr.id
  formData.address = addr.address
  formData.city = addr.city
  formData.country = addr.country
  formData.zip = addr.zip
  if (addr.name) {
    const parts = addr.name.split(' ')
    formData.firstName = parts[0] || ''
    formData.lastName = parts.slice(1).join(' ') || ''
  }
  showAddressPicker.value = false
  // Clear related errors
  ;['address', 'city', 'zip', 'firstName', 'lastName'].forEach(f => delete fieldErrors[f])
  toast({ title: 'Address selected', description: `${addr.type} address loaded.` })
}

// ── Order summary & promo ──
const summaryRef = ref<OrderSummary>({ subtotal: 0, shipping: 0, tax: 0, discount: 0, total: 0 })
const promoCodeRef = ref('')
const promoApplied = ref(false)
const total = computed(() => summaryRef.value.total)

const isLoadingRef = ref<boolean>(true)
const errorRef = ref<string>('')
const paymentErrorRef = ref<string>('')

async function fetchSummary() {
  try {
    isLoadingRef.value = true
    errorRef.value = ''
    const s = await calculateOrderSummary(checkoutItems.value, formData.zip)
    if (promoApplied.value && summaryRef.value.discount > 0) {
      s.discount = summaryRef.value.discount
      s.total = +(s.subtotal + s.shipping + s.tax - s.discount).toFixed(2)
    }
    summaryRef.value = s
  } catch (e: any) {
    errorRef.value = e?.message || 'Failed to calculate order summary'
    toast({ title: 'Calculation failed', description: errorRef.value, variant: 'destructive' })
  } finally {
    isLoadingRef.value = false
  }
}

async function onApplyPromo() {
  const code = promoCodeRef.value.trim()
  if (!code) {
    toast({ title: 'Enter a code', description: 'Please type a promo code first.', variant: 'destructive' })
    return
  }
  if (promoApplied.value) {
    toast({ title: 'Already applied', description: 'Remove the current promo before applying another.', variant: 'destructive' })
    return
  }
  try {
    const { discount } = await applyPromoCode(code, summaryRef.value.subtotal)
    if (discount <= 0) {
      toast({ title: 'Invalid code', description: 'This promo code is not valid or has expired.', variant: 'destructive' })
      return
    }
    promoApplied.value = true
    summaryRef.value = {
      ...summaryRef.value,
      discount,
      total: +(summaryRef.value.subtotal + summaryRef.value.shipping + summaryRef.value.tax - discount).toFixed(2),
    }
    toast({ title: 'Promo applied!', description: `You saved $${discount.toFixed(2)}`, variant: 'success' })
  } catch (e: any) {
    toast({ title: 'Invalid code', description: e?.message || 'Please try another code', variant: 'destructive' })
  }
}

function removePromo() {
  promoApplied.value = false
  const s = summaryRef.value
  summaryRef.value = {
    ...s,
    discount: 0,
    total: +(s.subtotal + s.shipping + s.tax).toFixed(2)
  }
  promoCodeRef.value = ''
  toast({ title: 'Promo removed', description: 'Discount has been removed.' })
}

// ── Init ──
onMounted(async () => {
  try {
    const prefill = localStorage.getItem('DEBUG_CHECKOUT_PREFILL')
    if (prefill) {
      const data = JSON.parse(prefill)
      Object.assign(formData, data)
      toast({ title: 'Checkout prefilled (dev)', description: 'Dev helper applied.', variant: 'success' })
      localStorage.removeItem('DEBUG_CHECKOUT_PREFILL')
    } else if (authStore.isAuthenticated) {
      try {
        const [addresses, profile] = await Promise.all([getAddresses(), getProfile()])

        savedAddresses.value = addresses

        if (profile) {
          formData.email = profile.email
          formData.firstName = profile.firstName
          formData.lastName = profile.lastName
        }

        const defaultAddress = addresses.find(a => a.isDefault)
        if (defaultAddress) {
          formData.address = defaultAddress.address
          formData.city = defaultAddress.city
          formData.country = defaultAddress.country
          formData.zip = defaultAddress.zip
          selectedAddressId.value = defaultAddress.id

          if (defaultAddress.name) {
            const parts = defaultAddress.name.split(' ')
            if (parts.length > 0) formData.firstName = parts[0]
            if (parts.length > 1) formData.lastName = parts.slice(1).join(' ')
          }

          toast({ title: 'Default address loaded', description: 'Your shipping info has been pre-filled.', variant: 'default' })
        }
      } catch (e) {
        console.error('Failed to load user data for checkout', e)
      }
    }
  } catch {}
  fetchSummary()
})

watch(() => formData.zip, () => {
  if (fieldTouched.zip) validateField('zip')
  fetchSummary()
})

// ── Navigation ──
const nextStep = () => {
  if (currentStep.value === 0 && !validateShipping()) {
    toast({ title: 'Incomplete shipping info', description: 'Please fix the errors above.', variant: 'destructive' })
    return
  }
  if (currentStep.value === 1 && !validatePayment()) {
    toast({ title: 'Invalid payment info', description: 'Please check your card details.', variant: 'destructive' })
    return
  }
  if (currentStep.value < steps.length - 1) currentStep.value++
  else handlePayment()
}

const prevStep = () => {
  if (currentStep.value > 0) currentStep.value--
}

// ── Payment ──
const handlePayment = async () => {
  if (isProcessing.value) return
  try {
    paymentErrorRef.value = ''
    isProcessing.value = true
    const payload = {
      items: checkoutItems.value,
      amount: summaryRef.value.total,
      currency: 'USD',
      shipping: {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        address: formData.address,
        city: formData.city,
        zip: formData.zip,
        country: formData.country
      }
    }
    const { paymentId, orderId: intentOrderId } = await createPaymentIntent(payload)
    const result = await confirmPayment({ paymentId, method: 'card', cardLast4: formData.cardNumber.replace(/\s/g, '').slice(-4) })
    if (result.status !== 'succeeded') {
      throw new Error('Payment not completed. Please try again.')
    }

    const finalOrderId = result.orderId || intentOrderId
    const items: OrderItem[] = checkoutItems.value.map((it) => ({
      productId: it.id,
      name: it.title,
      image: it.image,
      price: it.price,
      quantity: it.quantity,
      color: it.color || undefined,
      size: it.size || undefined
    }))
    const shipPhone =
      savedAddresses.value.find((a) => a.id === selectedAddressId.value)?.phone ||
      savedAddresses.value.find((a) => a.isDefault)?.phone ||
      ''
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const paidAt = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
    const digits = formData.cardNumber.replace(/\s/g, '')
    const first = digits[0]
    const cardBrand = first === '4' ? 'Visa' : first === '5' ? 'Mastercard' : 'Card'
    const newOrder: Order = {
      id: finalOrderId,
      date: dateStr,
      total: summaryRef.value.total,
      subtotal: summaryRef.value.subtotal,
      shippingFee: summaryRef.value.shipping,
      tax: summaryRef.value.tax,
      discount: summaryRef.value.discount,
      status: 'In Transit',
      items,
      shipping: {
        name: payload.shipping.name,
        phone: shipPhone || '—',
        address: payload.shipping.address,
        city: payload.shipping.city,
        country: payload.shipping.country || 'United States',
        zip: payload.shipping.zip || ''
      },
      payment: {
        method: 'card',
        cardBrand,
        cardLast4: digits.slice(-4),
        paidAt
      },
      trackingNumber: `SF${Date.now().toString().slice(-10)}`,
      estimatedDelivery: new Date(Date.now() + 5 * 86400000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    }
    if (USE_MOCK) {
      appendCheckoutOrder(newOrder)
    }

    toast({ title: 'Order Confirmed!', description: 'You will receive a confirmation email shortly.', variant: 'success' })

    if (route.query.mode === 'direct') {
      cartStore.clearDirectBuyItem()
    } else {
      cartStore.clearCart()
    }

    router.push({
      name: 'ThankYou',
      query: { orderId: finalOrderId, name: payload.shipping.name, total: summaryRef.value.total.toFixed(2) }
    })
  } catch (e: any) {
    paymentErrorRef.value = e?.message || 'Payment failed. Please try again.'
    toast({ title: 'Payment failed', description: paymentErrorRef.value, variant: 'destructive' })
  } finally {
    isProcessing.value = false
  }
}

function formatPrice(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const inputClass = (field: string) =>
  `w-full h-10 rounded-lg bg-background border px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary ${
    fieldTouched[field] && fieldErrors[field] ? 'border-red-500 focus:ring-red-500' : 'border-input'
  }`
</script>

<template>
  <div class="min-h-screen bg-background pb-20 pt-10">
    <div class="container px-4 max-w-6xl mx-auto">

      <!-- Back to cart -->
      <router-link to="/cart" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ChevronLeft class="w-4 h-4" />
        Back to Cart
      </router-link>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-12">

        <!-- Left Column: Checkout Form -->
        <div class="lg:col-span-7 space-y-8">
          <div v-if="isLoadingRef" class="space-y-6">
            <Skeleton class="h-8 w-48 rounded-md" />
            <div class="grid grid-cols-2 gap-4">
              <Skeleton class="h-10 rounded-lg" />
              <Skeleton class="h-10 rounded-lg" />
            </div>
            <Skeleton class="h-10 rounded-lg" />
            <div class="grid grid-cols-2 gap-4">
              <Skeleton class="h-10 rounded-lg" />
              <Skeleton class="h-10 rounded-lg" />
            </div>
            <div class="flex justify-between pt-6 border-t border-border">
              <Skeleton class="h-9 w-24 rounded-lg" />
              <Skeleton class="h-11 w-32 rounded-xl" />
            </div>
          </div>
          <template v-else>
          <!-- Steps -->
          <div class="flex items-center gap-4 mb-8">
            <div v-for="(step, index) in steps" :key="step" class="flex items-center">
              <div
                class="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors duration-300"
                :class="index <= currentStep ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'"
              >
                <CheckCircle2 v-if="index < currentStep" class="w-5 h-5" />
                <span v-else>{{ index + 1 }}</span>
              </div>
              <span
                class="ml-2 text-sm font-medium transition-colors duration-300 hidden sm:inline"
                :class="index <= currentStep ? 'text-foreground' : 'text-muted-foreground'"
              >
                {{ step }}
              </span>
              <div v-if="index < steps.length - 1" class="w-8 h-px bg-border mx-2 hidden sm:block"></div>
            </div>
          </div>

          <!-- Step 1: Shipping -->
          <div v-if="currentStep === 0" class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 class="text-2xl font-bold">Shipping Details</h2>

            <!-- Saved address picker -->
            <div v-if="savedAddresses.length > 1" class="space-y-3">
              <button
                @click="showAddressPicker = !showAddressPicker"
                class="text-sm text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors"
              >
                <MapPin class="w-4 h-4" />
                {{ showAddressPicker ? 'Hide saved addresses' : 'Choose from saved addresses' }}
              </button>

              <div v-if="showAddressPicker" class="grid gap-3 sm:grid-cols-2">
                <button
                  v-for="addr in savedAddresses"
                  :key="addr.id"
                  @click="pickAddress(addr)"
                  class="text-left p-3 rounded-xl border transition-all text-sm"
                  :class="selectedAddressId === addr.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/40'"
                >
                  <div class="flex items-center justify-between mb-1">
                    <span class="font-medium">{{ addr.type }}</span>
                    <span v-if="addr.isDefault" class="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">Default</span>
                  </div>
                  <p class="text-muted-foreground text-xs">{{ addr.name }}</p>
                  <p class="text-muted-foreground text-xs">{{ addr.address }}</p>
                  <p class="text-muted-foreground text-xs">{{ addr.city }}, {{ addr.zip }}</p>
                </button>
              </div>
            </div>

            <div class="space-y-4">
              <div class="space-y-1">
                <label class="text-sm font-medium">Email Address <span class="text-red-500">*</span></label>
                <input
                  v-model="formData.email"
                  type="email"
                  :class="inputClass('email')"
                  placeholder="you@example.com"
                  @blur="markTouched('email')"
                />
                <p v-if="fieldTouched.email && fieldErrors.email" class="text-xs text-red-500 mt-0.5">{{ fieldErrors.email }}</p>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label class="text-sm font-medium">First Name <span class="text-red-500">*</span></label>
                  <input
                    v-model="formData.firstName"
                    type="text"
                    :class="inputClass('firstName')"
                    @blur="markTouched('firstName')"
                  />
                  <p v-if="fieldTouched.firstName && fieldErrors.firstName" class="text-xs text-red-500 mt-0.5">{{ fieldErrors.firstName }}</p>
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium">Last Name <span class="text-red-500">*</span></label>
                  <input
                    v-model="formData.lastName"
                    type="text"
                    :class="inputClass('lastName')"
                    @blur="markTouched('lastName')"
                  />
                  <p v-if="fieldTouched.lastName && fieldErrors.lastName" class="text-xs text-red-500 mt-0.5">{{ fieldErrors.lastName }}</p>
                </div>
              </div>

              <div class="space-y-1">
                <label class="text-sm font-medium">Address <span class="text-red-500">*</span></label>
                <input
                  v-model="formData.address"
                  type="text"
                  :class="inputClass('address')"
                  @blur="markTouched('address')"
                />
                <p v-if="fieldTouched.address && fieldErrors.address" class="text-xs text-red-500 mt-0.5">{{ fieldErrors.address }}</p>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label class="text-sm font-medium">City <span class="text-red-500">*</span></label>
                  <input
                    v-model="formData.city"
                    type="text"
                    :class="inputClass('city')"
                    @blur="markTouched('city')"
                  />
                  <p v-if="fieldTouched.city && fieldErrors.city" class="text-xs text-red-500 mt-0.5">{{ fieldErrors.city }}</p>
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium">ZIP / Postal Code <span class="text-red-500">*</span></label>
                  <input
                    v-model="formData.zip"
                    type="text"
                    :class="inputClass('zip')"
                    @blur="markTouched('zip')"
                  />
                  <p v-if="fieldTouched.zip && fieldErrors.zip" class="text-xs text-red-500 mt-0.5">{{ fieldErrors.zip }}</p>
                </div>
              </div>

              <div class="space-y-1">
                <label class="text-sm font-medium">Country</label>
                <select
                  v-model="formData.country"
                  class="w-full h-10 rounded-lg bg-background border border-input px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary"
                >
                  <option v-for="c in countries" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Step 2: Payment -->
          <div v-if="currentStep === 1" class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 class="text-2xl font-bold">Payment Method</h2>

            <div class="p-4 border border-primary/20 bg-primary/5 rounded-xl flex items-center gap-4 mb-6">
              <Lock class="w-5 h-5 text-primary" />
              <p class="text-sm text-muted-foreground">All transactions are secure and encrypted.</p>
            </div>

            <div class="space-y-4">
              <div class="space-y-1">
                <label class="text-sm font-medium">Card Number <span class="text-red-500">*</span></label>
                <div class="relative">
                  <CreditCard class="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                  <input
                    :value="formData.cardNumber"
                    @input="onCardNumberInput"
                    @blur="markTouched('cardNumber')"
                    type="text"
                    inputmode="numeric"
                    maxlength="19"
                    :class="inputClass('cardNumber')"
                    class="!pl-10"
                    placeholder="0000 0000 0000 0000"
                  />
                  <span v-if="cardBrand" class="absolute right-3 top-2.5 text-xs font-medium text-muted-foreground">{{ cardBrand }}</span>
                </div>
                <p v-if="fieldTouched.cardNumber && fieldErrors.cardNumber" class="text-xs text-red-500 mt-0.5">{{ fieldErrors.cardNumber }}</p>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label class="text-sm font-medium">Expiry Date <span class="text-red-500">*</span></label>
                  <input
                    :value="formData.expiry"
                    @input="onExpiryInput"
                    @blur="markTouched('expiry')"
                    type="text"
                    inputmode="numeric"
                    maxlength="5"
                    :class="inputClass('expiry')"
                    placeholder="MM/YY"
                  />
                  <p v-if="fieldTouched.expiry && fieldErrors.expiry" class="text-xs text-red-500 mt-0.5">{{ fieldErrors.expiry }}</p>
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium">CVC <span class="text-red-500">*</span></label>
                  <input
                    :value="formData.cvc"
                    @input="onCvcInput"
                    @blur="markTouched('cvc')"
                    type="text"
                    inputmode="numeric"
                    maxlength="4"
                    :class="inputClass('cvc')"
                    placeholder="123"
                  />
                  <p v-if="fieldTouched.cvc && fieldErrors.cvc" class="text-xs text-red-500 mt-0.5">{{ fieldErrors.cvc }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 3: Review -->
          <div v-if="currentStep === 2" class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 class="text-2xl font-bold">Review Order</h2>

            <!-- Order items -->
            <div class="space-y-3">
              <h3 class="text-sm font-medium text-muted-foreground">Items ({{ checkoutItems.length }})</h3>
              <div v-for="item in checkoutItems" :key="item.cartItemId || item.id" class="flex gap-3 p-3 rounded-lg border border-border bg-card/50">
                <div class="w-14 h-14 rounded-md bg-secondary overflow-hidden flex-shrink-0">
                  <img :src="item.image" :alt="item.title" class="w-full h-full object-cover" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{{ item.title }}</p>
                  <p class="text-xs text-muted-foreground">{{ item.color }} / {{ item.size || 'Standard' }} &middot; Qty: {{ item.quantity }}</p>
                </div>
                <p class="text-sm font-medium flex-shrink-0">${{ formatPrice(item.price * item.quantity) }}</p>
              </div>
            </div>

            <div class="bg-secondary/20 rounded-xl p-6 space-y-4">
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="font-medium mb-1">Contact</h3>
                  <p class="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Mail class="w-3.5 h-3.5" />
                    {{ formData.email }}
                  </p>
                </div>
                <Button variant="ghost" size="sm" @click="currentStep = 0">Edit</Button>
              </div>
              <div class="h-px bg-border"></div>
              <div class="flex justify-between items-start">
                 <div>
                   <h3 class="font-medium mb-1">Shipping To</h3>
                   <p class="text-sm text-muted-foreground">{{ formData.firstName }} {{ formData.lastName }}</p>
                   <p class="text-sm text-muted-foreground">{{ formData.address }}</p>
                   <p class="text-sm text-muted-foreground">{{ formData.city }}, {{ formData.zip }}</p>
                   <p class="text-sm text-muted-foreground">{{ formData.country }}</p>
                 </div>
                 <Button variant="ghost" size="sm" @click="currentStep = 0">Edit</Button>
              </div>
              <div class="h-px bg-border"></div>
              <div class="flex justify-between items-start">
                 <div>
                   <h3 class="font-medium mb-1">Payment Method</h3>
                   <p class="text-sm text-muted-foreground flex items-center gap-2">
                     <CreditCard class="w-4 h-4" />
                     {{ cardBrand || 'Card' }} ending in {{ formData.cardNumber.replace(/\s/g, '').slice(-4) || '****' }}
                   </p>
                 </div>
                 <Button variant="ghost" size="sm" @click="currentStep = 1">Edit</Button>
              </div>
            </div>
          </div>

          <!-- Payment Error -->
          <ErrorState v-if="paymentErrorRef && currentStep === 2" :message="paymentErrorRef" @retry="handlePayment" />

          <!-- Navigation Buttons -->
          <div class="flex justify-between pt-6 border-t border-border">
            <Button
              v-if="currentStep > 0"
              variant="outline"
              @click="prevStep"
            >
              Back
            </Button>
            <div v-else></div>

            <Button
              size="lg"
              @click="nextStep"
              :disabled="isProcessing"
              class="px-8"
            >
              <span v-if="isProcessing" class="flex items-center gap-2">
                <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Processing...
              </span>
              <span v-else>{{ currentStep === steps.length - 1 ? `Pay $${formatPrice(total)}` : 'Continue' }}</span>
            </Button>
          </div>
          </template>
        </div>

        <!-- Right Column: Order Summary -->
        <div class="lg:col-span-5">
          <div v-if="isLoadingRef" class="sticky top-24 bg-card border border-border rounded-2xl p-6 shadow-sm space-y-3">
            <Skeleton class="h-6 w-32 rounded-md" />
            <Skeleton class="h-4 w-full rounded-md" />
            <Skeleton class="h-4 w-3/4 rounded-md" />
            <Skeleton class="h-12 w-full rounded-xl" />
          </div>
          <div v-else class="sticky top-24 bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 class="text-lg font-bold mb-4">Order Summary</h3>

            <div class="space-y-4 max-h-80 overflow-y-auto pr-2 mb-6 custom-scrollbar">
              <div v-for="item in checkoutItems" :key="item.cartItemId || item.id" class="flex gap-4">
                <div class="w-16 h-16 rounded-md bg-secondary overflow-hidden flex-shrink-0">
                  <img :src="item.image" :alt="item.title" class="w-full h-full object-cover" />
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-medium line-clamp-1">{{ item.title }}</h4>
                  <p class="text-xs text-muted-foreground">{{ item.color }}</p>
                  <div class="flex justify-between items-center mt-1">
                    <p class="text-xs text-muted-foreground">Qty: {{ item.quantity }}</p>
                    <p class="text-sm font-medium">${{ formatPrice(item.price * item.quantity) }}</p>
                  </div>
                </div>
              </div>
            </div>

            <ErrorState v-if="!isLoadingRef && errorRef" :message="errorRef" @retry="fetchSummary" />
            <div v-else class="space-y-3 pt-4 border-t border-border">
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">Subtotal</span>
                <span>${{ formatPrice(summaryRef.subtotal) }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">Shipping</span>
                <span :class="summaryRef.shipping === 0 ? 'text-emerald-500' : ''">
                  {{ summaryRef.shipping === 0 ? 'Free' : `$${formatPrice(summaryRef.shipping)}` }}
                </span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">Tax</span>
                <span>${{ formatPrice(summaryRef.tax) }}</span>
              </div>
              <div v-if="summaryRef.discount > 0" class="flex justify-between text-sm">
                <span class="text-muted-foreground">Discount</span>
                <span class="text-emerald-500">- ${{ formatPrice(summaryRef.discount) }}</span>
              </div>
              <div class="flex justify-between text-lg font-bold pt-2 border-t border-border">
                <span>Total</span>
                <span class="text-primary">${{ formatPrice(summaryRef.total) }}</span>
              </div>
            </div>

            <!-- Promo code -->
            <div v-if="!promoApplied" class="flex gap-2 mt-4">
              <input
                v-model="promoCodeRef"
                type="text"
                placeholder="Promo code"
                class="flex-1 h-9 rounded-lg bg-secondary border border-transparent px-3 text-sm outline-none focus:border-primary transition-colors uppercase"
                @keyup.enter="onApplyPromo"
              />
              <Button size="sm" variant="outline" class="h-9" @click="onApplyPromo">Apply</Button>
            </div>
            <div v-else class="mt-4 flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
              <div class="flex items-center gap-2">
                <Tag class="w-4 h-4 text-emerald-600" />
                <span class="text-sm font-medium text-emerald-700 dark:text-emerald-400">{{ promoCodeRef.toUpperCase() }}</span>
                <span class="text-xs text-emerald-600">(-${{ formatPrice(summaryRef.discount) }})</span>
              </div>
              <button @click="removePromo" class="text-xs text-muted-foreground hover:text-destructive transition-colors">Remove</button>
            </div>

            <!-- Available coupons from wallet -->
            <div v-if="!promoApplied && couponStore.available.length > 0" class="mt-3">
              <p class="text-xs text-muted-foreground mb-1.5">Your coupons:</p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="c in couponStore.available.slice(0, 4)"
                  :key="c.id"
                  @click="promoCodeRef = c.code; onApplyPromo()"
                  class="text-xs px-2 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                >
                  {{ c.code }}
                </button>
                <router-link
                  to="/dashboard/coupons"
                  class="text-xs px-2 py-1 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  + more
                </router-link>
              </div>
            </div>

            <div class="mt-6 grid grid-cols-3 gap-2 text-xs text-muted-foreground text-center">
              <div class="flex flex-col items-center gap-1">
                <ShieldCheck class="w-4 h-4" />
                <span>Secure</span>
              </div>
              <div class="flex flex-col items-center gap-1">
                <Truck class="w-4 h-4" />
                <span>Free Ship</span>
              </div>
              <div class="flex flex-col items-center gap-1">
                <CheckCircle2 class="w-4 h-4" />
                <span>Verified</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: hsl(var(--secondary));
  border-radius: 4px;
}
</style>

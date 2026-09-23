<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCartStore } from '@/stores/cart'
import { useCouponStore } from '@/stores/coupons'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { usePaymentFlow } from '@/composables/usePaymentFlow'
import { useCheckoutForm } from '@/composables/useCheckoutForm'
import { useOrderSummary } from '@/composables/useOrderSummary'
import Button from '@/components/ui/button/Button.vue'
import {
  CheckCircle2,
  CreditCard,
  Truck,
  ShieldCheck,
  Lock,
  MapPin,
  Tag,
  ChevronLeft,
  Mail,
  Sparkles,
  AlertTriangle,
  Check,
  Plus,
  Trash2,
} from 'lucide-vue-next'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import ErrorState from '@/components/ui/state/ErrorState.vue'
import PaymentGatewayModal from '@/components/ui/payment/PaymentGatewayModal.vue'
import {
  getSavedPaymentMethods,
  savePaymentMethod,
  deleteSavedPaymentMethod,
  type SavedPaymentMethod,
} from '@/api/modules/payment'
import { getCompleteTheLook } from '@/api/modules/product'
import type { Product } from '@/types/product'
import { appendCheckoutOrder, type Order, type OrderItem } from '@/api/modules/orders'
import { USE_MOCK } from '@/config/env'
import { useLoyaltyStore } from '@/stores/loyalty'
import { POINTS_PER_DOLLAR } from '@/api/modules/loyalty'

const router = useRouter()
const route = useRoute()
const cartStore = useCartStore()
const couponStore = useCouponStore()
const authStore = useAuthStore()
const loyaltyStore = useLoyaltyStore()
const { toast } = useToast()
const { t } = useI18n()

// ── Empty cart guard ──
const checkoutItems = computed(() => {
  if (route.query.mode === 'direct' && cartStore.directBuyItem) {
    return [cartStore.directBuyItem]
  }
  return cartStore.items
})

onMounted(() => {
  if (checkoutItems.value.length === 0) {
    toast({
      title: t('cart.empty'),
      description: t('checkout.cartEmptyDesc'),
      variant: 'destructive',
    })
    router.replace('/cart')
  }
  couponStore.load()
  loadCompleteTheLook()
  loadSavedCards()
})

// ── Steps ──
const steps = computed(() => [
  t('checkout.stepShipping'),
  t('checkout.stepPayment'),
  t('checkout.stepReview'),
])
const currentStep = ref(0)
/**
 * 支付成功 → 清空购物车 → 跳转 ThankYou 期间置位，防止 checkoutItems 变空时 watcher 把页面重定向回购物车。
 * 与 isProcessing 是一对，但只有它由本页持有 —— 置位它的 finalizeOrder 在下面，是页面级编排。
 */
const isCompletingOrder = ref(false)

// ── Complete the Look（阶段 1.1）：结算页追加购买推荐 ──
const ctlProducts = ref<Product[]>([])
const ctlSelected = ref<Set<number>>(new Set())
const ctlLoading = ref(false)
const ctlAdding = ref(false)

async function loadCompleteTheLook() {
  const first = checkoutItems.value[0]
  if (!first) return
  ctlLoading.value = true
  try {
    const items = await getCompleteTheLook(Number(first.id), 3)
    ctlProducts.value = items
    ctlSelected.value = new Set(items.map((p) => p.id))
  } catch {
    ctlProducts.value = []
  } finally {
    ctlLoading.value = false
  }
}

function toggleCtl(id: number) {
  const next = new Set(ctlSelected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  ctlSelected.value = next
}

function ctlSelectedCount() {
  return ctlProducts.value.filter((p) => ctlSelected.value.has(p.id)).length
}

async function addCompleteTheLook() {
  if (ctlAdding.value) return
  const toAdd = ctlProducts.value.filter((p) => ctlSelected.value.has(p.id))
  if (!toAdd.length) return
  ctlAdding.value = true
  try {
    toAdd.forEach((p) => {
      cartStore.addItem(p, {
        color: p.colors?.[0]?.name ?? 'Default',
        size: p.sizes?.[0] ?? 'Standard',
        quantity: 1,
      })
    })
    toast({
      title: t('checkout.addedToOrder'),
      description: `${toAdd.length} ${t('checkout.itemsCount', { count: toAdd.length })}`,
      variant: 'success',
    })
    ctlSelected.value = new Set()
  } finally {
    ctlAdding.value = false
  }
}

// ── 已保存支付方式（阶段 2.2）：token 化保存 → 一键下单 ──
const savedCards = ref<SavedPaymentMethod[]>([])
const selectedSavedCardId = ref('')
const saveCardForNextTime = ref(false)

/** 已保存卡按用户作用域隔离（guest 不展示，仅登录用户可保存/一键下单） */
function savedCardsScope() {
  return authStore.user?.id ?? ''
}

function loadSavedCards() {
  const scope = savedCardsScope()
  savedCards.value = scope ? getSavedPaymentMethods(scope) : []
}

function isUsingSavedCard() {
  return !!selectedSavedCardId.value
}

/** 当前选中的已保存卡（用于展示与一键下单） */
const selectedSavedCard = computed(
  () => savedCards.value.find((c) => c.id === selectedSavedCardId.value) ?? null,
)

function selectSavedCard(id: string) {
  selectedSavedCardId.value = selectedSavedCardId.value === id ? '' : id
}

function removeSavedCard(id: string) {
  const scope = savedCardsScope()
  if (!scope) return
  deleteSavedPaymentMethod(scope, id)
  savedCards.value = savedCards.value.filter((m) => m.id !== id)
  if (selectedSavedCardId.value === id) selectedSavedCardId.value = ''
  toast({ title: t('checkout.savedCardRemoved'), variant: 'success' })
}

// ── 收货 / 支付表单（字段、逐字段校验、卡号掩码、已存地址、首屏预填）──
// 整块在 useCheckoutForm 里。本页只消费 formData（支付 payload 与 finalizeOrder 要读）
// 和几个校验入口，不自己持有表单状态。
const {
  formData,
  fieldErrors,
  fieldTouched,
  markTouched,
  validateField,
  validateShipping,
  validatePayment,
  onCardNumberInput,
  onExpiryInput,
  onCvcInput,
  cardBrand,
  countries,
  savedAddresses,
  selectedAddressId,
  showAddressPicker,
  pickAddress,
  loadInitialData,
} = useCheckoutForm()

// ── Order summary & promo（含积分抵扣）──
// 三块状态（服务端摘要 / 手动优惠码 / 积分抵扣）整块在 useOrderSummary 里。
// 下面几个别名是为了**不动模板**：组合式那边用干净的名字，页面沿用原先的 XXRef 叫法。
const {
  summary: summaryRef,
  isLoading: isLoadingRef,
  error: errorRef,
  fetchSummary,
  promoCode: promoCodeRef,
  promoApplied,
  promoDiscount,
  tieredDiscount,
  pointsToUse,
  pointsUsable,
  maxPointsToUse,
  pointsDiscount,
  total,
  applyPromo: onApplyPromo,
  removePromo,
} = useOrderSummary({
  items: checkoutItems,
  getZip: () => formData.zip,
})

// ── Init ──
// 表单预填（调试钩子 / 登录态资料与默认地址）在 useCheckoutForm 里；
// 这里只负责「预填完再取订单摘要」这个页面级的顺序 —— 摘要是页面的事，不归表单组合式。
onMounted(async () => {
  await loadInitialData()
  fetchSummary()
})

watch(
  () => formData.zip,
  () => {
    if (fieldTouched.zip) validateField('zip')
    fetchSummary()
  },
)

// ── Navigation ──
const nextStep = () => {
  if (currentStep.value === 0 && !validateShipping()) {
    toast({
      title: t('checkout.incompleteShipping'),
      description: t('checkout.incompleteShippingDesc'),
      variant: 'destructive',
    })
    return
  }
  // 已选保存卡时无需填卡表单，跳过卡字段校验（阶段 2.2 一键下单）
  if (currentStep.value === 1 && !isUsingSavedCard() && !validatePayment()) {
    toast({
      title: t('checkout.invalidPayment'),
      description: t('checkout.invalidPaymentDesc'),
      variant: 'destructive',
    })
    return
  }
  if (currentStep.value < steps.value.length - 1) currentStep.value++
  else handlePayment()
}

const prevStep = () => {
  if (currentStep.value > 0) currentStep.value--
}

// ── Payment（阶段 2.1：网关化：成功 / 拒付重试 / 3DS 认证） ──
// 网关状态机在 usePaymentFlow 里；**落单与收尾留在本页** —— 建单 → 积分 → 清购物车 →
// 跳转是页面级编排，不是网关的事。组合式通过 finalize 回调下面这个 finalizeOrder。

/** 支付成功 → 落单 → 积分入账 → 清空购物车 → 跳转 ThankYou */
const finalizeOrder = async (finalOrderId: string) => {
  const items: OrderItem[] = checkoutItems.value.map((it) => ({
    productId: it.id,
    name: it.title,
    image: it.image,
    price: it.price,
    quantity: it.quantity,
    color: it.color || undefined,
    size: it.size || undefined,
  }))
  const shipPhone =
    savedAddresses.value.find((a) => a.id === selectedAddressId.value)?.phone ||
    savedAddresses.value.find((a) => a.isDefault)?.phone ||
    ''
  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const paidAt = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  // 已选保存卡时以保存的卡信息展示，否则用当前输入卡号
  const usedCard = selectedSavedCard.value
  const digits = usedCard ? usedCard.last4 : formData.cardNumber.replace(/\s/g, '')
  const first = digits[0]
  const orderCardBrand =
    usedCard?.brand ?? (first === '4' ? 'Visa' : first === '5' ? 'Mastercard' : 'Card')
  const newOrder: Order = {
    id: finalOrderId,
    date: dateStr,
    total: total.value,
    subtotal: summaryRef.value.subtotal,
    shippingFee: summaryRef.value.shipping,
    tax: summaryRef.value.tax,
    discount: summaryRef.value.discount + promoDiscount.value,
    status: 'In Transit',
    items,
    shipping: {
      name: `${formData.firstName} ${formData.lastName}`.trim(),
      phone: shipPhone || '—',
      address: formData.address,
      city: formData.city,
      country: formData.country || 'United States',
      zip: formData.zip || '',
    },
    payment: {
      method: 'card',
      cardBrand: orderCardBrand,
      cardLast4: usedCard ? usedCard.last4 : digits.slice(-4),
      paidAt,
    },
    trackingNumber: `SF${Date.now().toString().slice(-10)}`,
    estimatedDelivery: new Date(Date.now() + 5 * 86400000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  }
  if (USE_MOCK) {
    appendCheckoutOrder(newOrder)
  }

  // 阶段 2.2：勾选「保存此卡」且本次用新卡支付成功 → token 化保存，下次一键下单
  if (saveCardForNextTime.value && !usedCard && authStore.user?.id) {
    const saveDigits = formData.cardNumber.replace(/\s/g, '')
    const saveExp = formData.expiry.replace(/[^\d]/g, '')
    const saveBrand = /^4/.test(saveDigits)
      ? 'Visa'
      : /^5[1-5]/.test(saveDigits) || /^2[2-7]/.test(saveDigits)
        ? 'Mastercard'
        : /^3[47]/.test(saveDigits)
          ? 'Amex'
          : /^6(?:011|5)/.test(saveDigits)
            ? 'Discover'
            : 'Card'
    savePaymentMethod(authStore.user.id, {
      brand: saveBrand,
      last4: saveDigits.slice(-4),
      expMonth: saveExp.slice(0, 2),
      expYear: saveExp.slice(2),
    })
    saveCardForNextTime.value = false
  }

  // 阶段 5.1：扣减已用积分 → 累计消费 → 返积分（实付 $1 = 1 积分）
  let earnedPoints = 0
  if (authStore.isAuthenticated) {
    if (pointsToUse.value > 0) loyaltyStore.spendPoints(pointsToUse.value)
    const paid = total.value
    loyaltyStore.recordSpend(paid)
    earnedPoints = loyaltyStore.earnPoints(paid)
  }

  toast({
    title: t('checkout.orderConfirmed'),
    description: t('checkout.orderConfirmedDesc'),
    variant: 'success',
  })

  // 置位完成订单标记后再清空购物车，并 await 跳转，让 checkoutItems 的 watcher 在
  // 微任务中执行时看到标记为 true，从而不会把页面重定向回 /cart
  isCompletingOrder.value = true
  if (route.query.mode === 'direct') {
    cartStore.clearDirectBuyItem()
  } else {
    cartStore.clearCart()
  }

  await router.push({
    name: 'ThankYou',
    query: {
      orderId: finalOrderId,
      name: `${formData.firstName} ${formData.lastName}`.trim(),
      total: total.value.toFixed(2),
      points: earnedPoints || undefined,
    },
  })
}

// pendingIntent / last3dsTxn 是状态机内部状态，页面不读（原先只在 handlePayment 与
// on3dsComplete 之间传递，那两个函数已经搬进组合式），故不解构。
const {
  isProcessing,
  paymentErrorRef,
  show3ds,
  handlePayment,
  on3dsComplete,
  on3dsReject,
  on3dsCancel,
} = usePaymentFlow({
  items: checkoutItems,
  formData,
  total,
  savedCard: selectedSavedCard,
  currentStep,
  isCompletingOrder,
  finalize: finalizeOrder,
})

// 注意：支付完成时清空购物车会触发本 watcher。isProcessing 在 finally 里同步复位，
// 而 watcher 回调要等微任务队列才执行，届时 isProcessing 已是 false，会把"支付成功跳转
// ThankYou"覆盖成回到 /cart。故用独立的 isCompletingOrder 标记，保持到路由跳转完成。
//
// 它放在这里而不是 checkoutItems 旁边：读的 isProcessing 来自上面组合式的解构，
// 而组合式要等 total / selectedSavedCard / finalizeOrder 都定义好才能调用。
watch(checkoutItems, (items) => {
  if (items.length === 0 && !isProcessing.value && !isCompletingOrder.value) {
    router.replace('/cart')
  }
})

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
      <router-link
        to="/cart"
        class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft class="w-4 h-4" />
        {{ $t('checkout.backToCart') }}
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
                  :class="
                    index <= currentStep
                      ? 'bg-primary text-white'
                      : 'bg-secondary text-muted-foreground'
                  "
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
                <div
                  v-if="index < steps.length - 1"
                  class="w-8 h-px bg-border mx-2 hidden sm:block"
                ></div>
              </div>
            </div>

            <!-- Step 1: Shipping -->
            <div
              v-if="currentStep === 0"
              class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300"
            >
              <h2 class="text-2xl font-bold">{{ $t('checkout.shippingDetails') }}</h2>

              <!-- Saved address picker -->
              <div v-if="savedAddresses.length > 1" class="space-y-3">
                <button
                  class="text-sm text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors"
                  @click="showAddressPicker = !showAddressPicker"
                >
                  <MapPin class="w-4 h-4" />
                  {{
                    showAddressPicker
                      ? $t('checkout.hideAddresses')
                      : $t('checkout.chooseAddresses')
                  }}
                </button>

                <div v-if="showAddressPicker" class="grid gap-3 sm:grid-cols-2">
                  <button
                    v-for="addr in savedAddresses"
                    :key="addr.id"
                    class="text-left p-3 rounded-xl border transition-all text-sm"
                    :class="
                      selectedAddressId === addr.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-primary/40'
                    "
                    @click="pickAddress(addr)"
                  >
                    <div class="flex items-center justify-between mb-1">
                      <span class="font-medium">{{ addr.type }}</span>
                      <span
                        v-if="addr.isDefault"
                        class="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full"
                        >{{ $t('checkout.defaultBadge') }}</span
                      >
                    </div>
                    <p class="text-muted-foreground text-xs">{{ addr.name }}</p>
                    <p class="text-muted-foreground text-xs">{{ addr.address }}</p>
                    <p class="text-muted-foreground text-xs">{{ addr.city }}, {{ addr.zip }}</p>
                  </button>
                </div>
              </div>

              <div class="space-y-4">
                <div class="space-y-1">
                  <label class="text-sm font-medium"
                    >{{ $t('checkout.emailAddress') }} <span class="text-red-500">*</span></label
                  >
                  <input
                    v-model="formData.email"
                    type="email"
                    data-testid="checkout-email"
                    :class="inputClass('email')"
                    placeholder="you@example.com"
                    @blur="markTouched('email')"
                  />
                  <p
                    v-if="fieldTouched.email && fieldErrors.email"
                    class="text-xs text-red-500 mt-0.5"
                  >
                    {{ fieldErrors.email }}
                  </p>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-1">
                    <label class="text-sm font-medium"
                      >{{ $t('checkout.firstName') }} <span class="text-red-500">*</span></label
                    >
                    <input
                      v-model="formData.firstName"
                      type="text"
                      data-testid="checkout-first-name"
                      :class="inputClass('firstName')"
                      @blur="markTouched('firstName')"
                    />
                    <p
                      v-if="fieldTouched.firstName && fieldErrors.firstName"
                      class="text-xs text-red-500 mt-0.5"
                    >
                      {{ fieldErrors.firstName }}
                    </p>
                  </div>
                  <div class="space-y-1">
                    <label class="text-sm font-medium"
                      >{{ $t('checkout.lastName') }} <span class="text-red-500">*</span></label
                    >
                    <input
                      v-model="formData.lastName"
                      type="text"
                      data-testid="checkout-last-name"
                      :class="inputClass('lastName')"
                      @blur="markTouched('lastName')"
                    />
                    <p
                      v-if="fieldTouched.lastName && fieldErrors.lastName"
                      class="text-xs text-red-500 mt-0.5"
                    >
                      {{ fieldErrors.lastName }}
                    </p>
                  </div>
                </div>

                <div class="space-y-1">
                  <label class="text-sm font-medium"
                    >{{ $t('checkout.address') }} <span class="text-red-500">*</span></label
                  >
                  <input
                    v-model="formData.address"
                    type="text"
                    data-testid="checkout-address"
                    :class="inputClass('address')"
                    @blur="markTouched('address')"
                  />
                  <p
                    v-if="fieldTouched.address && fieldErrors.address"
                    class="text-xs text-red-500 mt-0.5"
                  >
                    {{ fieldErrors.address }}
                  </p>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-1">
                    <label class="text-sm font-medium"
                      >{{ $t('checkout.city') }} <span class="text-red-500">*</span></label
                    >
                    <input
                      v-model="formData.city"
                      type="text"
                      data-testid="checkout-city"
                      :class="inputClass('city')"
                      @blur="markTouched('city')"
                    />
                    <p
                      v-if="fieldTouched.city && fieldErrors.city"
                      class="text-xs text-red-500 mt-0.5"
                    >
                      {{ fieldErrors.city }}
                    </p>
                  </div>
                  <div class="space-y-1">
                    <label class="text-sm font-medium"
                      >{{ $t('checkout.zipCode') }} <span class="text-red-500">*</span></label
                    >
                    <input
                      v-model="formData.zip"
                      type="text"
                      data-testid="checkout-zip"
                      :class="inputClass('zip')"
                      @blur="markTouched('zip')"
                    />
                    <p
                      v-if="fieldTouched.zip && fieldErrors.zip"
                      class="text-xs text-red-500 mt-0.5"
                    >
                      {{ fieldErrors.zip }}
                    </p>
                  </div>
                </div>

                <div class="space-y-1">
                  <label class="text-sm font-medium">{{ $t('checkout.country') }}</label>
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
            <div
              v-if="currentStep === 1"
              class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300"
            >
              <h2 class="text-2xl font-bold">{{ $t('checkout.paymentMethod') }}</h2>

              <div
                class="p-4 border border-primary/20 bg-primary/5 rounded-xl flex items-center gap-4 mb-6"
              >
                <Lock class="w-5 h-5 text-primary" />
                <p class="text-sm text-muted-foreground">{{ $t('checkout.secureNote') }}</p>
              </div>

              <!-- 已保存支付方式（阶段 2.2 一键下单）：点击直接扣款 -->
              <div v-if="authStore.isAuthenticated && savedCards.length" class="space-y-2 mb-6">
                <p class="text-sm font-medium">{{ $t('checkout.savedCards') }}</p>
                <div
                  v-for="c in savedCards"
                  :key="c.id"
                  class="flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                  :class="
                    selectedSavedCardId === c.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border bg-card hover:border-primary/40'
                  "
                  :data-saved-card="c.id"
                  @click="selectSavedCard(c.id)"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <div
                      class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"
                    >
                      <CreditCard class="w-5 h-5" />
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-medium flex items-center gap-2">
                        {{ c.brand }}
                        <span class="font-mono text-muted-foreground">•••• {{ c.last4 }}</span>
                      </p>
                      <p class="text-xs text-muted-foreground">
                        Expires {{ c.expMonth }}/{{ c.expYear }}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      class="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      :title="$t('common.remove')"
                      :data-remove-saved-card="c.id"
                      @click.stop="removeSavedCard(c.id)"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                    <Check v-if="selectedSavedCardId === c.id" class="w-5 h-5 text-primary" />
                  </div>
                </div>

                <!-- 已选保存卡 → 提供「使用新卡」切换，取消选中后回到卡表单 -->
                <button
                  v-if="isUsingSavedCard()"
                  type="button"
                  class="w-full h-11 rounded-xl border border-input flex items-center justify-center gap-2 text-sm font-medium hover:bg-muted transition-colors"
                  data-use-new-card
                  @click="selectedSavedCardId = ''"
                >
                  <Plus class="w-4 h-4" />
                  {{ $t('checkout.useNewCard') }}
                </button>
              </div>

              <!-- 支付错误提示（拒付/余额不足/认证失败后回到此步展示，允许改卡重试） -->
              <div
                v-if="paymentErrorRef && currentStep === 1"
                class="p-4 border border-red-500/30 bg-red-500/5 rounded-xl flex items-start gap-3 mb-6 animate-in fade-in duration-200"
              >
                <AlertTriangle class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div class="min-w-0">
                  <p class="text-sm font-medium text-red-600 dark:text-red-400">
                    {{ paymentErrorRef }}
                  </p>
                  <p class="text-xs text-muted-foreground mt-0.5">
                    {{ $t('checkout.paymentErrorHint') }}
                  </p>
                </div>
              </div>

              <div v-if="!isUsingSavedCard()" class="space-y-4">
                <div class="space-y-1">
                  <label class="text-sm font-medium"
                    >{{ $t('checkout.cardNumber') }} <span class="text-red-500">*</span></label
                  >
                  <div class="relative">
                    <CreditCard class="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                    <input
                      :value="formData.cardNumber"
                      type="text"
                      inputmode="numeric"
                      maxlength="19"
                      data-testid="checkout-card-number"
                      :class="inputClass('cardNumber')"
                      class="!pl-10"
                      placeholder="0000 0000 0000 0000"
                      @input="onCardNumberInput"
                      @blur="markTouched('cardNumber')"
                    />
                    <span
                      v-if="cardBrand"
                      class="absolute right-3 top-2.5 text-xs font-medium text-muted-foreground"
                      >{{ cardBrand }}</span
                    >
                  </div>
                  <p
                    v-if="fieldTouched.cardNumber && fieldErrors.cardNumber"
                    class="text-xs text-red-500 mt-0.5"
                  >
                    {{ fieldErrors.cardNumber }}
                  </p>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-1">
                    <label class="text-sm font-medium"
                      >{{ $t('checkout.expiryDate') }} <span class="text-red-500">*</span></label
                    >
                    <input
                      :value="formData.expiry"
                      type="text"
                      inputmode="numeric"
                      maxlength="5"
                      data-testid="checkout-expiry"
                      :class="inputClass('expiry')"
                      placeholder="MM/YY"
                      @input="onExpiryInput"
                      @blur="markTouched('expiry')"
                    />
                    <p
                      v-if="fieldTouched.expiry && fieldErrors.expiry"
                      class="text-xs text-red-500 mt-0.5"
                    >
                      {{ fieldErrors.expiry }}
                    </p>
                  </div>
                  <div class="space-y-1">
                    <label class="text-sm font-medium"
                      >{{ $t('checkout.cvc') }} <span class="text-red-500">*</span></label
                    >
                    <input
                      :value="formData.cvc"
                      type="text"
                      inputmode="numeric"
                      maxlength="4"
                      data-testid="checkout-cvc"
                      :class="inputClass('cvc')"
                      placeholder="123"
                      @input="onCvcInput"
                      @blur="markTouched('cvc')"
                    />
                    <p
                      v-if="fieldTouched.cvc && fieldErrors.cvc"
                      class="text-xs text-red-500 mt-0.5"
                    >
                      {{ fieldErrors.cvc }}
                    </p>
                  </div>
                </div>

                <!-- 保存此卡：勾选后支付成功自动 token 化保存，下次一键下单（阶段 2.2） -->
                <label
                  v-if="authStore.isAuthenticated"
                  class="flex items-center gap-2 text-sm cursor-pointer select-none"
                >
                  <input
                    v-model="saveCardForNextTime"
                    type="checkbox"
                    class="w-4 h-4 accent-primary"
                    data-save-card-checkbox
                  />
                  {{ $t('checkout.saveCardForNextTime') }}
                </label>
              </div>
            </div>

            <!-- Step 3: Review -->
            <div
              v-if="currentStep === 2"
              class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300"
            >
              <h2 class="text-2xl font-bold">{{ $t('checkout.reviewOrder') }}</h2>

              <!-- Order items -->
              <div class="space-y-3">
                <h3 class="text-sm font-medium text-muted-foreground">
                  {{ $t('checkout.itemsCount', { count: checkoutItems.length }) }}
                </h3>
                <div
                  v-for="item in checkoutItems"
                  :key="item.cartItemId || item.id"
                  class="flex gap-3 p-3 rounded-lg border border-border bg-card/50"
                >
                  <div class="w-14 h-14 rounded-md bg-secondary overflow-hidden flex-shrink-0">
                    <img :src="item.image" :alt="item.title" class="w-full h-full object-cover" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">{{ item.title }}</p>
                    <p class="text-xs text-muted-foreground">
                      {{ item.color }} / {{ item.size || $t('cart.optionStandard') }} &middot;
                      {{ $t('checkout.qty', { count: item.quantity }) }}
                    </p>
                  </div>
                  <p class="text-sm font-medium flex-shrink-0">
                    ${{ formatPrice(item.price * item.quantity) }}
                  </p>
                </div>
              </div>

              <!-- Complete the Look（阶段 1.1）：追加购买推荐 -->
              <div
                v-if="ctlProducts.length > 0"
                class="rounded-2xl border border-border bg-card/60 p-4 space-y-3"
                data-testid="complete-the-look"
              >
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 class="text-sm font-bold flex items-center gap-2">
                      <Sparkles class="w-4 h-4 text-primary" />
                      {{ $t('checkout.completeTheLook') }}
                    </h3>
                    <p class="text-xs text-muted-foreground mt-0.5">
                      {{ $t('checkout.completeTheLookDesc') }}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    :disabled="ctlSelectedCount() === 0 || ctlAdding"
                    class="shrink-0"
                    @click="addCompleteTheLook"
                  >
                    <Plus class="w-3.5 h-3.5" />
                    {{ $t('checkout.addToOrder') }} ({{ ctlSelectedCount() }})
                  </Button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    v-for="p in ctlProducts"
                    :key="p.id"
                    :data-ctl-id="p.id"
                    class="flex items-center gap-2.5 p-2 rounded-xl border text-left transition-colors"
                    :class="
                      ctlSelected.has(p.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-foreground/30 bg-background'
                    "
                    @click="toggleCtl(p.id)"
                  >
                    <div
                      class="relative w-12 h-12 rounded-lg bg-secondary overflow-hidden flex-shrink-0"
                    >
                      <img
                        :src="p.image"
                        :alt="p.title"
                        class="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <span
                        class="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                        :class="
                          ctlSelected.has(p.id)
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'bg-background border-border'
                        "
                      >
                        <Check v-if="ctlSelected.has(p.id)" class="w-3 h-3" />
                      </span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-semibold truncate">{{ p.title }}</p>
                      <p class="text-[11px] text-muted-foreground mt-0.5">
                        ${{ formatPrice(p.price) }}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              <div class="bg-secondary/20 rounded-xl p-6 space-y-4">
                <div class="flex justify-between items-start">
                  <div>
                    <h3 class="font-medium mb-1">{{ $t('checkout.contact') }}</h3>
                    <p class="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Mail class="w-3.5 h-3.5" />
                      {{ formData.email }}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" @click="currentStep = 0">{{
                    $t('checkout.edit')
                  }}</Button>
                </div>
                <div class="h-px bg-border"></div>
                <div class="flex justify-between items-start">
                  <div>
                    <h3 class="font-medium mb-1">{{ $t('checkout.shippingTo') }}</h3>
                    <p class="text-sm text-muted-foreground">
                      {{ formData.firstName }} {{ formData.lastName }}
                    </p>
                    <p class="text-sm text-muted-foreground">{{ formData.address }}</p>
                    <p class="text-sm text-muted-foreground">
                      {{ formData.city }}, {{ formData.zip }}
                    </p>
                    <p class="text-sm text-muted-foreground">{{ formData.country }}</p>
                  </div>
                  <Button variant="ghost" size="sm" @click="currentStep = 0">{{
                    $t('checkout.edit')
                  }}</Button>
                </div>
                <div class="h-px bg-border"></div>
                <div class="flex justify-between items-start">
                  <div>
                    <h3 class="font-medium mb-1">{{ $t('checkout.paymentMethod') }}</h3>
                    <p class="text-sm text-muted-foreground flex items-center gap-2">
                      <CreditCard class="w-4 h-4" />
                      <template v-if="selectedSavedCard">
                        {{
                          $t('checkout.cardEnding', {
                            brand: selectedSavedCard.brand,
                            last4: selectedSavedCard.last4,
                          })
                        }}
                        <span class="text-xs text-muted-foreground"
                          >· {{ $t('checkout.savedCardBadge') }}</span
                        >
                      </template>
                      <template v-else>
                        {{
                          $t('checkout.cardEnding', {
                            brand: cardBrand || $t('checkout.cardGeneric'),
                            last4: formData.cardNumber.replace(/\s/g, '').slice(-4) || '****',
                          })
                        }}
                      </template>
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" @click="currentStep = 1">{{
                    $t('checkout.edit')
                  }}</Button>
                </div>
              </div>
            </div>

            <!-- Payment Error -->
            <ErrorState
              v-if="paymentErrorRef && currentStep === 2"
              :message="paymentErrorRef"
              @retry="handlePayment"
            />

            <!-- Navigation Buttons -->
            <div class="flex justify-between pt-6 border-t border-border">
              <Button v-if="currentStep > 0" variant="outline" @click="prevStep">
                {{ $t('checkout.back') }}
              </Button>
              <div v-else></div>

              <Button
                size="lg"
                data-testid="checkout-next"
                :disabled="isProcessing"
                class="px-8"
                @click="nextStep"
              >
                <span v-if="isProcessing" class="flex items-center gap-2">
                  <span
                    class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                  ></span>
                  {{ $t('checkout.processing') }}
                </span>
                <span v-else>{{
                  currentStep === steps.length - 1
                    ? $t('checkout.pay', { price: '$' + formatPrice(total) })
                    : $t('checkout.continue')
                }}</span>
              </Button>
            </div>
          </template>
        </div>

        <!-- Right Column: Order Summary -->
        <div class="lg:col-span-5">
          <div
            v-if="isLoadingRef"
            class="sticky top-24 bg-card border border-border rounded-2xl p-6 shadow-sm space-y-3"
          >
            <Skeleton class="h-6 w-32 rounded-md" />
            <Skeleton class="h-4 w-full rounded-md" />
            <Skeleton class="h-4 w-3/4 rounded-md" />
            <Skeleton class="h-12 w-full rounded-xl" />
          </div>
          <div v-else class="sticky top-24 bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 class="text-lg font-bold mb-4">{{ $t('cart.orderSummary') }}</h3>

            <div class="space-y-4 max-h-80 overflow-y-auto pr-2 mb-6 custom-scrollbar">
              <div
                v-for="item in checkoutItems"
                :key="item.cartItemId || item.id"
                class="flex gap-4"
              >
                <div class="w-16 h-16 rounded-md bg-secondary overflow-hidden flex-shrink-0">
                  <img :src="item.image" :alt="item.title" class="w-full h-full object-cover" />
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-medium line-clamp-1">{{ item.title }}</h4>
                  <p class="text-xs text-muted-foreground">{{ item.color }}</p>
                  <div class="flex justify-between items-center mt-1">
                    <p class="text-xs text-muted-foreground">
                      {{ $t('checkout.qty', { count: item.quantity }) }}
                    </p>
                    <p class="text-sm font-medium">
                      ${{ formatPrice(item.price * item.quantity) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <ErrorState
              v-if="!isLoadingRef && errorRef"
              :message="errorRef"
              @retry="fetchSummary"
            />
            <div v-else class="space-y-3 pt-4 border-t border-border">
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">{{ $t('cart.subtotal') }}</span>
                <span>${{ formatPrice(summaryRef.subtotal) }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">{{ $t('cart.shipping') }}</span>
                <span :class="summaryRef.shipping === 0 ? 'text-emerald-500' : ''">
                  {{
                    summaryRef.shipping === 0
                      ? $t('cart.free')
                      : `$${formatPrice(summaryRef.shipping)}`
                  }}
                </span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">{{ $t('cart.tax') }}</span>
                <span>${{ formatPrice(summaryRef.tax) }}</span>
              </div>
              <div v-if="tieredDiscount > 0" class="flex justify-between text-sm">
                <span class="text-muted-foreground">{{ $t('cart.tieredDiscount') }}</span>
                <span class="text-emerald-500">- ${{ formatPrice(tieredDiscount) }}</span>
              </div>
              <div v-if="promoDiscount > 0" class="flex justify-between text-sm">
                <span class="text-muted-foreground">{{ $t('cart.promoCode') }}</span>
                <span class="text-emerald-500">- ${{ formatPrice(promoDiscount) }}</span>
              </div>
              <div v-if="pointsDiscount > 0" class="flex justify-between text-sm">
                <span class="text-muted-foreground">{{ $t('checkout.loyaltyPoints') }}</span>
                <span class="text-emerald-500">- ${{ formatPrice(pointsDiscount) }}</span>
              </div>
              <div class="flex justify-between text-lg font-bold pt-2 border-t border-border">
                <span>{{ $t('cart.total') }}</span>
                <span class="text-primary">${{ formatPrice(total) }}</span>
              </div>
            </div>

            <!-- Promo code -->
            <div v-if="!promoApplied" class="flex gap-2 mt-4">
              <input
                v-model="promoCodeRef"
                type="text"
                :placeholder="$t('cart.promoPlaceholder')"
                class="flex-1 h-9 rounded-lg bg-secondary border border-transparent px-3 text-sm outline-none focus:border-primary transition-colors uppercase"
                @keyup.enter="onApplyPromo"
              />
              <Button size="sm" variant="outline" class="h-9" @click="onApplyPromo">{{
                $t('common.apply')
              }}</Button>
            </div>
            <div
              v-else
              class="mt-4 flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2"
            >
              <div class="flex items-center gap-2">
                <Tag class="w-4 h-4 text-emerald-600" />
                <span class="text-sm font-medium text-emerald-700 dark:text-emerald-400">{{
                  promoCodeRef.toUpperCase()
                }}</span>
                <span class="text-xs text-emerald-600">(-${{ formatPrice(promoDiscount) }})</span>
              </div>
              <button
                class="text-xs text-muted-foreground hover:text-destructive transition-colors"
                @click="removePromo"
              >
                {{ $t('common.remove') }}
              </button>
            </div>

            <!-- 积分抵扣（阶段 5.1） -->
            <div
              v-if="pointsUsable"
              class="mt-4 p-3 rounded-xl border border-primary/20 bg-primary/5"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2 text-sm font-medium">
                  <Sparkles class="w-4 h-4 text-primary" />
                  {{ $t('checkout.loyaltyPoints') }}
                </div>
                <span class="text-xs text-muted-foreground">{{
                  $t('checkout.pointsAvailable', { points: loyaltyStore.state.points })
                }}</span>
              </div>
              <p class="text-xs text-muted-foreground mb-2">{{ $t('checkout.pointsHint') }}</p>
              <div class="flex gap-2">
                <input
                  v-model.number="pointsToUse"
                  type="number"
                  min="0"
                  :max="maxPointsToUse"
                  :placeholder="String(POINTS_PER_DOLLAR)"
                  class="flex-1 h-9 rounded-lg bg-background border border-input px-3 text-sm outline-none focus:border-primary transition-colors"
                />
                <Button
                  size="sm"
                  variant="outline"
                  class="h-9"
                  @click="pointsToUse = maxPointsToUse"
                  >{{ $t('loyalty.useMax') }}</Button
                >
              </div>
              <div
                v-if="pointsDiscount > 0"
                class="flex justify-between text-xs text-muted-foreground mt-2"
              >
                <span>{{
                  $t('checkout.pointsApplied', { amount: pointsDiscount.toFixed(2) })
                }}</span>
                <button class="text-primary hover:underline" @click="pointsToUse = 0">
                  {{ $t('common.remove') }}
                </button>
              </div>
            </div>

            <!-- Available coupons from wallet -->
            <div v-if="!promoApplied && couponStore.available.length > 0" class="mt-3">
              <p class="text-xs text-muted-foreground mb-1.5">{{ $t('checkout.yourCoupons') }}</p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="c in couponStore.available.slice(0, 4)"
                  :key="c.id"
                  class="text-xs px-2 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                  @click="
                    () => {
                      promoCodeRef = c.code
                      onApplyPromo()
                    }
                  "
                >
                  {{ c.code }}
                </button>
                <router-link
                  to="/dashboard/coupons"
                  class="text-xs px-2 py-1 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  {{ $t('checkout.moreCoupons') }}
                </router-link>
              </div>
            </div>

            <div class="mt-6 grid grid-cols-3 gap-2 text-xs text-muted-foreground text-center">
              <div class="flex flex-col items-center gap-1">
                <ShieldCheck class="w-4 h-4" />
                <span>{{ $t('checkout.secure') }}</span>
              </div>
              <div class="flex flex-col items-center gap-1">
                <Truck class="w-4 h-4" />
                <span>{{ $t('checkout.freeShip') }}</span>
              </div>
              <div class="flex flex-col items-center gap-1">
                <CheckCircle2 class="w-4 h-4" />
                <span>{{ $t('checkout.verified') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 3DS 银行验证弹窗（阶段 2.1） -->
  <PaymentGatewayModal
    v-model="show3ds"
    :amount="total"
    :card-last4="formData.cardNumber.replace(/\s/g, '').slice(-4) || '****'"
    @complete="on3dsComplete"
    @reject="on3dsReject"
    @cancel="on3dsCancel"
  />
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

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCartStore } from '@/stores/cart'
import { useCouponStore } from '@/stores/coupons'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import Button from '@/components/ui/button/Button.vue'
import { CheckCircle2, CreditCard, Truck, ShieldCheck, Lock, MapPin, Tag, ChevronLeft, Mail, Sparkles, AlertTriangle, Check, Plus, Trash2 } from 'lucide-vue-next'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import ErrorState from '@/components/ui/state/ErrorState.vue'
import PaymentGatewayModal from '@/components/ui/payment/PaymentGatewayModal.vue'
import { calculateOrderSummary, applyPromoCode, type OrderSummary } from '@/api/modules/checkout'
import { createPaymentIntent, confirmPayment, completePaymentAction, getSavedPaymentMethods, savePaymentMethod, deleteSavedPaymentMethod, type SavedPaymentMethod } from '@/api/modules/payment'
import { getCompleteTheLook } from '@/api/modules/product'
import type { Product } from '@/types/product'
import { appendCheckoutOrder, type Order, type OrderItem } from '@/api/modules/orders'
import { USE_MOCK } from '@/config/env'
import { getAddresses, type Address } from '@/api/modules/address'
import { getProfile } from '@/api/modules/account'
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
    toast({ title: t('cart.empty'), description: t('checkout.cartEmptyDesc'), variant: 'destructive' })
    router.replace('/cart')
  }
  couponStore.load()
  loadCompleteTheLook()
  loadSavedCards()
})

// 注意：支付完成时清空购物车会触发本 watcher。isProcessing 在 finally 里同步复位，
// 而 watcher 回调要等微任务队列才执行，届时 isProcessing 已是 false，会把"支付成功跳转
// ThankYou"覆盖成回到 /cart。故用独立的 isCompletingOrder 标记，保持到路由跳转完成。
watch(checkoutItems, (items) => {
  if (items.length === 0 && !isProcessing.value && !isCompletingOrder.value) {
    router.replace('/cart')
  }
})

// ── Steps ──
const steps = computed(() => [t('checkout.stepShipping'), t('checkout.stepPayment'), t('checkout.stepReview')])
const currentStep = ref(0)
const isProcessing = ref(false)
/** 支付成功 → 清空购物车 → 跳转 ThankYou 期间置位，防止 checkoutItems 变空时 watcher 把页面重定向回购物车 */
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
    ctlSelected.value = new Set(items.map(p => p.id))
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
  return ctlProducts.value.filter(p => ctlSelected.value.has(p.id)).length
}

async function addCompleteTheLook() {
  if (ctlAdding.value) return
  const toAdd = ctlProducts.value.filter(p => ctlSelected.value.has(p.id))
  if (!toAdd.length) return
  ctlAdding.value = true
  try {
    toAdd.forEach(p => {
      cartStore.addItem(p, { color: p.colors?.[0]?.name ?? 'Default', size: p.sizes?.[0] ?? 'Standard', quantity: 1 })
    })
    toast({ title: t('checkout.addedToOrder'), description: `${toAdd.length} ${t('checkout.itemsCount', { count: toAdd.length })}`, variant: 'success' })
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
const selectedSavedCard = computed(() =>
  savedCards.value.find((c) => c.id === selectedSavedCardId.value) ?? null
)

function selectSavedCard(id: string) {
  selectedSavedCardId.value = selectedSavedCardId.value === id ? '' : id
}

function removeSavedCard(id: string) {
  const scope = savedCardsScope()
  if (!scope) return
  deleteSavedPaymentMethod(scope, id)
  savedCards.value = savedCards.value.filter(m => m.id !== id)
  if (selectedSavedCardId.value === id) selectedSavedCardId.value = ''
  toast({ title: t('checkout.savedCardRemoved'), variant: 'success' })
}

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
      if (!v) fieldErrors.email = t('checkout.errEmailRequired')
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fieldErrors.email = t('checkout.errEmailInvalid')
      break
    case 'firstName':
      if (!v) fieldErrors.firstName = t('checkout.errFirstNameRequired')
      break
    case 'lastName':
      if (!v) fieldErrors.lastName = t('checkout.errLastNameRequired')
      break
    case 'address':
      if (!v) fieldErrors.address = t('checkout.errAddressRequired')
      break
    case 'city':
      if (!v) fieldErrors.city = t('checkout.errCityRequired')
      break
    case 'zip':
      if (!v) fieldErrors.zip = t('checkout.errZipRequired')
      else if (!/^[A-Za-z0-9\s\-]{3,10}$/.test(v)) fieldErrors.zip = t('checkout.errZipInvalid')
      break
    case 'cardNumber': {
      const digits = formData.cardNumber.replace(/\s/g, '')
      if (!digits) fieldErrors.cardNumber = t('checkout.errCardRequired')
      else if (!/^\d{13,19}$/.test(digits)) fieldErrors.cardNumber = t('checkout.errCardInvalid')
      break
    }
    case 'expiry': {
      if (!v) fieldErrors.expiry = t('checkout.errExpiryRequired')
      else if (!/^\d{2}\/\d{2}$/.test(v)) fieldErrors.expiry = t('checkout.errExpiryFormat')
      else {
        const [mm, yy] = v.split('/').map(Number)
        if (mm < 1 || mm > 12) fieldErrors.expiry = t('checkout.errExpiryMonth')
        else {
          const now = new Date()
          const expDate = new Date(2000 + yy, mm)
          if (expDate <= now) fieldErrors.expiry = t('checkout.errExpiryExpired')
        }
      }
      break
    }
    case 'cvc':
      if (!v) fieldErrors.cvc = t('checkout.errCvcRequired')
      else if (!/^\d{3,4}$/.test(v)) fieldErrors.cvc = t('checkout.errCvcDigits')
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
  toast({ title: t('checkout.addressSelected'), description: t('checkout.addressLoadedDesc', { type: addr.type }) })
}

// ── Order summary & promo ──
// summaryRef.discount 为后端/mock 计算的满减自动折扣；promoDiscount 为手动优惠码（可叠加）
const summaryRef = ref<OrderSummary>({ subtotal: 0, shipping: 0, tax: 0, discount: 0, total: 0 })
const promoCodeRef = ref('')
const promoApplied = ref(false)
const promoDiscount = ref(0)
const tieredDiscount = computed(() => summaryRef.value.discount)

// ── 积分抵扣（阶段 5.1） ─────────────────────────────────────────────
// 未使用积分前的应付金额（subtotal + shipping + tax - 满减 - 优惠码）
const prePointsTotal = computed(() => +(
  summaryRef.value.subtotal + summaryRef.value.shipping + summaryRef.value.tax
  - summaryRef.value.discount - promoDiscount.value
).toFixed(2))
const pointsToUse = ref(0)
/** 100 积分 = $1，向下取整 */
const pointsDiscount = computed(() => Math.floor(pointsToUse.value / POINTS_PER_DOLLAR))
/** 最大可用积分：不超过余额，且抵扣额不超过应付金额 */
const maxPointsToUse = computed(() => {
  if (!authStore.isAuthenticated) return 0
  const byOrder = Math.floor(Math.max(0, prePointsTotal.value) * POINTS_PER_DOLLAR)
  return Math.min(loyaltyStore.state.points, byOrder)
})
const pointsUsable = computed(
  () => authStore.isAuthenticated && loyaltyStore.state.points >= POINTS_PER_DOLLAR
)

watch(pointsToUse, (v) => {
  if (!v) { pointsToUse.value = 0; return }
  let next = v
  if (next > maxPointsToUse.value) next = maxPointsToUse.value
  next = Math.floor(next / POINTS_PER_DOLLAR) * POINTS_PER_DOLLAR
  if (next !== v) pointsToUse.value = next
})

const total = computed(() => +(prePointsTotal.value - pointsDiscount.value).toFixed(2))

const isLoadingRef = ref<boolean>(true)
const errorRef = ref<string>('')
const paymentErrorRef = ref<string>('')

// ── 支付网关状态（阶段 2.1）──
const show3ds = ref(false)
const pendingIntent = ref<{ paymentId: string; orderId: string } | null>(null)
const last3dsTxn = ref('')

/** 拒付错误码 → 本地化提示 */
function paymentErrorMessage(code: string | undefined, fallback?: string) {
  switch (code) {
    case 'card_declined': return t('checkout.declinedCard')
    case 'insufficient_funds': return t('checkout.declinedInsufficient')
    default: return fallback || t('checkout.paymentNotCompleted')
  }
}

async function fetchSummary() {
  try {
    isLoadingRef.value = true
    errorRef.value = ''
    const s = await calculateOrderSummary(checkoutItems.value, formData.zip)
    summaryRef.value = s
  } catch (e: any) {
    errorRef.value = e?.message || t('checkout.calcFailedDesc')
    toast({ title: t('checkout.calcFailed'), description: errorRef.value, variant: 'destructive' })
  } finally {
    isLoadingRef.value = false
  }
}

async function onApplyPromo() {
  const code = promoCodeRef.value.trim()
  if (!code) {
    toast({ title: t('cart.enterCode'), description: t('cart.enterCodeDesc'), variant: 'destructive' })
    return
  }
  if (promoApplied.value) {
    toast({ title: t('cart.alreadyApplied'), description: t('checkout.alreadyAppliedDesc'), variant: 'destructive' })
    return
  }
  try {
    const { discount } = await applyPromoCode(code, summaryRef.value.subtotal)
    if (discount <= 0) {
      toast({ title: t('cart.invalidCode'), description: t('cart.invalidCodeDesc'), variant: 'destructive' })
      return
    }
    promoApplied.value = true
    promoDiscount.value = discount
    toast({ title: t('cart.promoApplied'), description: t('cart.promoAppliedDesc', { discount: discount.toFixed(2) }), variant: 'success' })
  } catch (e: any) {
    toast({ title: t('cart.invalidCode'), description: e?.message || t('cart.tryAnotherCode'), variant: 'destructive' })
  }
}

function removePromo() {
  promoApplied.value = false
  promoDiscount.value = 0
  promoCodeRef.value = ''
  toast({ title: t('cart.promoRemoved'), description: t('cart.promoRemovedDesc') })
}

// ── Init ──
onMounted(async () => {
  try {
    const prefill = localStorage.getItem('DEBUG_CHECKOUT_PREFILL')
    if (prefill) {
      const data = JSON.parse(prefill)
      Object.assign(formData, data)
      toast({ title: t('checkout.prefilledDev'), description: t('checkout.prefilledDevDesc'), variant: 'success' })
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

          toast({ title: t('checkout.defaultAddressLoaded'), description: t('checkout.defaultAddressLoadedDesc'), variant: 'default' })
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
    toast({ title: t('checkout.incompleteShipping'), description: t('checkout.incompleteShippingDesc'), variant: 'destructive' })
    return
  }
  // 已选保存卡时无需填卡表单，跳过卡字段校验（阶段 2.2 一键下单）
  if (currentStep.value === 1 && !isUsingSavedCard() && !validatePayment()) {
    toast({ title: t('checkout.invalidPayment'), description: t('checkout.invalidPaymentDesc'), variant: 'destructive' })
    return
  }
  if (currentStep.value < steps.value.length - 1) currentStep.value++
  else handlePayment()
}

const prevStep = () => {
  if (currentStep.value > 0) currentStep.value--
}

// ── Payment（阶段 2.1：网关化：成功 / 拒付重试 / 3DS 认证） ──
const handlePayment = async () => {
  if (isProcessing.value) return
  try {
    paymentErrorRef.value = ''
    isProcessing.value = true
    const payload = {
      // 只传商品 id + 数量;金额由服务端按 DB 价格重算(/checkout/summary 已同源)
      items: checkoutItems.value.map(it => ({ productId: it.id, quantity: it.quantity })),
      amount: total.value,
      currency: 'USD',
      // 模拟银行卡网关;cartItemIds 让后端下单成功后清除对应购物车行(仅登录态有 serverId)
      channel: 'card',
      cartItemIds: checkoutItems.value.map(it => it.serverId).filter((id): id is number => !!id),
      shipping: {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        address: formData.address,
        city: formData.city,
        zip: formData.zip,
        country: formData.country
      }
    }
    const intent = await createPaymentIntent(payload)
    // 已选保存卡（阶段 2.2 一键下单）：以 token 扣款；否则走完整卡号网关路由
    const used = selectedSavedCard.value
    const digits = used ? '' : formData.cardNumber.replace(/\s/g, '')
    const result = await confirmPayment({
      paymentId: intent.paymentId,
      method: 'card',
      ...(used
        ? { savedMethodId: used.id, cardLast4: used.last4 }
        : { cardNumber: digits, cardLast4: digits.slice(-4) })
    })

    if (result.status === 'requires_action') {
      // 3DS：打开银行验证弹窗，等待用户完成认证（流程在 on3dsComplete 继续）
      pendingIntent.value = { paymentId: intent.paymentId, orderId: intent.orderId }
      last3dsTxn.value = result.action?.transactionId || ''
      show3ds.value = true
      return
    }

    if (result.status === 'failed') {
      // 拒付：回到支付表单展示错误，允许改卡重试
      const msg = paymentErrorMessage(result.errorCode, result.errorMessage)
      paymentErrorRef.value = msg
      toast({ title: t('checkout.paymentFailed'), description: msg, variant: 'destructive' })
      currentStep.value = 1
      return
    }

    await finalizeOrder(result.orderId || intent.orderId)
  } catch (e: any) {
    paymentErrorRef.value = e?.message || t('checkout.paymentFailedDesc')
    toast({ title: t('checkout.paymentFailed'), description: paymentErrorRef.value, variant: 'destructive' })
  } finally {
    isCompletingOrder.value = false
    isProcessing.value = false
  }
}

/** 3DS 认证成功：银行回调确认后完成下单 */
const on3dsComplete = async () => {
  const intent = pendingIntent.value
  const txn = last3dsTxn.value
  pendingIntent.value = null
  show3ds.value = false
  if (!intent) return
  isProcessing.value = true
  try {
    const res = await completePaymentAction({ paymentId: intent.paymentId, transactionId: txn })
    if (res.status === 'failed') {
      const msg = paymentErrorMessage(res.errorCode, res.errorMessage)
      paymentErrorRef.value = msg
      toast({ title: t('checkout.paymentFailed'), description: msg, variant: 'destructive' })
      currentStep.value = 1
      return
    }
    await finalizeOrder(res.orderId || intent.orderId)
  } catch (e: any) {
    paymentErrorRef.value = e?.message || t('checkout.paymentFailedDesc')
    toast({ title: t('checkout.paymentFailed'), description: paymentErrorRef.value, variant: 'destructive' })
  } finally {
    isCompletingOrder.value = false
    isProcessing.value = false
  }
}

/** 3DS 认证失败（银行拒绝） */
const on3dsReject = () => {
  pendingIntent.value = null
  show3ds.value = false
  paymentErrorRef.value = t('checkout.authFailed')
  toast({ title: t('checkout.paymentFailed'), description: paymentErrorRef.value, variant: 'destructive' })
  currentStep.value = 1
}

/** 用户主动关闭 3DS 弹窗：放弃认证，留在当前步骤，可重新发起支付 */
const on3dsCancel = () => {
  pendingIntent.value = null
  show3ds.value = false
}

/** 支付成功 → 落单 → 积分入账 → 清空购物车 → 跳转 ThankYou */
const finalizeOrder = async (finalOrderId: string) => {
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
  // 已选保存卡时以保存的卡信息展示，否则用当前输入卡号
  const usedCard = selectedSavedCard.value
  const digits = usedCard ? usedCard.last4 : formData.cardNumber.replace(/\s/g, '')
  const first = digits[0]
  const orderCardBrand = usedCard?.brand ?? (first === '4' ? 'Visa' : first === '5' ? 'Mastercard' : 'Card')
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
      zip: formData.zip || ''
    },
    payment: {
      method: 'card',
      cardBrand: orderCardBrand,
      cardLast4: usedCard ? usedCard.last4 : digits.slice(-4),
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

  // 阶段 2.2：勾选「保存此卡」且本次用新卡支付成功 → token 化保存，下次一键下单
  if (saveCardForNextTime.value && !usedCard && authStore.user?.id) {
    const saveDigits = formData.cardNumber.replace(/\s/g, '')
    const saveExp = formData.expiry.replace(/[^\d]/g, '')
    const saveBrand = /^4/.test(saveDigits) ? 'Visa'
      : (/^5[1-5]/.test(saveDigits) || /^2[2-7]/.test(saveDigits)) ? 'Mastercard'
      : /^3[47]/.test(saveDigits) ? 'Amex'
      : /^6(?:011|5)/.test(saveDigits) ? 'Discover' : 'Card'
    savePaymentMethod(authStore.user.id, {
      brand: saveBrand,
      last4: saveDigits.slice(-4),
      expMonth: saveExp.slice(0, 2),
      expYear: saveExp.slice(2)
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

  toast({ title: t('checkout.orderConfirmed'), description: t('checkout.orderConfirmedDesc'), variant: 'success' })

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
    }
  })
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
            <h2 class="text-2xl font-bold">{{ $t('checkout.shippingDetails') }}</h2>

            <!-- Saved address picker -->
            <div v-if="savedAddresses.length > 1" class="space-y-3">
              <button
                @click="showAddressPicker = !showAddressPicker"
                class="text-sm text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors"
              >
                <MapPin class="w-4 h-4" />
                {{ showAddressPicker ? $t('checkout.hideAddresses') : $t('checkout.chooseAddresses') }}
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
                    <span v-if="addr.isDefault" class="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">{{ $t('checkout.defaultBadge') }}</span>
                  </div>
                  <p class="text-muted-foreground text-xs">{{ addr.name }}</p>
                  <p class="text-muted-foreground text-xs">{{ addr.address }}</p>
                  <p class="text-muted-foreground text-xs">{{ addr.city }}, {{ addr.zip }}</p>
                </button>
              </div>
            </div>

            <div class="space-y-4">
              <div class="space-y-1">
                <label class="text-sm font-medium">{{ $t('checkout.emailAddress') }} <span class="text-red-500">*</span></label>
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
                  <label class="text-sm font-medium">{{ $t('checkout.firstName') }} <span class="text-red-500">*</span></label>
                  <input
                    v-model="formData.firstName"
                    type="text"
                    :class="inputClass('firstName')"
                    @blur="markTouched('firstName')"
                  />
                  <p v-if="fieldTouched.firstName && fieldErrors.firstName" class="text-xs text-red-500 mt-0.5">{{ fieldErrors.firstName }}</p>
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium">{{ $t('checkout.lastName') }} <span class="text-red-500">*</span></label>
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
                <label class="text-sm font-medium">{{ $t('checkout.address') }} <span class="text-red-500">*</span></label>
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
                  <label class="text-sm font-medium">{{ $t('checkout.city') }} <span class="text-red-500">*</span></label>
                  <input
                    v-model="formData.city"
                    type="text"
                    :class="inputClass('city')"
                    @blur="markTouched('city')"
                  />
                  <p v-if="fieldTouched.city && fieldErrors.city" class="text-xs text-red-500 mt-0.5">{{ fieldErrors.city }}</p>
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium">{{ $t('checkout.zipCode') }} <span class="text-red-500">*</span></label>
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
          <div v-if="currentStep === 1" class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 class="text-2xl font-bold">{{ $t('checkout.paymentMethod') }}</h2>

            <div class="p-4 border border-primary/20 bg-primary/5 rounded-xl flex items-center gap-4 mb-6">
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
                :class="selectedSavedCardId === c.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-card hover:border-primary/40'"
                :data-saved-card="c.id"
                @click="selectSavedCard(c.id)"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <CreditCard class="w-5 h-5" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-medium flex items-center gap-2">
                      {{ c.brand }}
                      <span class="font-mono text-muted-foreground">•••• {{ c.last4 }}</span>
                    </p>
                    <p class="text-xs text-muted-foreground">Expires {{ c.expMonth }}/{{ c.expYear }}</p>
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
            <div v-if="paymentErrorRef && currentStep === 1" class="p-4 border border-red-500/30 bg-red-500/5 rounded-xl flex items-start gap-3 mb-6 animate-in fade-in duration-200">
              <AlertTriangle class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div class="min-w-0">
                <p class="text-sm font-medium text-red-600 dark:text-red-400">{{ paymentErrorRef }}</p>
                <p class="text-xs text-muted-foreground mt-0.5">{{ $t('checkout.paymentErrorHint') }}</p>
              </div>
            </div>

            <div v-if="!isUsingSavedCard()" class="space-y-4">
              <div class="space-y-1">
                <label class="text-sm font-medium">{{ $t('checkout.cardNumber') }} <span class="text-red-500">*</span></label>
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
                  <label class="text-sm font-medium">{{ $t('checkout.expiryDate') }} <span class="text-red-500">*</span></label>
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
                  <label class="text-sm font-medium">{{ $t('checkout.cvc') }} <span class="text-red-500">*</span></label>
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

              <!-- 保存此卡：勾选后支付成功自动 token 化保存，下次一键下单（阶段 2.2） -->
              <label
                v-if="authStore.isAuthenticated"
                class="flex items-center gap-2 text-sm cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  v-model="saveCardForNextTime"
                  class="w-4 h-4 accent-primary"
                  data-save-card-checkbox
                />
                {{ $t('checkout.saveCardForNextTime') }}
              </label>
            </div>
          </div>

          <!-- Step 3: Review -->
          <div v-if="currentStep === 2" class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 class="text-2xl font-bold">{{ $t('checkout.reviewOrder') }}</h2>

            <!-- Order items -->
            <div class="space-y-3">
              <h3 class="text-sm font-medium text-muted-foreground">{{ $t('checkout.itemsCount', { count: checkoutItems.length }) }}</h3>
              <div v-for="item in checkoutItems" :key="item.cartItemId || item.id" class="flex gap-3 p-3 rounded-lg border border-border bg-card/50">
                <div class="w-14 h-14 rounded-md bg-secondary overflow-hidden flex-shrink-0">
                  <img :src="item.image" :alt="item.title" class="w-full h-full object-cover" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{{ item.title }}</p>
                  <p class="text-xs text-muted-foreground">{{ item.color }} / {{ item.size || $t('cart.optionStandard') }} &middot; {{ $t('checkout.qty', { count: item.quantity }) }}</p>
                </div>
                <p class="text-sm font-medium flex-shrink-0">${{ formatPrice(item.price * item.quantity) }}</p>
              </div>
            </div>

            <!-- Complete the Look（阶段 1.1）：追加购买推荐 -->
            <div v-if="ctlProducts.length > 0" class="rounded-2xl border border-border bg-card/60 p-4 space-y-3" data-testid="complete-the-look">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h3 class="text-sm font-bold flex items-center gap-2">
                    <Sparkles class="w-4 h-4 text-primary" />
                    {{ $t('checkout.completeTheLook') }}
                  </h3>
                  <p class="text-xs text-muted-foreground mt-0.5">{{ $t('checkout.completeTheLookDesc') }}</p>
                </div>
                <Button
                  size="sm"
                  :disabled="ctlSelectedCount() === 0 || ctlAdding"
                  @click="addCompleteTheLook"
                  class="shrink-0"
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
                  @click="toggleCtl(p.id)"
                  class="flex items-center gap-2.5 p-2 rounded-xl border text-left transition-colors"
                  :class="ctlSelected.has(p.id) ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/30 bg-background'"
                >
                  <div class="relative w-12 h-12 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                    <img :src="p.image" :alt="p.title" class="w-full h-full object-cover" loading="lazy" />
                    <span
                      class="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                      :class="ctlSelected.has(p.id) ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-border'"
                    >
                      <Check v-if="ctlSelected.has(p.id)" class="w-3 h-3" />
                    </span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold truncate">{{ p.title }}</p>
                    <p class="text-[11px] text-muted-foreground mt-0.5">${{ formatPrice(p.price) }}</p>
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
                <Button variant="ghost" size="sm" @click="currentStep = 0">{{ $t('checkout.edit') }}</Button>
              </div>
              <div class="h-px bg-border"></div>
              <div class="flex justify-between items-start">
                 <div>
                   <h3 class="font-medium mb-1">{{ $t('checkout.shippingTo') }}</h3>
                   <p class="text-sm text-muted-foreground">{{ formData.firstName }} {{ formData.lastName }}</p>
                   <p class="text-sm text-muted-foreground">{{ formData.address }}</p>
                   <p class="text-sm text-muted-foreground">{{ formData.city }}, {{ formData.zip }}</p>
                   <p class="text-sm text-muted-foreground">{{ formData.country }}</p>
                 </div>
                 <Button variant="ghost" size="sm" @click="currentStep = 0">{{ $t('checkout.edit') }}</Button>
              </div>
              <div class="h-px bg-border"></div>
              <div class="flex justify-between items-start">
                 <div>
                   <h3 class="font-medium mb-1">{{ $t('checkout.paymentMethod') }}</h3>
                   <p class="text-sm text-muted-foreground flex items-center gap-2">
                     <CreditCard class="w-4 h-4" />
                     <template v-if="selectedSavedCard">
                       {{ $t('checkout.cardEnding', { brand: selectedSavedCard.brand, last4: selectedSavedCard.last4 }) }}
                       <span class="text-xs text-muted-foreground">· {{ $t('checkout.savedCardBadge') }}</span>
                     </template>
                     <template v-else>
                       {{ $t('checkout.cardEnding', { brand: cardBrand || $t('checkout.cardGeneric'), last4: formData.cardNumber.replace(/\s/g, '').slice(-4) || '****' }) }}
                     </template>
                   </p>
                 </div>
                 <Button variant="ghost" size="sm" @click="currentStep = 1">{{ $t('checkout.edit') }}</Button>
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
              {{ $t('checkout.back') }}
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
                {{ $t('checkout.processing') }}
              </span>
              <span v-else>{{ currentStep === steps.length - 1 ? $t('checkout.pay', { price: '$' + formatPrice(total) }) : $t('checkout.continue') }}</span>
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
            <h3 class="text-lg font-bold mb-4">{{ $t('cart.orderSummary') }}</h3>

            <div class="space-y-4 max-h-80 overflow-y-auto pr-2 mb-6 custom-scrollbar">
              <div v-for="item in checkoutItems" :key="item.cartItemId || item.id" class="flex gap-4">
                <div class="w-16 h-16 rounded-md bg-secondary overflow-hidden flex-shrink-0">
                  <img :src="item.image" :alt="item.title" class="w-full h-full object-cover" />
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-medium line-clamp-1">{{ item.title }}</h4>
                  <p class="text-xs text-muted-foreground">{{ item.color }}</p>
                  <div class="flex justify-between items-center mt-1">
                    <p class="text-xs text-muted-foreground">{{ $t('checkout.qty', { count: item.quantity }) }}</p>
                    <p class="text-sm font-medium">${{ formatPrice(item.price * item.quantity) }}</p>
                  </div>
                </div>
              </div>
            </div>

            <ErrorState v-if="!isLoadingRef && errorRef" :message="errorRef" @retry="fetchSummary" />
            <div v-else class="space-y-3 pt-4 border-t border-border">
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">{{ $t('cart.subtotal') }}</span>
                <span>${{ formatPrice(summaryRef.subtotal) }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">{{ $t('cart.shipping') }}</span>
                <span :class="summaryRef.shipping === 0 ? 'text-emerald-500' : ''">
                  {{ summaryRef.shipping === 0 ? $t('cart.free') : `$${formatPrice(summaryRef.shipping)}` }}
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
              <Button size="sm" variant="outline" class="h-9" @click="onApplyPromo">{{ $t('common.apply') }}</Button>
            </div>
            <div v-else class="mt-4 flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
              <div class="flex items-center gap-2">
                <Tag class="w-4 h-4 text-emerald-600" />
                <span class="text-sm font-medium text-emerald-700 dark:text-emerald-400">{{ promoCodeRef.toUpperCase() }}</span>
                <span class="text-xs text-emerald-600">(-${{ formatPrice(promoDiscount) }})</span>
              </div>
              <button @click="removePromo" class="text-xs text-muted-foreground hover:text-destructive transition-colors">{{ $t('common.remove') }}</button>
            </div>

            <!-- 积分抵扣（阶段 5.1） -->
            <div v-if="pointsUsable" class="mt-4 p-3 rounded-xl border border-primary/20 bg-primary/5">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2 text-sm font-medium">
                  <Sparkles class="w-4 h-4 text-primary" />
                  {{ $t('checkout.loyaltyPoints') }}
                </div>
                <span class="text-xs text-muted-foreground">{{ $t('checkout.pointsAvailable', { points: loyaltyStore.state.points }) }}</span>
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
                <Button size="sm" variant="outline" class="h-9" @click="pointsToUse = maxPointsToUse">{{ $t('loyalty.useMax') }}</Button>
              </div>
              <div v-if="pointsDiscount > 0" class="flex justify-between text-xs text-muted-foreground mt-2">
                <span>{{ $t('checkout.pointsApplied', { amount: pointsDiscount.toFixed(2) }) }}</span>
                <button @click="pointsToUse = 0" class="text-primary hover:underline">{{ $t('common.remove') }}</button>
              </div>
            </div>

            <!-- Available coupons from wallet -->
            <div v-if="!promoApplied && couponStore.available.length > 0" class="mt-3">
              <p class="text-xs text-muted-foreground mb-1.5">{{ $t('checkout.yourCoupons') }}</p>
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

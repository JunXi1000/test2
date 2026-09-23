import { computed, nextTick, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { getAddresses, type Address } from '@/api/modules/address'
import { getProfile } from '@/api/modules/account'

/** 国家下拉的静态列表。放模块作用域：它不随实例变化，没必要每次调用重建 */
const COUNTRIES = [
  'United States',
  'Canada',
  'United Kingdom',
  'Australia',
  'Germany',
  'France',
  'Japan',
  'South Korea',
  'China',
  'India',
  'Brazil',
  'Mexico',
  'Singapore',
  'Netherlands',
  'Sweden',
]

/**
 * 结算页的收货 / 支付表单：字段、逐字段校验、卡号掩码、已存地址选择、以及首屏预填。
 *
 * **不接参数** —— 它要的状态全是自己的；唯一的外部依赖 authStore 是全局 store，直接 import
 * （与页面现有写法一致）。页面只需要 `formData` 的读权限给 finalizeOrder 与支付组合式用。
 *
 * 首屏预填（`loadInitialData`）也放这里，因为它整块只写 formData / savedAddresses；
 * 但**不带 fetchSummary** —— 订单摘要是页面的事，页面在 onMounted 里自己接着调。
 */
export function useCheckoutForm() {
  const { t } = useI18n()
  const { toast } = useToast()
  const authStore = useAuthStore()

  // ── 表单字段 ──
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
    cvc: '',
  })

  // ── 逐字段校验 ──
  const fieldErrors = reactive<Record<string, string>>({})
  const fieldTouched = reactive<Record<string, boolean>>({})

  function markTouched(field: string) {
    fieldTouched[field] = true
    validateField(field)
  }

  function validateField(field: string) {
    delete fieldErrors[field]
    // formData 的每个字段都是字符串；未知字段取到 undefined，由 ?. 兜成空串
    const v = (formData as Record<string, string>)[field]?.trim() ?? ''

    switch (field) {
      case 'email':
        if (!v) fieldErrors.email = t('checkout.errEmailRequired')
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
          fieldErrors.email = t('checkout.errEmailInvalid')
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
        // 连字符在字符类末尾无需转义（原写法 \s\- 触发 no-useless-escape，语义相同）
        else if (!/^[A-Za-z0-9\s-]{3,10}$/.test(v)) fieldErrors.zip = t('checkout.errZipInvalid')
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

  /** 校验整组字段并返回是否通过；副作用是把这些字段标为 touched（让模板显示错误） */
  function validateFields(fields: string[]): boolean {
    fields.forEach((f) => {
      fieldTouched[f] = true
      validateField(f)
    })
    return !fields.some((f) => fieldErrors[f])
  }

  const validateShipping = () =>
    validateFields(['email', 'firstName', 'lastName', 'address', 'city', 'zip'])

  const validatePayment = () => validateFields(['cardNumber', 'expiry', 'cvc'])

  // ── 卡号 / 有效期 / CVC 掩码 ──
  // 三个函数都要写回 input.value：受控值被改成带空格的格式后，DOM 里的光标位置会跟着跳，
  // 所以 nextTick 里再写一次，和 formData 保持一致。
  function onCardNumberInput(e: Event) {
    const input = e.target as HTMLInputElement
    const raw = input.value.replace(/\D/g, '').slice(0, 16)
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ')
    formData.cardNumber = formatted
    nextTick(() => {
      input.value = formatted
    })
    if (fieldTouched.cardNumber) validateField('cardNumber')
  }

  function onExpiryInput(e: Event) {
    const input = e.target as HTMLInputElement
    let raw = input.value.replace(/\D/g, '').slice(0, 4)
    if (raw.length >= 3) raw = raw.slice(0, 2) + '/' + raw.slice(2)
    formData.expiry = raw
    nextTick(() => {
      input.value = raw
    })
    if (fieldTouched.expiry) validateField('expiry')
  }

  function onCvcInput(e: Event) {
    const input = e.target as HTMLInputElement
    const raw = input.value.replace(/\D/g, '').slice(0, 4)
    formData.cvc = raw
    nextTick(() => {
      input.value = raw
    })
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

  // ── 已存地址 ──
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
    ;['address', 'city', 'zip', 'firstName', 'lastName'].forEach((f) => delete fieldErrors[f])
    toast({
      title: t('checkout.addressSelected'),
      description: t('checkout.addressLoadedDesc', { type: addr.type }),
    })
  }

  /**
   * 首屏预填：调试钩子优先，否则登录态下拉资料与默认地址。
   *
   * 外层 try 包住整个流程却不吞内层已处理的错误 —— 它挡的是 `JSON.parse` 抛出的坏数据
   * （localStorage 里被人手改过）。内层 catch 只处理取资料失败。
   */
  async function loadInitialData() {
    try {
      const prefill = localStorage.getItem('DEBUG_CHECKOUT_PREFILL')
      if (prefill) {
        const data = JSON.parse(prefill)
        Object.assign(formData, data)
        toast({
          title: t('checkout.prefilledDev'),
          description: t('checkout.prefilledDevDesc'),
          variant: 'success',
        })
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

          const defaultAddress = addresses.find((a) => a.isDefault)
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

            toast({
              title: t('checkout.defaultAddressLoaded'),
              description: t('checkout.defaultAddressLoadedDesc'),
              variant: 'default',
            })
          }
        } catch (e) {
          console.error('Failed to load user data for checkout', e)
        }
      }
    } catch {
      // 只有 JSON.parse 会走到这（localStorage 里的调试数据被人手改坏）。
      // 吞掉是有意的：预填失败不该让整个结算页白屏，表单保持空值即可。
    }
  }

  return {
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
    countries: COUNTRIES,
    savedAddresses,
    selectedAddressId,
    showAddressPicker,
    pickAddress,
    loadInitialData,
  }
}

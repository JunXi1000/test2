import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useCheckoutForm } from './useCheckoutForm'
import { useAuthStore, type User } from '@/stores/auth'
import { useToast } from './useToast'
import type { Address } from '@/api/modules/address'

/**
 * 表单校验的钉子在这里。这批规则（卡号位数、有效期月份边界、过期判定、邮编字符集）
 * 在 E2E 里只走得到 happy path —— main-flow 填的都是合法值，"过期卡"和"邮编格式"
 * 这类分支没有任何测试碰过。校验是纯函数，单测比 E2E 便宜也更准。
 */

const mocks = vi.hoisted(() => ({
  getAddresses: vi.fn(),
  getProfile: vi.fn(),
}))

vi.mock('@/api/modules/address', () => ({ getAddresses: mocks.getAddresses }))
vi.mock('@/api/modules/account', () => ({ getProfile: mocks.getProfile }))

// t 返回 key：断言里写的 'checkout.errExpiryExpired' 就是页面渲染文案的来源
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

/** 造一个 change/input 事件：处理函数只读 target.value，然后回写 target.value */
function inputEvent(value: string) {
  const input = document.createElement('input')
  input.value = value
  return { event: { target: input } as unknown as Event, input }
}

function login(auth: ReturnType<typeof useAuthStore>) {
  auth.user = { id: '1', name: 'Alex', email: 'a@b.c', role: 'user' } as User
  auth.token = 'tok'
}

const ADDRESS: Address = {
  id: 5,
  type: 'Home',
  isDefault: true,
  name: 'Alex Doe',
  phone: '555-0100',
  address: '1 Main St',
  city: 'Springfield',
  state: 'IL',
  zip: '12345',
  country: 'United States',
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  useToast().toasts.value.splice(0)
  mocks.getAddresses.mockResolvedValue([])
  mocks.getProfile.mockResolvedValue(null)
})

describe('useCheckoutForm — 校验', () => {
  it('邮箱：必填、格式、通过三态', () => {
    const { formData, fieldErrors, validateField } = useCheckoutForm()

    validateField('email')
    expect(fieldErrors.email).toBe('checkout.errEmailRequired')

    formData.email = 'not-an-email'
    validateField('email')
    expect(fieldErrors.email).toBe('checkout.errEmailInvalid')

    formData.email = 'a@b.co'
    validateField('email')
    expect(fieldErrors.email).toBeUndefined()
  })

  it('重复校验会先清掉上一次的错误，不会留残留', () => {
    const { formData, fieldErrors, validateField } = useCheckoutForm()

    validateField('city')
    expect(fieldErrors.city).toBe('checkout.errCityRequired')
    formData.city = 'Springfield'
    validateField('city')
    expect(fieldErrors.city).toBeUndefined()
  })

  it('有效期：月>12 报月份错，不是笼统的格式错', () => {
    const { formData, fieldErrors, validateField } = useCheckoutForm()

    formData.expiry = '13/30'
    validateField('expiry')
    expect(fieldErrors.expiry).toBe('checkout.errExpiryMonth')
  })

  it('有效期：格式不对（缺前导零）报格式错', () => {
    const { formData, fieldErrors, validateField } = useCheckoutForm()

    formData.expiry = '1/30'
    validateField('expiry')
    expect(fieldErrors.expiry).toBe('checkout.errExpiryFormat')
  })

  it('有效期：已过期的卡报过期，未来的卡通过', () => {
    const { formData, fieldErrors, validateField } = useCheckoutForm()

    formData.expiry = '01/20'
    validateField('expiry')
    expect(fieldErrors.expiry).toBe('checkout.errExpiryExpired')

    formData.expiry = '12/99'
    validateField('expiry')
    expect(fieldErrors.expiry).toBeUndefined()
  })

  it('卡号：必填、位数不足、通过', () => {
    const { formData, fieldErrors, validateField } = useCheckoutForm()

    validateField('cardNumber')
    expect(fieldErrors.cardNumber).toBe('checkout.errCardRequired')

    formData.cardNumber = '4242'
    validateField('cardNumber')
    expect(fieldErrors.cardNumber).toBe('checkout.errCardInvalid')

    // 带空格的完整卡号要能通过 —— 校验前先剥掉空格
    formData.cardNumber = '4242 4242 4242 4242'
    validateField('cardNumber')
    expect(fieldErrors.cardNumber).toBeUndefined()
  })

  it('CVC：2 位不通过，3 位与 4 位都通过（Amex）', () => {
    const { formData, fieldErrors, validateField } = useCheckoutForm()

    formData.cvc = '12'
    validateField('cvc')
    expect(fieldErrors.cvc).toBe('checkout.errCvcDigits')

    formData.cvc = '123'
    validateField('cvc')
    expect(fieldErrors.cvc).toBeUndefined()

    formData.cvc = '1234'
    validateField('cvc')
    expect(fieldErrors.cvc).toBeUndefined()
  })

  it('邮编：2 位太短、含非法字符都不通过；带连字符的 5+4 通过', () => {
    const { formData, fieldErrors, validateField } = useCheckoutForm()

    formData.zip = '12'
    validateField('zip')
    expect(fieldErrors.zip).toBe('checkout.errZipInvalid')

    formData.zip = 'ab!!'
    validateField('zip')
    expect(fieldErrors.zip).toBe('checkout.errZipInvalid')

    // 这条钉住连字符：原来写的是 \s\-，搬进新文件后被 no-useless-escape 判为多余转义
    formData.zip = '12345-6789'
    validateField('zip')
    expect(fieldErrors.zip).toBeUndefined()
  })

  it('validateShipping 覆盖 6 个字段并全部标为 touched（否则模板不显示错误）', () => {
    const { fieldTouched, validateShipping } = useCheckoutForm()

    expect(validateShipping()).toBe(false)
    for (const f of ['email', 'firstName', 'lastName', 'address', 'city', 'zip']) {
      expect(fieldTouched[f]).toBe(true)
    }
  })

  it('validateShipping 填全后通过', () => {
    const { formData, validateShipping } = useCheckoutForm()

    Object.assign(formData, {
      email: 'a@b.co',
      firstName: 'Alex',
      lastName: 'Doe',
      address: '1 Main St',
      city: 'Springfield',
      zip: '12345',
    })

    expect(validateShipping()).toBe(true)
  })

  it('validatePayment 只看卡三个字段，不碰收货字段', () => {
    const { formData, fieldTouched, validatePayment } = useCheckoutForm()

    expect(validatePayment()).toBe(false)
    expect(fieldTouched.cardNumber).toBe(true)
    expect(fieldTouched.email).toBeUndefined()

    Object.assign(formData, { cardNumber: '4242424242424242', expiry: '12/99', cvc: '123' })
    expect(validatePayment()).toBe(true)
  })
})

describe('useCheckoutForm — 输入掩码', () => {
  it('卡号：剥非数字、每 4 位空格分组、截到 16 位，并把格式化结果写回 input', async () => {
    const { formData, onCardNumberInput } = useCheckoutForm()

    const { event, input } = inputEvent('4242-4242 4242_4242 9999')
    onCardNumberInput(event)
    await nextTick()

    expect(formData.cardNumber).toBe('4242 4242 4242 4242')
    expect(input.value).toBe('4242 4242 4242 4242')
  })

  it('有效期：满 3 位就插斜杠，最多 4 位', async () => {
    const { formData, onExpiryInput } = useCheckoutForm()

    const first = inputEvent('12')
    onExpiryInput(first.event)
    await nextTick()
    expect(formData.expiry).toBe('12')

    const second = inputEvent('1230')
    onExpiryInput(second.event)
    await nextTick()
    expect(formData.expiry).toBe('12/30')

    const third = inputEvent('123099')
    onExpiryInput(third.event)
    await nextTick()
    expect(formData.expiry).toBe('12/30')
  })

  it('CVC：只留数字，最多 4 位', async () => {
    const { formData, onCvcInput } = useCheckoutForm()

    const { event, input } = inputEvent('12a345')
    onCvcInput(event)
    await nextTick()

    expect(formData.cvc).toBe('1234')
    expect(input.value).toBe('1234')
  })

  it('没碰过的字段不提前报红（否则用户刚开始输卡号就一片红）', async () => {
    const form = useCheckoutForm()

    form.onCardNumberInput(inputEvent('1234').event)
    await nextTick()

    expect(form.fieldErrors.cardNumber).toBeUndefined()
  })

  it('已 touched 的字段在掩码后立即重校验：补全卡号后错误消失', async () => {
    const form = useCheckoutForm()

    form.markTouched('cardNumber')
    expect(form.fieldErrors.cardNumber).toBe('checkout.errCardRequired')

    form.onCardNumberInput(inputEvent('4242424242424242').event)
    await nextTick()

    expect(form.fieldErrors.cardNumber).toBeUndefined()
  })
})

describe('useCheckoutForm — 卡组织识别', () => {
  it.each([
    ['4111111111111111', 'Visa'],
    ['5555555555554444', 'Mastercard'],
    ['2221000000000009', 'Mastercard'],
    ['378282246310005', 'Amex'],
    ['6011111111111117', 'Discover'],
    ['9999999999999999', ''],
  ])('%s → %s', (number, brand) => {
    const { formData, cardBrand } = useCheckoutForm()
    formData.cardNumber = number
    expect(cardBrand.value).toBe(brand)
  })
})

describe('useCheckoutForm — 已存地址', () => {
  it('选中地址：回填四个字段 + 拆姓名 + 清掉相关错误 + 关面板', () => {
    const { formData, fieldErrors, pickAddress, showAddressPicker, selectedAddressId } =
      useCheckoutForm()
    formData.firstName = ''
    fieldErrors.address = 'stale'
    fieldErrors.city = 'stale'
    showAddressPicker.value = true

    pickAddress(ADDRESS)

    expect(selectedAddressId.value).toBe(5)
    expect(formData.address).toBe('1 Main St')
    expect(formData.city).toBe('Springfield')
    expect(formData.zip).toBe('12345')
    expect(formData.firstName).toBe('Alex')
    expect(formData.lastName).toBe('Doe')
    expect(fieldErrors.address).toBeUndefined()
    expect(fieldErrors.city).toBeUndefined()
    expect(showAddressPicker.value).toBe(false)
  })
})

describe('useCheckoutForm — 首屏预填', () => {
  it('未登录：不请求地址与资料', async () => {
    const { loadInitialData } = useCheckoutForm()

    await loadInitialData()

    expect(mocks.getAddresses).not.toHaveBeenCalled()
    expect(mocks.getProfile).not.toHaveBeenCalled()
  })

  it('登录态：拉资料与地址，默认地址回填并记录 id', async () => {
    login(useAuthStore())
    mocks.getAddresses.mockResolvedValue([ADDRESS])
    mocks.getProfile.mockResolvedValue({
      email: 'alex@example.com',
      firstName: 'Alex',
      lastName: 'Doe',
    })
    const { formData, savedAddresses, selectedAddressId, loadInitialData } = useCheckoutForm()

    await loadInitialData()

    expect(savedAddresses.value).toHaveLength(1)
    expect(selectedAddressId.value).toBe(5)
    expect(formData.email).toBe('alex@example.com')
    expect(formData.address).toBe('1 Main St')
  })

  it('取资料失败：只打日志，不抛给调用方（结算页不该因此白屏）', async () => {
    login(useAuthStore())
    mocks.getAddresses.mockRejectedValue(new Error('network'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { loadInitialData } = useCheckoutForm()

    await expect(loadInitialData()).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useSavedCards } from './useSavedCards'
import { useAuthStore, type User } from '@/stores/auth'
import { useToast } from './useToast'
import type { SavedPaymentMethod } from '@/api/modules/payment'

/**
 * 最要紧的一条是**作用域隔离**：已保存卡按 userId 存，guest 或换账号登录时不能漏出来。
 * 它是安全相关的行为（别人的卡号后四位不该出现），但实现只是一行三元表达式，
 * 所以必须有测试钉住，否则重构时很容易被"简化"掉。
 */

const mocks = vi.hoisted(() => ({
  getSavedPaymentMethods: vi.fn(),
  deleteSavedPaymentMethod: vi.fn(),
}))

vi.mock('@/api/modules/payment', () => ({
  getSavedPaymentMethods: mocks.getSavedPaymentMethods,
  deleteSavedPaymentMethod: mocks.deleteSavedPaymentMethod,
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const CARD: SavedPaymentMethod = {
  id: 'pm_1',
  brand: 'Visa',
  last4: '4242',
  expMonth: '12',
  expYear: '30',
  createdAt: 1_700_000_000_000,
}

function login(id = 'u1') {
  const auth = useAuthStore()
  auth.user = { id, name: 'Alex', email: 'a@b.c', role: 'user' } as User
  auth.token = 'tok'
  return auth
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  useToast().toasts.value.splice(0)
  mocks.getSavedPaymentMethods.mockReturnValue([CARD])
})

describe('useSavedCards — 作用域隔离', () => {
  it('未登录：不查也不展示（guest 看不到任何已存卡）', () => {
    const api = useSavedCards()

    api.loadSavedCards()

    expect(mocks.getSavedPaymentMethods).not.toHaveBeenCalled()
    expect(api.savedCards.value).toEqual([])
  })

  it('登录后按 userId 查', () => {
    login('u42')
    const api = useSavedCards()

    api.loadSavedCards()

    expect(mocks.getSavedPaymentMethods).toHaveBeenCalledWith('u42')
    expect(api.savedCards.value).toEqual([CARD])
  })

  it('未登录时删除是空操作 —— 拿不到 scope 就不该动任何人的数据', () => {
    const api = useSavedCards()

    api.removeSavedCard('pm_1')

    expect(mocks.deleteSavedPaymentMethod).not.toHaveBeenCalled()
  })
})

describe('useSavedCards — 选择', () => {
  it('再点一次已选中的卡即取消（回到填卡表单）', () => {
    login()
    const api = useSavedCards()
    api.loadSavedCards()

    api.selectSavedCard('pm_1')
    expect(api.isUsingSavedCard()).toBe(true)
    expect(api.selectedSavedCard.value).toEqual(CARD)

    api.selectSavedCard('pm_1')
    expect(api.isUsingSavedCard()).toBe(false)
    expect(api.selectedSavedCard.value).toBeNull()
  })

  it('选中 id 已不存在时解析为 null，而不是抛错', () => {
    login()
    const api = useSavedCards()
    api.loadSavedCards()

    api.selectedSavedCardId.value = 'pm_gone'

    expect(api.selectedSavedCard.value).toBeNull()
  })
})

describe('useSavedCards — 删除', () => {
  it('删掉列表里的那张，并调后端', () => {
    login('u1')
    const api = useSavedCards()
    api.loadSavedCards()

    api.removeSavedCard('pm_1')

    expect(mocks.deleteSavedPaymentMethod).toHaveBeenCalledWith('u1', 'pm_1')
    expect(api.savedCards.value).toEqual([])
  })

  it('删的正是当前选中的那张时，一并取消选中', async () => {
    login()
    const api = useSavedCards()
    api.loadSavedCards()
    api.selectSavedCard('pm_1')

    api.removeSavedCard('pm_1')
    await nextTick()

    // 不取消的话会拿着一张已不存在的卡去支付
    expect(api.selectedSavedCardId.value).toBe('')
    expect(api.isUsingSavedCard()).toBe(false)
  })

  it('删的不是选中的那张时，选中保持不变', () => {
    mocks.getSavedPaymentMethods.mockReturnValue([CARD, { ...CARD, id: 'pm_2', last4: '1111' }])
    login()
    const api = useSavedCards()
    api.loadSavedCards()
    api.selectSavedCard('pm_2')

    api.removeSavedCard('pm_1')

    expect(api.selectedSavedCardId.value).toBe('pm_2')
  })
})

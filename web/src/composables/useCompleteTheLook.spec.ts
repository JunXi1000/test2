import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import { useCompleteTheLook } from './useCompleteTheLook'
import { useCartStore } from '@/stores/cart'
import { useToast } from './useToast'
import type { CartItem } from '@/stores/cart'
import type { Product } from '@/types/product'

const mocks = vi.hoisted(() => ({ getCompleteTheLook: vi.fn() }))

vi.mock('@/api/modules/product', () => ({ getCompleteTheLook: mocks.getCompleteTheLook }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const ITEMS: CartItem[] = [
  {
    id: 7,
    cartItemId: 'c1',
    title: 'Seed',
    price: 10,
    image: '/s.png',
    color: 'Default',
    size: 'Standard',
    quantity: 1,
  },
]

const product = (id: number, over: Partial<Product> = {}): Product =>
  ({ id, title: `P${id}`, price: id * 10, image: `/p${id}.png`, ...over }) as Product

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  useToast().toasts.value.splice(0)
  mocks.getCompleteTheLook.mockResolvedValue([product(1), product(2)])
})

function setup(items: CartItem[] = ITEMS) {
  return useCompleteTheLook({ items: ref(items) })
}

describe('useCompleteTheLook', () => {
  it('以第一件商品为种子取数，默认**全选**（推荐位是「这几件一起买」）', async () => {
    const api = setup()

    await api.load()

    expect(mocks.getCompleteTheLook).toHaveBeenCalledWith(7, 3)
    expect(api.products.value).toHaveLength(2)
    expect(api.selectedCount.value).toBe(2)
  })

  it('购物车为空时不请求（没有种子）', async () => {
    const api = setup([])

    await api.load()

    expect(mocks.getCompleteTheLook).not.toHaveBeenCalled()
    expect(api.products.value).toEqual([])
  })

  it('取数失败：静默清空，不抛 —— 推荐位不该让结算页出错', async () => {
    mocks.getCompleteTheLook.mockRejectedValue(new Error('boom'))
    const api = setup()

    await expect(api.load()).resolves.toBeUndefined()
    expect(api.products.value).toEqual([])
    expect(api.loading.value).toBe(false)
  })

  it('toggle 取消/恢复选中，计数跟着变', async () => {
    const api = setup()
    await api.load()

    api.toggle(1)
    await nextTick()
    expect(api.selectedCount.value).toBe(1)

    api.toggle(1)
    await nextTick()
    expect(api.selectedCount.value).toBe(2)
  })

  it('整块替换 Set（而不是原地增删）—— 模板的 selected.has() 靠引用变化触发重渲染', async () => {
    const api = setup()
    await api.load()
    const before = api.selected.value

    api.toggle(1)
    await nextTick()

    expect(api.selected.value).not.toBe(before)
  })

  it('加入购物车：每件都用它的首个颜色/尺码，数量 1，加完清空选择', async () => {
    const api = setup()
    await api.load()
    const cart = useCartStore()
    const addItem = vi.spyOn(cart, 'addItem').mockImplementation(() => {})
    mocks.getCompleteTheLook.mockResolvedValue([
      product(1, { colors: [{ name: 'Red' }], sizes: ['M'] } as Partial<Product>),
    ])
    await api.load()

    await api.addSelected()

    expect(addItem).toHaveBeenCalledTimes(1)
    expect(addItem.mock.calls[0][1]).toMatchObject({ color: 'Red', size: 'M', quantity: 1 })
    // 加过的不该还能再点一次「加入订单」
    expect(api.selectedCount.value).toBe(0)
  })

  it('商品没有颜色/尺码选项时退回 Default / Standard', async () => {
    const api = setup()
    mocks.getCompleteTheLook.mockResolvedValue([product(1)])
    await api.load()
    const cart = useCartStore()
    const addItem = vi.spyOn(cart, 'addItem').mockImplementation(() => {})

    await api.addSelected()

    expect(addItem.mock.calls[0][1]).toMatchObject({ color: 'Default', size: 'Standard' })
  })

  it('一件都没选时不加也不提示', async () => {
    const api = setup()
    await api.load()
    const cart = useCartStore()
    const addItem = vi.spyOn(cart, 'addItem').mockImplementation(() => {})
    api.toggle(1)
    api.toggle(2)
    await nextTick()

    await api.addSelected()

    expect(addItem).not.toHaveBeenCalled()
    expect(useToast().toasts.value).toHaveLength(0)
  })

  it('连点：adding 期间第二次直接返回', async () => {
    const api = setup()
    await api.load()
    const cart = useCartStore()
    const addItem = vi.spyOn(cart, 'addItem').mockImplementation(() => {})

    const first = api.addSelected()
    const second = api.addSelected()
    await Promise.all([first, second])

    expect(addItem).toHaveBeenCalledTimes(2) // 两件商品各一次，不是两轮
  })
})

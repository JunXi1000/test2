import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import { useCartSummary } from './useCartSummary'
import { useAuthStore, type User } from '@/stores/auth'
import type { OrderSummary } from '@/api/modules/checkout'
import type { CartItem } from '@/stores/cart'

/**
 * 购物车页金额口径的钉子。
 *
 * 这里最重要的不是"算得对不对"，而是"**有没有在算**"：BLK-4（券）与 BLK-E1（积分）是同一类
 * 缺陷的两次复发 —— 应付额由客户端自算一份 ⇒ 页面显示额 ≠ 实际扣款。
 * G1c 之后购物车与结算页都只消费服务端 `summary.total`，第一条用例就是把这条钉死的**判别用例**
 * （与 `useOrderSummary.spec.ts` 里那条同构）。
 *
 * G1d 又补了同一类缺陷的第三处暴露：**items 变了却不重取摘要**（结算页是加购，这里是改数量/
 * 删行/清空）。下面「items 变化触发重取」那组用例钉住它。
 */

const mocks = vi.hoisted(() => ({ calculateOrderSummary: vi.fn() }))

vi.mock('@/api/modules/checkout', () => ({
  calculateOrderSummary: mocks.calculateOrderSummary,
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

/** 本地镜像小计 = 50 × 1 = 50，**刻意**与下面 mock 的服务端小计（120）不同 */
const ITEMS: CartItem[] = [
  {
    id: 1,
    cartItemId: 'c1',
    title: 'Widget',
    price: 50,
    image: '/w.png',
    color: 'Default',
    size: 'Standard',
    quantity: 1,
  },
]

/** 每例一份独立的行副本：G1d 之后 items 上挂了深 watcher，共享数组会串用例 */
function setup(getCode?: () => string) {
  const items = ref<CartItem[]>([{ ...ITEMS[0] }])
  const cart = useCartSummary(getCode ? { items, getCode } : { items })
  return { cart, items }
}

function login() {
  const auth = useAuthStore()
  auth.user = { id: '1', name: 'Alex', email: 'a@b.c', role: 'user' } as User
  auth.token = 'tok'
}

/**
 * 排空微任务：items watcher 触发的重取是 fire-and-forget，且 `fetchSummary` 至少要跨
 * 两级 await（`run` 的 `await task()` + 赋值）。断言"重取之后的值"前必须排空，
 * 否则测的是时序巧合而不是行为。
 */
async function flush(times = 4) {
  for (let i = 0; i < times; i++) await nextTick()
}

/** 服务端口径：按行数计价（模拟后端"按请求里的 items 重算"） */
function serverByItems() {
  mocks.calculateOrderSummary.mockImplementation((rows: CartItem[]) =>
    Promise.resolve({
      subtotal: rows.length * 120,
      discount: 0,
      total: rows.length * 120,
    }),
  )
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  mocks.calculateOrderSummary.mockResolvedValue({ subtotal: 120, discount: 0, total: 120 })
})

describe('useCartSummary — 应付额只认服务端（G1c）', () => {
  /**
   * 判别用例：造一个 `subtotal − discount = 90` 但服务端 `total = 99` 的回包。
   * 断言页面取 **99**。任何"看起来对"的重算（旧实现是 `serverSubtotal − discount`）
   * 只要接回来，这条就会红 —— 而那种重算正是 BLK-4 / BLK-E1 的形状。
   */
  it('即使服务端的 total 与 subtotal − discount 不等，也以服务端为准（前端不重算）', async () => {
    mocks.calculateOrderSummary.mockResolvedValue({
      subtotal: 120,
      discount: 30,
      discountCode: 'SAVE20',
      total: 99,
    })
    const { cart } = setup()
    await cart.fetchSummary('SAVE20')

    expect(cart.discount.value).toBe(30)
    expect(cart.total.value).toBe(99) // 不是 120 − 30 = 90
    expect(cart.subtotal.value).toBe(120) // 小计展示仍取服务端回包
  })

  it('total 缺失/NaN 时折成有限数 0，**绝不出现 NaN**', async () => {
    mocks.calculateOrderSummary.mockResolvedValue({
      subtotal: 120,
      discount: 0,
    } as unknown as OrderSummary)
    const { cart } = setup()
    await cart.fetchSummary()

    expect(Number.isFinite(cart.total.value)).toBe(true)
    expect(cart.total.value).toBe(0)
  })

  it('取数请求形状与结算页一致：zip 传空串、生效的码透传（MIN-E2）', async () => {
    const { cart } = setup()
    await cart.fetchSummary('SAVE10')

    expect(mocks.calculateOrderSummary).toHaveBeenLastCalledWith([{ ...ITEMS[0] }], '', 'SAVE10')
  })

  it('小计展示：拿到回包前用本地镜像，回包后用服务端值（MIN-E1 的唯一判据）', async () => {
    const { cart } = setup()
    // 还没取数：本地镜像（纯 Σ 单价×数量，不构成第二套业务口径）
    expect(cart.subtotal.value).toBe(50)

    await cart.fetchSummary()

    // 服务端说 120（比如行内单价已过期）—— 展示必须跟着服务端走
    expect(cart.subtotal.value).toBe(120)
  })

  it('匿名不发请求的前提：enabled 跟随登录态（C0）', () => {
    const { cart } = setup()
    expect(cart.enabled.value).toBe(false)

    login()

    expect(cart.enabled.value).toBe(true)
  })

  it('resetSummary：回到"服务端还没回包"的状态（退出登录 / 清空购物车）', async () => {
    const { cart } = setup()
    await cart.fetchSummary()
    expect(cart.total.value).toBe(120)
    expect(cart.subtotal.value).toBe(120)

    cart.resetSummary()

    expect(cart.total.value).toBe(0)
    expect(cart.subtotal.value).toBe(50) // 回到本地镜像
    expect(cart.isLoading.value).toBe(false)
  })
})

/**
 * G1d：购物车页的 items 变化入口全部要触发重取。
 *
 * 没有这个 watcher 时，一旦取到过回包（`serverLoaded === true`），右栏金额会一直停在
 * 第一次取数的值 —— 与结算页 BLK-I1 是同一条线上的一处。
 * 入口清单（`stores/cart.ts`）：`updateQuantity`（原地改 quantity）、`removeItem`（换数组）、
 * `clearCart`、`updateItemOptions`（原地改）—— 都落在 `items` 上，watcher 一律覆盖。
 */
describe('useCartSummary — items 变化触发重取（G1d）', () => {
  it('加行/改数量后重取摘要，Total 等于服务端新值（BLK-I1 同构锚点）', async () => {
    serverByItems()
    const { cart, items } = setup()
    await cart.fetchSummary()
    expect(cart.total.value).toBe(120)

    // cartStore.addItem 命中新行时会 push（`updateQuantity` 则是原地改，见下一条）
    items.value.push({ ...ITEMS[0], cartItemId: 'c2' })
    await flush()

    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(2) // 首次 + 自动重取
    expect(cart.total.value).toBe(240) // 服务端新值，不是旧的 120
  })

  it('原地改数量也会重取（签名含 quantity：数组引用不变也算变化）', async () => {
    serverByItems()
    const { cart, items } = setup()
    await cart.fetchSummary()
    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(1)

    items.value[0].quantity = 3 // 与 cartStore.updateQuantity 同一形态
    await flush()

    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(2)
  })

  it('服务端回拉替换 items（金额构成不变）不会重复请求 —— 一次动作一次取数', async () => {
    serverByItems()
    const { cart, items } = setup()
    await cart.fetchSummary()

    // ① 本地乐观改
    items.value.push({ ...ITEMS[0], cartItemId: 'c2' })
    await flush()
    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(2)

    // ② syncAfterMutation → syncFromServer 用权威列表整体替换（内容与 ① 相同）
    items.value = items.value.map((it) => ({ ...it }))
    await flush()
    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(2)
  })

  it('一次动作里改多行只发一次请求（pre-flush watcher 合并，不抖动）', async () => {
    serverByItems()
    const { cart, items } = setup()
    await cart.fetchSummary()

    items.value.push({ ...ITEMS[0], cartItemId: 'c2' })
    items.value[0].quantity = 2
    await flush()

    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(2) // 首次 + 合并后的一次
  })

  it('清空 items 不重取（空车没有摘要可算，后端对空 items 返回 400）', async () => {
    const { cart, items } = setup()
    await cart.fetchSummary()
    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(1)

    items.value = [] // cartStore.clearCart
    await flush()

    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(1)
  })

  it('自动重取会带上生效的码（getCode 接线，避免总额凭空反弹）', async () => {
    serverByItems()
    const { cart, items } = setup(() => 'SAVE10')

    await cart.fetchSummary()
    items.value.push({ ...ITEMS[0], cartItemId: 'c2' })
    await flush()

    expect(mocks.calculateOrderSummary).toHaveBeenLastCalledWith(
      [{ ...ITEMS[0] }, { ...ITEMS[0], cartItemId: 'c2' }],
      '',
      'SAVE10',
    )
  })
})

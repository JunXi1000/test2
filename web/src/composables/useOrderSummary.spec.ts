import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import { useOrderSummary } from './useOrderSummary'
import { useAuthStore, type User } from '@/stores/auth'
import { useLoyaltyStore } from '@/stores/loyalty'
import { useToast } from './useToast'
import type { CartItem } from '@/stores/cart'
import type { OrderSummary } from '@/api/modules/checkout'

/**
 * 订单摘要的钉子在这里。金额算错时用户看到的是**数字不对**，而在 E2E 里只表现为
 * 「总价断言不过」，查起来比单测贵得多。
 *
 * 这份 spec 现在钉两条**资损口径**（都曾是真实缺陷，且都是"两处各算一份"长出来的）：
 *   1. `total` 只消费服务端 `summary.total`，前端**不再自算任何一步**（BLK-E1 / G1）；
 *   2. 券减免只有一个来源（`summary.discount`），`/checkout/promo` 的回包不参与（BLK-4）。
 * 合起来保证「页面显示额 == 实际扣款」。
 */

const mocks = vi.hoisted(() => ({
  calculateOrderSummary: vi.fn(),
  applyPromoCode: vi.fn(),
}))

vi.mock('@/api/modules/checkout', () => ({
  calculateOrderSummary: mocks.calculateOrderSummary,
  applyPromoCode: mocks.applyPromoCode,
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const ITEMS: CartItem[] = [
  {
    id: 1,
    cartItemId: 'c1',
    title: 'Widget',
    price: 50,
    image: '/w.png',
    color: 'Default',
    size: 'Standard',
    quantity: 2,
  },
]

/**
 * 服务端摘要的基数。
 *
 * 刻意让 `shipping`/`tax` 非零、且 `total` 与「subtotal + shipping + tax」**不等**
 * （100 ≠ 115）：这样「total 有没有被前端重算」一眼可判 —— 服务端说 100，前端就必须是 100。
 * `total` 也与 `subtotal − discount`（= 100）自洽，作为无券场景的基线（G1b / MIN-E5）。
 */
const BASE_SUMMARY: OrderSummary = { subtotal: 100, shipping: 10, tax: 5, discount: 0, total: 100 }

/**
 * 建一个实例。
 *
 * `getCode` **按生产接线**（`Checkout.vue` 的 `paymentDiscountCode`）接到组合式自己的状态上：
 * 只有已生效的码才发下去。夹具这样写有两个好处：
 *   - 与页面同构，D-3 那类"夹具没接线"的错误不会再靠巧合通过；
 *   - "输入偏离已生效码 ⇒ 作废 ⇒ 摘要按无码重取" 这条链在测试里也是真的走通的。
 * `zip` 是可变夹具，用来验证取数时才读。
 * `items` 每例一份**独立副本**：G1d 之后 items 上挂了深 watcher，共享同一个数组会把
 * 上一个用例的改动带进来。
 */
function setup() {
  const zip = { value: '12345' }
  const items = ref<CartItem[]>(ITEMS.map((it) => ({ ...it })))
  let readCode = (): string => ''
  const api = useOrderSummary({
    items,
    getZip: () => zip.value,
    getCode: () => readCode(),
  })
  // 接线要在实例建好之后才能拿到 ref —— 与页面里 paymentDiscountCode 的位置完全一致
  readCode = () => (api.promoApplied.value ? api.promoCode.value.trim() : '')
  return { api, zip, items }
}

/** 登录 + 给一个很大的本地积分余额：证明「本地有积分也不会改变应付额」 */
function login(points = 0) {
  const auth = useAuthStore()
  auth.user = { id: '1', name: 'Alex', email: 'a@b.c', role: 'user' } as User
  auth.token = 'tok'
  useLoyaltyStore().state.points = points
}

/**
 * 排空微任务队列。
 *
 * 摘要重取是 **fire-and-forget**（`onApplied` / items watcher → `fetchSummary()`），
 * 而一次 `fetchSummary` 至少要跨两级 await（`run` 里的 `await task()` + 赋值给 `summary`）。
 * 断言"重取之后的值"之前必须排空，否则测的是**时序巧合**而不是行为 ——
 * 只有一次 `await nextTick()` 时，赋值往往还没发生（旧值看起来"恰好对"）。
 */
async function flush(times = 4) {
  for (let i = 0; i < times; i++) await nextTick()
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  useToast().toasts.value.splice(0)
  mocks.calculateOrderSummary.mockResolvedValue({ ...BASE_SUMMARY })
  mocks.applyPromoCode.mockResolvedValue({ discount: 10 })
})

describe('useOrderSummary — 金额口径（服务端唯一权威）', () => {
  it('total 直接取服务端 summary.total；运费与税**不由前端计入**', async () => {
    const { api } = setup()
    expect(api.total.value).toBe(0) // 取数前是空的，不是 NaN

    await api.fetchSummary()

    expect(api.summary.value.subtotal).toBe(100)
    expect(api.summary.value.shipping).toBe(10) // 后端仍返回，但前端不用
    expect(api.summary.value.tax).toBe(5)
    // 服务端说 100（= subtotal − discount）。若前端还在自算 subtotal+shipping+tax 就会得到 115
    expect(api.total.value).toBe(100)
  })

  it('后端不再返回运费/税时 total 仍是有限数，**绝不出现 NaN**', async () => {
    // 契约漂移的兜底：字段缺失/undefined 不得让应付额变成 NaN
    mocks.calculateOrderSummary.mockResolvedValue({
      subtotal: 100,
      discount: 0,
      total: 100,
    } as unknown as OrderSummary)
    const { api } = setup()
    await api.fetchSummary()

    expect(Number.isFinite(api.total.value)).toBe(true)
    expect(api.total.value).toBe(100)
  })

  /**
   * BLK-E1 的核心钉子：**服务端是唯一权威，前端不做任何"看起来对"的重算**。
   *
   * 这里刻意让服务端的 `total`（99）与前端能算出的 `subtotal − discount`（85）**不等**。
   * 旧实现会算出 85 并显示 85，而实际扣款按服务端 —— 页面显示额与实扣分叉。
   * 现在必须原样消费 99：一旦有人把任何算式接回来，这条就红。
   */
  it('即使服务端的 total 与 subtotal − discount 不等，也**以服务端为准**（前端不重算）', async () => {
    mocks.calculateOrderSummary.mockResolvedValue({
      subtotal: 100,
      discount: 15,
      discountCode: 'SAVE10',
      total: 99,
    })
    const { api } = setup()
    await api.fetchSummary()

    expect(api.total.value).toBe(99)
    expect(api.tieredDiscount.value).toBe(15)
  })

  it('服务端减免单独暴露成 tieredDiscount', async () => {
    mocks.calculateOrderSummary.mockResolvedValue({ ...BASE_SUMMARY, discount: 15, total: 85 })
    const { api } = setup()
    await api.fetchSummary()

    expect(api.tieredDiscount.value).toBe(15)
    expect(api.total.value).toBe(85)
  })

  /**
   * BLK-4 的核心钉子：**减免只有一个来源**。
   *
   * 后端在 `/checkout/summary` 收到 code 时会算出这同一笔券减免（`discount:15`），
   * 旧代码再把 `/checkout/promo` 回包里的 10 叠加上去 ⇒ total 比实际扣款少 10。
   * 现在 total 只认服务端给的那个数：`promo` 回包既不加进 total，也不减进 total。
   */
  it('券减免只取服务端 total；promo 回包的折扣**不再叠加**（BLK-4）', async () => {
    mocks.calculateOrderSummary.mockResolvedValue({
      ...BASE_SUMMARY,
      discount: 15,
      discountCode: 'SAVE10',
      total: 85,
    })
    const { api } = setup()
    await api.fetchSummary()

    api.promoCode.value = 'SAVE10'
    await api.applyPromo()

    // /checkout/promo 的回包仍是 10（只用于「已省 $X」提示）
    expect(api.promoDiscount.value).toBe(10)
    // 但应付只认服务端那一笔 —— 85，**不是** 85 − 10
    expect(api.total.value).toBe(85)
  })

  it('应用成功会把码发给 summary，让服务端算减免（onApplied → 重取）', async () => {
    mocks.calculateOrderSummary.mockResolvedValue({
      ...BASE_SUMMARY,
      discount: 10,
      discountCode: 'SAVE10',
      total: 90,
    })
    const { api } = setup()
    await api.fetchSummary()
    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(1)

    api.promoCode.value = 'SAVE10'
    await api.applyPromo()

    // 第二次取数来自 onApplied —— 且这次把**已生效的码**带上了（夹具的 getCode 与生产同构）
    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(2)
    expect(mocks.calculateOrderSummary).toHaveBeenLastCalledWith(ITEMS, '12345', 'SAVE10')
    expect(api.total.value).toBe(90)
  })
})

/**
 * BLK-E1：积分**完全退出**应付口径。
 *
 * 后端 `src/main` 里没有任何积分/抵扣概念（`StorefrontCheckoutDTO` 只有 `code`，
 * `/payments/create` 不收积分字段，`ProductOrderServiceImpl` 只按 `code` 核销）。
 * 所以"用积分抵扣"在前端只能是一句空话：要么显示额低于实扣，要么用户白掉余额。
 * 这里钉住两点：**total 不受积分影响**、**抵扣接口不再存在**。
 */
describe('useOrderSummary — 积分已退出应付口径（BLK-E1）', () => {
  it('登录且余额很大时，total 仍**只**等于服务端 summary.total', async () => {
    login(9_999_999)
    const { api } = setup()
    await api.fetchSummary()

    expect(api.total.value).toBe(100) // 不是 100 − 99999
    // 余额只是本地记账，与应付额无关
    expect(useLoyaltyStore().state.points).toBe(9_999_999)
  })

  it('不再暴露任何积分抵扣状态 —— 否则"再减一层"就有了接口', () => {
    const { api } = setup()

    for (const key of [
      'pointsToUse',
      'pointsDiscount',
      'maxPointsToUse',
      'pointsUsable',
      'prePointsTotal',
    ]) {
      expect(api, `${key} 又回到应付口径里了（BLK-E1 复发）`).not.toHaveProperty(key)
    }
    // 应付额本身当然还在
    expect(Object.keys(api)).toContain('total')
  })
})

describe('useOrderSummary — 取数', () => {
  it('把邮编与生效的券码一起传下去 —— 两者都是取数时才读', async () => {
    const { api, zip } = setup()
    await api.fetchSummary()
    expect(mocks.calculateOrderSummary).toHaveBeenLastCalledWith(ITEMS, '12345', '')

    zip.value = '99999'
    await api.fetchSummary()
    expect(mocks.calculateOrderSummary).toHaveBeenLastCalledWith(ITEMS, '99999', '')
  })

  it('失败：写 error（右栏 ErrorState 靠它渲染）并 toast，摘要保持上一次的值', async () => {
    const { api } = setup()
    await api.fetchSummary()
    mocks.calculateOrderSummary.mockRejectedValue(new Error('boom'))

    await api.fetchSummary()

    expect(api.error.value).toBe('boom')
    expect(useToast().toasts.value.length).toBeGreaterThan(0)
    expect(api.summary.value.subtotal).toBe(100) // 没被清成 0
  })
})

/**
 * G1d / BLK-I1：**items 一变就必须重取摘要**。
 *
 * 缺陷形状：结算页内的「Complete the Look → Add to Order」会加商品，而摘要是挂载时取的
 * 那一次 ⇒ 右栏应付总额还是旧 items 的值，下单时服务端按新 items 重算 ⇒ 显示额 ≠ 实扣。
 * 这是 BLK-4（券）→ BLK-E1（积分）→ BLK-I1（items 未同步）同一条线上的第三处。
 *
 * 这里的服务端 mock **按 items 计价**（和真实后端一样"按请求里的行重算"），
 * 所以"Total 有没有跟着 items 变"是可判别的 —— 若摘要不重取，断言会停在旧值。
 */
describe('useOrderSummary — items 变化触发重取（G1d / BLK-I1）', () => {
  /** 服务端口径：按行数计价（模拟后端"按 items 重算"） */
  function serverByItems() {
    mocks.calculateOrderSummary.mockImplementation((rows: CartItem[]) =>
      Promise.resolve({
        subtotal: rows.length * 120,
        discount: 0,
        total: rows.length * 120,
      }),
    )
  }

  it('加购后 Total 必须变化且等于服务端新值（BLK-I1 回归锚点）', async () => {
    serverByItems()
    const { api, items } = setup()
    await api.fetchSummary()
    expect(api.total.value).toBe(120)

    // 与 cartStore.addItem 同一形态：就在同一个数组上 push
    items.value.push({ ...ITEMS[0], cartItemId: 'c2' })
    await flush()

    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(2) // 首次 + 自动重取
    expect(api.total.value).toBe(240) // 服务端新值，而不是停留在旧的 120
  })

  it('原地改数量也会重取（签名含 quantity：数组引用不变也算变化）', async () => {
    serverByItems()
    const { api, items } = setup()
    await api.fetchSummary()
    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(1)

    // 与 cartStore.updateQuantity 同一形态：`item.quantity = n`，数组引用不变
    items.value[0].quantity = 3
    await flush()

    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(2)
  })

  it('一次动作里加多件只发一次请求（pre-flush watcher 合并，不抖动）', async () => {
    serverByItems()
    const { api, items } = setup()
    await api.fetchSummary()

    // useCompleteTheLook.addSelected 是在 forEach 里连着 addItem 多次
    items.value.push({ ...ITEMS[0], cartItemId: 'c2' })
    items.value.push({ ...ITEMS[0], cartItemId: 'c3' })
    await flush()

    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(2) // 首次 + 合并后的一次
    expect(api.total.value).toBe(360)
  })

  it('清空 items 不重取（落单收尾清空购物车，不该发注定 400 的请求）', async () => {
    const { api, items } = setup()
    await api.fetchSummary()
    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(1)

    items.value = [] // finalizeOrder → clearCart / clearDirectBuyItem
    await flush()

    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(1)
  })

  it('并发重取时，先发出的旧响应不会覆盖新值（乱序防护）', async () => {
    let resolveFirst: (v: OrderSummary) => void = () => {}
    mocks.calculateOrderSummary
      .mockImplementationOnce(
        () =>
          new Promise<OrderSummary>((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockImplementationOnce(() => Promise.resolve({ subtotal: 240, discount: 0, total: 240 }))

    const { api, items } = setup()
    const first = api.fetchSummary() // 挂着不返回

    items.value.push({ ...ITEMS[0], cartItemId: 'c2' })
    await flush() // watcher 发起第二次，且已落地
    expect(api.total.value).toBe(240)

    resolveFirst({ subtotal: 120, discount: 0, total: 120 }) // 旧请求后到
    await first
    await flush()

    expect(api.total.value).toBe(240) // 旧值被丢弃，没有覆盖
  })

  it('服务端回拉替换 items（金额构成不变）不会重复请求 —— 一次动作一次取数', async () => {
    serverByItems()
    const { api, items } = setup()
    await api.fetchSummary()

    // ① 本地乐观改（cartStore.addItem）
    items.value.push({ ...ITEMS[0], cartItemId: 'c2' })
    await flush()
    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(2)

    // ② 真实后端 + 登录态：syncAfterMutation → syncFromServer 用权威列表**整体替换**
    //    （内容与 ① 相同：同 id/数量/单价）—— 不应产生第二次重取
    items.value = items.value.map((it) => ({ ...it }))
    await flush()
    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(2)
  })

  it('收尾闸门（shouldRefetch 为假）时不重取 —— 落单清空购物车/清 directBuyItem 不是"改了订单"', async () => {
    let allow = true
    const items = ref<CartItem[]>(ITEMS.map((it) => ({ ...it })))
    const api = useOrderSummary({
      items,
      getZip: () => '12345',
      getCode: () => '',
      shouldRefetch: () => allow,
    })
    await api.fetchSummary()
    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(1)

    allow = false // finalizeOrder 里 isCompletingOrder = true
    items.value.push({ ...ITEMS[0], cartItemId: 'c2' })
    await flush()

    expect(mocks.calculateOrderSummary).toHaveBeenCalledTimes(1) // 被闸门挡住
  })
})

describe('useOrderSummary — 优惠码', () => {
  /**
   * 服务端同构的 mock：**收到码才给减免**（真实后端就是这么做的）。
   * 这样"重取后落地的金额"只取决于码有没有真的发出去，夹具不会替实现圆场。
   */
  beforeEach(() => {
    mocks.calculateOrderSummary.mockImplementation((_items, _zip, code: string) =>
      Promise.resolve(
        code
          ? { ...BASE_SUMMARY, discount: 10, discountCode: code, total: 90 }
          : { ...BASE_SUMMARY },
      ),
    )
  })

  it('空码：只提示，不请求', async () => {
    const { api } = setup()
    await api.fetchSummary()
    api.promoCode.value = '   '

    await api.applyPromo()

    expect(mocks.applyPromoCode).not.toHaveBeenCalled()
    expect(api.promoApplied.value).toBe(false)
  })

  it('折扣为 0（无效码）：不标记为已应用', async () => {
    mocks.applyPromoCode.mockResolvedValue({ discount: 0 })
    const { api } = setup()
    await api.fetchSummary()
    api.promoCode.value = 'NOPE'

    await api.applyPromo()

    expect(api.promoApplied.value).toBe(false)
    expect(api.promoDiscount.value).toBe(0)
  })

  it('重复应用：提示但不重复请求', async () => {
    const { api } = setup()
    await api.fetchSummary()
    api.promoCode.value = 'SAVE10'
    await api.applyPromo()

    await api.applyPromo()

    expect(mocks.applyPromoCode).toHaveBeenCalledTimes(1)
  })

  it('请求抛出：原因取自异常对象，不标记为已应用', async () => {
    mocks.applyPromoCode.mockRejectedValue(new Error('expired'))
    const { api } = setup()
    await api.fetchSummary()
    api.promoCode.value = 'OLD'

    await api.applyPromo()

    const toasts = useToast().toasts.value
    expect(api.promoApplied.value).toBe(false)
    expect(toasts[toasts.length - 1]?.description).toBe('expired')
  })

  it('移除：清输入与生效状态，摘要按「无码」重取，total 回到服务端无码值', async () => {
    const { api } = setup()
    await api.fetchSummary()

    api.promoCode.value = 'SAVE10'
    await api.applyPromo()
    await flush() // 让 onApplied 触发的那次重取落地
    expect(api.promoApplied.value).toBe(true)
    expect(api.total.value).toBe(90) // 服务端收到码 → 90

    api.removePromo()
    await flush()

    expect(api.promoApplied.value).toBe(false)
    expect(api.promoDiscount.value).toBe(0)
    expect(api.promoCode.value).toBe('')
    expect(api.total.value).toBe(100) // 无码 → 服务端 100
  })

  it('小计用 getter 取 —— 每次应用都读「此刻」的值，不是构造时的快照', async () => {
    // 摘要的小计会随购物车变；折扣必须按此刻的小计算，不能吃构造那一刻的快照
    const api = useOrderSummary({
      items: ref(ITEMS),
      getZip: () => '12345',
      getCode: () => '',
    })
    api.summary.value = { subtotal: 100, discount: 0, total: 100 }
    api.promoCode.value = 'A'
    await api.applyPromo()
    expect(mocks.applyPromoCode).toHaveBeenLastCalledWith('A', 100)

    // 走公开路径复位（removed → 可再应用），不手改 promoApplied 绕过重复应用守卫；
    // 小计随后变了（购物车改了）—— 下一次应用必须按新的小计算
    api.removePromo()
    api.summary.value = { subtotal: 250, discount: 0, total: 250 }
    api.promoCode.value = 'B'
    await api.applyPromo()
    expect(mocks.applyPromoCode).toHaveBeenLastCalledWith('B', 250)
  })
})

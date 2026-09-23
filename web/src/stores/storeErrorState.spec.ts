import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

/**
 * 三个 store 的**失败态**回归钉子。
 *
 * 原先它们在 `catch` 里把列表置 `[]`，于是「接口挂了」与「一条记录都没有」在界面上
 * 完全一样 —— 用户看到的是「没有退换申请」「没有券」。这类缺陷阶段 3/5 在页面上修过
 * 几处，这里是 store 侧的同一问题，钉子钉在**两件事**上：
 *   1. 失败要留下 error（不能静默）
 *   2. 失败**不清空**已有数据（清空正是让失败看起来像空态的原因）
 *
 * mock 分支不在这里测：那条路径本来就不会失败。
 */

vi.mock('@/config/env', async (importOriginal) => {
  const { ref } = await import('vue')
  const actual = await importOriginal<typeof import('@/config/env')>()
  // 只覆盖这一个：强制走「真实后端」分支才会经过 catch。
  // 必须 spread actual —— http.ts 还要从同一模块取 API_BASE_URL。
  return { ...actual, RUNTIME_USE_MOCK: ref(false) }
})

const api = vi.hoisted(() => ({
  getReturns: vi.fn(),
  getMyStockAlerts: vi.fn(),
  getCoupons: vi.fn(),
  getMyCoupons: vi.fn(),
}))

vi.mock('@/api/modules/returns', () => ({
  getReturns: api.getReturns,
  createReturn: vi.fn(),
}))
vi.mock('@/api/modules/stockAlerts', () => ({ getMyStockAlerts: api.getMyStockAlerts }))
vi.mock('@/api/modules/coupons', async () => {
  const actual =
    await vi.importActual<typeof import('@/api/modules/coupons')>('@/api/modules/coupons')
  return { ...actual, getCoupons: api.getCoupons, getMyCoupons: api.getMyCoupons }
})

import { useReturnStore } from './returns'
import { useStockAlertStore } from './stockAlerts'
import { useCouponStore } from './coupons'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  api.getReturns.mockReset()
  api.getMyStockAlerts.mockReset()
  api.getCoupons.mockReset()
  api.getMyCoupons.mockReset()
})

describe('失败态：留痕且不清空数据', () => {
  it('returns：失败时写 error，且保留上一次的数据', async () => {
    const store = useReturnStore()
    const existing = [
      { id: 'RET-1', orderId: 'o1', status: 'pending', createdAt: 0, updatedAt: 0 },
    ] as never
    api.getReturns.mockResolvedValueOnce(existing)
    await store.load()
    expect(store.requests).toHaveLength(1)

    api.getReturns.mockRejectedValueOnce(new Error('boom'))
    await store.load()

    expect(store.error).toBe('boom')
    // 关键：没被清成 []。清空就等于把失败伪装成空态
    expect(store.requests).toHaveLength(1)
  })

  it('returns：重试成功后 error 被清掉', async () => {
    const store = useReturnStore()
    api.getReturns.mockRejectedValueOnce(new Error('boom'))
    await store.load()
    expect(store.error).toBe('boom')

    api.getReturns.mockResolvedValueOnce([])
    await store.load()
    expect(store.error).toBe('')
  })

  it('stockAlerts：失败时写 error，且保留已有订阅', async () => {
    const store = useStockAlertStore()
    api.getMyStockAlerts.mockResolvedValueOnce([{ productId: 7 }] as never)
    await store.load()
    expect(store.alerts).toHaveLength(1)

    api.getMyStockAlerts.mockRejectedValueOnce(new Error('offline'))
    await store.load()

    expect(store.error).toBe('offline')
    expect(store.alerts).toHaveLength(1)
  })

  it('coupons：失败时两个列表都不清空', async () => {
    const store = useCouponStore()
    api.getCoupons.mockResolvedValueOnce([{ id: 'c1' }] as never)
    api.getMyCoupons.mockResolvedValueOnce([{ id: 'm1' }] as never)
    await store.load()
    expect(store.catalog).toHaveLength(1)
    expect(store.myCoupons).toHaveLength(1)

    api.getCoupons.mockRejectedValueOnce(new Error('boom'))
    api.getMyCoupons.mockRejectedValueOnce(new Error('boom'))
    await store.load()

    expect(store.error).toBe('boom')
    expect(store.catalog).toHaveLength(1)
    expect(store.myCoupons).toHaveLength(1)
  })

  it('拿不到具体原因时用兜底文案，而不是空字符串（空串会被当成"没出错"）', async () => {
    const store = useReturnStore()
    api.getReturns.mockRejectedValueOnce('')
    await store.load()

    expect(store.error).not.toBe('')
  })
})

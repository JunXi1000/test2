import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { useListQuery, type ListQueryTaskContext } from './useListQuery'

/**
 * 这个 spec 的主要任务是把 5b 修的那个 bug 钉死：**清空搜索不再发两次请求**。
 *
 * 为什么钉在这里而不是 E2E：mock 是在 API 模块内部 `if (RUNTIME_USE_MOCK.value)` 直接
 * 短路的（见 `src/api/modules/admin*.ts`），根本不产生网络请求，Playwright 数不到次数。
 * 组合式把 task 做成了注入点，于是在这里 mock 掉 task 直接数调用次数就行。
 */

/** 收集挂载过的组件，afterEach 统一卸载，避免残留的 onMounted 任务串到下一条 */
const mounted: VueWrapper[] = []

/**
 * 在真实组件上下文里调用组合式 —— `onMounted` 在组件外调用只会打一句警告然后静默失效，
 * 那样「挂载即取数」这条根本测不到。
 */
function withSetup<T>(fn: () => T): T {
  let result!: T
  const wrapper = mount(
    defineComponent({
      setup() {
        result = fn()
        return () => h('div')
      },
    }),
  )
  mounted.push(wrapper)
  return result
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
})

/** 一个可以被反复复用、并按需改行为的假 task */
function makeTask<T>(impl?: (ctx: ListQueryTaskContext<T>) => Promise<void>) {
  return vi.fn<(ctx: ListQueryTaskContext<T>) => Promise<void>>(impl ?? (async () => {}))
}

describe('useListQuery', () => {
  it('挂载即取数一次，并把 q/filter 的初值透传给 task', async () => {
    const task = makeTask<number>()
    withSetup(() => useListQuery<number>({ fallbackMessage: 'x', task }))

    await nextTick()
    await Promise.resolve()

    expect(task).toHaveBeenCalledTimes(1)
    expect(task.mock.calls[0][0]).toMatchObject({ q: '', filter: 'all' })
  })

  it('immediate:false 时挂载不取数（给「由父组件决定何时加载」留口子）', async () => {
    const task = makeTask<number>()
    withSetup(() => useListQuery<number>({ fallbackMessage: 'x', task, immediate: false }))

    await nextTick()
    await Promise.resolve()

    expect(task).not.toHaveBeenCalled()
  })

  it('连续输入走 debounce，只在静默 debounceMs 后发一次，且用的是最后一次的词', async () => {
    vi.useFakeTimers()
    const task = makeTask<number>()
    const { searchQuery } = withSetup(() =>
      useListQuery<number>({ fallbackMessage: 'x', task, debounceMs: 300 }),
    )
    await vi.advanceTimersByTimeAsync(0)
    task.mockClear()

    for (const q of ['s', 'sm', 'sma', 'smar', 'smart']) {
      searchQuery.value = q
      await nextTick()
      await vi.advanceTimersByTimeAsync(50) // 每次都在 debounce 到期前又敲一个字
    }

    expect(task).not.toHaveBeenCalled() // 还在防抖窗口里，一次都没发

    await vi.advanceTimersByTimeAsync(300)
    expect(task).toHaveBeenCalledTimes(1)
    expect(task.mock.calls[0][0].q).toBe('smart')
  })

  // ↓↓↓ 5b 的回归钉子 ↓↓↓
  it('清空搜索只发一次请求 —— 迁移前 @clear + watch 会发两次', async () => {
    vi.useFakeTimers()
    const task = makeTask<number>(async ({ commit }) => commit([1, 2, 3]))
    const { searchQuery, items } = withSetup(() =>
      useListQuery<number>({ fallbackMessage: 'x', task, debounceMs: 300 }),
    )
    await vi.advanceTimersByTimeAsync(0)

    searchQuery.value = 'abc'
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    expect(task).toHaveBeenCalledTimes(2) // 挂载那次 + 搜索那次
    task.mockClear()

    // 用户点 clearable 的 ×
    searchQuery.value = ''
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)

    expect(task).toHaveBeenCalledTimes(1)
    expect(task.mock.calls[0][0].q).toBe('')
    expect(items.value).toEqual([1, 2, 3]) // 清空后列表恢复成全量
  })

  /**
   * 上面那条只能证明「组合式自己没有重复发」—— 但如果日后有人把裸 `load` 也导出，
   * 页面再挂回 `@clear="load"`，重复请求的口子就重新打开了，而上面那条依然绿。
   * 5b 的 bug 成因正是这个形状，所以对公开面单独钉一颗钉子。
   *
   * 这条会红的时候，别顺手把它删掉：先问「为什么需要绕过 reloadNow」。
   */
  it('公开面不导出裸 load —— 显式动作只有 reloadNow 一条路', () => {
    const task = makeTask<number>()
    const api = withSetup(() => useListQuery<number>({ fallbackMessage: 'x', task }))

    expect(Object.keys(api).sort()).toEqual([
      'error',
      'filter',
      'isLoading',
      'items',
      'reloadNow',
      'searchQuery',
    ])
  })

  it('debounce 还没到期就 reloadNow（回车 / 点刷新），合起来只发一次', async () => {
    vi.useFakeTimers()
    const task = makeTask<number>()
    const { searchQuery, reloadNow } = withSetup(() =>
      useListQuery<number>({ fallbackMessage: 'x', task, debounceMs: 300 }),
    )
    await vi.advanceTimersByTimeAsync(0)
    task.mockClear()

    searchQuery.value = 'abc'
    await nextTick()
    await vi.advanceTimersByTimeAsync(100) // 故意不到 300，debounce 还挂着
    expect(task).not.toHaveBeenCalled()

    reloadNow()
    await vi.advanceTimersByTimeAsync(1000) // 挂起的那次若没被 cancel，会在这儿冒出来

    expect(task).toHaveBeenCalledTimes(1)
    expect(task.mock.calls[0][0].q).toBe('abc') // 用的是当下最新的搜索词
  })

  it('切筛选走 reloadNow，把新的 filter 透传下去', async () => {
    vi.useFakeTimers()
    const task = makeTask<number>()
    const { filter, reloadNow } = withSetup(() =>
      useListQuery<number>({ fallbackMessage: 'x', task, debounceMs: 300 }),
    )
    await vi.advanceTimersByTimeAsync(0)
    task.mockClear()

    filter.value = 'shipped'
    reloadNow()
    await vi.advanceTimersByTimeAsync(0)

    expect(task).toHaveBeenCalledTimes(1)
    expect(task.mock.calls[0][0].filter).toBe('shipped')
  })

  it('成功：commit 的行进入 items，error 清空、loading 复位', async () => {
    const task = makeTask<number>(async ({ commit }) => commit([7, 8]))
    const { items, error, isLoading } = withSetup(() =>
      useListQuery<number>({ fallbackMessage: 'x', task }),
    )

    await nextTick()
    await Promise.resolve()
    await Promise.resolve()

    expect(items.value).toEqual([7, 8])
    expect(error.value).toBe('')
    expect(isLoading.value).toBe(false)
  })

  it('失败：error 落到 ref（供 ErrorState 用），items 保持上一次结果不被清空', async () => {
    const task = vi
      .fn<(ctx: ListQueryTaskContext<number>) => Promise<void>>()
      .mockImplementationOnce(async ({ commit }) => commit([1, 2]))
      .mockImplementationOnce(async () => {
        throw new Error('Network Error')
      })

    const { items, error, isLoading, reloadNow } = withSetup(() =>
      useListQuery<number>({ fallbackMessage: 'Failed to load', task }),
    )

    await nextTick()
    await Promise.resolve()
    await Promise.resolve()
    expect(items.value).toEqual([1, 2])

    reloadNow()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(error.value).toBe('Network Error')
    expect(isLoading.value).toBe(false)
    // 取数失败时页面会整块换成 ErrorState，但数据本身不该被清掉：
    // 用户点重试成功后要能立刻看到旧内容，而不是先闪一屏空态。
    expect(items.value).toEqual([1, 2])
  })

  it('拿不到具体原因时用 fallbackMessage 兜底', async () => {
    const task = vi.fn<(ctx: ListQueryTaskContext<number>) => Promise<void>>(async () => {
      throw ''
    })
    const { error } = withSetup(() =>
      useListQuery<number>({ fallbackMessage: 'Failed to load merchants', task }),
    )

    await nextTick()
    await Promise.resolve()
    await Promise.resolve()

    expect(error.value).toBe('Failed to load merchants')
  })
})

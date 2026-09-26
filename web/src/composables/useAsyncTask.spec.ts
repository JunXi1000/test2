import { describe, expect, it } from 'vitest'
import { useAsyncTask } from './useAsyncTask'

describe('useAsyncTask', () => {
  it('成功：返回 ok + value，isLoading 在任务执行期间为 true、结束后复位', async () => {
    const { isLoading, error, run } = useAsyncTask()

    expect(isLoading.value).toBe(false)

    let seenDuringTask = false
    const result = await run(async () => {
      seenDuringTask = isLoading.value
      return 42
    })

    expect(seenDuringTask).toBe(true)
    expect(result).toEqual({ ok: true, value: 42 })
    expect(isLoading.value).toBe(false)
    expect(error.value).toBe('')
  })

  it('失败：返回 ok:false + 原因，写进 error ref，isLoading 照样复位', async () => {
    const { isLoading, error, run } = useAsyncTask()

    const result = await run(async () => {
      throw new Error('boom')
    })

    // 用 toMatchObject：失败分支还有 cause（原始抛出物），见下方专门的一条
    expect(result).toMatchObject({ ok: false, error: 'boom' })
    expect(error.value).toBe('boom')
    expect(isLoading.value).toBe(false)
  })

  it('失败分支带原始抛出物 cause —— console.error 要能展开真 Error（含堆栈）', async () => {
    const { run } = useAsyncTask()
    const original = new Error('boom')

    const result = await run(async () => {
      throw original
    })

    expect(result.ok).toBe(false)
    // 必须是同一个引用，不能是折算后的字符串：merchant/Products.vue 迁移前打的就是原始对象
    if (!result.ok) expect(result.cause).toBe(original)
  })

  it('run 不抛：调用点写成顺序代码即可，不需要外层 try/catch', async () => {
    const { run } = useAsyncTask()
    await expect(
      run(async () => {
        throw new Error('x')
      }),
    ).resolves.toMatchObject({ ok: false })
  })

  it('任务体自己返回 false 不算失败 —— 这是 run 不用 boolean 的理由', async () => {
    const { error, run } = useAsyncTask()

    const result = await run(async () => false)

    expect(result).toEqual({ ok: true, value: false })
    expect(error.value).toBe('')
  })

  it('失败原因取 Error.message，拿不到时才用 fallbackMessage', async () => {
    const { run } = useAsyncTask({ fallbackMessage: 'Failed to load products' })

    await expect(
      run(async () => {
        throw new Error('Network Error')
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: 'Network Error',
    })
    await expect(
      run(async () => {
        throw ''
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: 'Failed to load products',
    })
  })

  it('silent：全程不碰 isLoading', async () => {
    const { isLoading, run } = useAsyncTask()

    let seenDuringTask: boolean | null = null
    await run(
      async () => {
        seenDuringTask = isLoading.value
      },
      { silent: true },
    )

    expect(seenDuringTask).toBe(false)
    expect(isLoading.value).toBe(false)
  })

  it('silent 仍然清空上一次的 error —— 否则静默重试时 ErrorState 会赖着不走', async () => {
    const { error, run } = useAsyncTask({ fallbackMessage: 'failed' })

    await run(async () => {
      throw new Error('第一次失败')
    })
    expect(error.value).toBe('第一次失败')

    // Retry 走的正是 silent 分支（不需要骨架屏），此时旧错误必须被清掉
    await run(async () => {}, { silent: true })
    expect(error.value).toBe('')
  })

  it('silent 时失败照常写 error', async () => {
    const { error, run } = useAsyncTask()
    await run(
      async () => {
        throw new Error('追加失败')
      },
      { silent: true },
    )
    expect(error.value).toBe('追加失败')
  })

  it('reportError:false —— 返回值里有原因，但不污染 error ref（轮询/后台任务用）', async () => {
    const { error, run } = useAsyncTask({ reportError: false })

    const result = await run(async () => {
      throw new Error('轮询失败')
    })

    expect(result).toMatchObject({ ok: false, error: '轮询失败' })
    expect(error.value).toBe('')
  })

  it('下一次 run 开始前清掉上一次的 error', async () => {
    const { error, run } = useAsyncTask()

    await run(async () => {
      throw new Error('旧错误')
    })
    expect(error.value).toBe('旧错误')

    await run(async () => 'ok')
    expect(error.value).toBe('')
  })

  it('reset 手动复位两个状态', async () => {
    const { isLoading, error, run, reset } = useAsyncTask()

    await run(async () => {
      throw new Error('err')
    })
    reset()

    expect(isLoading.value).toBe(false)
    expect(error.value).toBe('')
  })
})

import { ref } from 'vue'
import { toErrorMessage } from '@/utils/error'

/**
 * 任务的结果是一个可辨识联合，而不是 `boolean`。
 *
 * 原因：有调用点的任务体**自己就会返回 false**（Home.vue 的 fetchProducts 在
 * 「没有更多数据」时于 try 内部 `return false`）。如果 run() 也返回 boolean，
 * 「任务说没有更多了」和「任务抛异常了」就分不开，调用点只能靠再读一次 error ref 猜。
 * 联合类型让两种情况在类型上就是两条分支。
 */
export type AsyncTaskResult<T> =
  | { ok: true; value: T }
  | {
      ok: false
      /** 折算好的、可以直接给用户看的原因 */
      error: string
      /**
       * 原始抛出物。给 `console.error` 之类**诊断**用途留的口子 —— 报给用户的永远是
       * `error` 那句字符串，但控制台里应该还能展开真正的 Error（含堆栈）。
       * merchant/Products.vue 迁移前打的就是原始对象，没有这个字段就等于丢了它。
       */
      cause: unknown
    }

export interface RunOptions {
  /**
   * 本次不翻转 isLoading。用于「加载更多」这类**不该让整块内容变骨架屏**的追加请求。
   *
   * 注意它**只管 loading 一个标志，不影响 error**：error 该清还是清、该写还是写。
   * 两者必须分开 —— Home.vue 的 Retry 走的就是 silent 分支（只在首屏空列表时显示骨架屏），
   * 如果连 error 一起不清，点了 Retry 的 ErrorState 会原地不动，看起来像按钮坏了。
   */
  silent?: boolean
}

export interface UseAsyncTaskOptions {
  /** 拿不到具体原因时的兜底文案；各调用点应传入自己原有的那句，避免改变用户可见文案 */
  fallbackMessage?: string
  /** 失败时是否把原因写进 error ref，默认写。轮询/后台任务传 false，避免无声失败覆盖正常内容 */
  reportError?: boolean
  /**
   * isLoading 的初值，默认 false。
   *
   * 本项目 13 个页面的加载标志都是 `ref(true)`：请求在 onMounted 里才发起，而首屏渲染
   * 早于 onMounted，初值给 false 的话首帧会先渲染出「空态 / 错误态」再被骨架屏顶掉。
   * 迁移时**照抄原初值**，不要顺手统一成 false。
   */
  initialLoading?: boolean
}

/**
 * 页面加载器的统一形态：三个状态（isLoading / error / 数据）+ 一次执行。
 *
 * 约定：**首次加载失败要写进 error（渲染 ErrorState），轮询/追加失败只 toast，不要写 error。**
 * 两者语义不同，别合成一个 catch —— 阶段 3 挖出的真 bug 就是合成后 ErrorState 从没渲染过。
 */
export function useAsyncTask(options: UseAsyncTaskOptions = {}) {
  const fallbackMessage = options.fallbackMessage ?? 'Something went wrong. Please try again.'
  const reportError = options.reportError ?? true

  const isLoading = ref(options.initialLoading ?? false)
  const error = ref('')

  async function run<T>(
    task: () => Promise<T>,
    opts: RunOptions = {},
  ): Promise<AsyncTaskResult<T>> {
    const silent = opts.silent ?? false

    error.value = ''
    if (!silent) isLoading.value = true

    try {
      return { ok: true, value: await task() }
    } catch (e) {
      const message = toErrorMessage(e, fallbackMessage)
      if (reportError) error.value = message
      return { ok: false, error: message, cause: e }
    } finally {
      if (!silent) isLoading.value = false
    }
  }

  /** 手动复位（如切换筛选条件、离开页面时）。task 自身不清空 error 之外的任何状态。 */
  function reset() {
    isLoading.value = false
    error.value = ''
  }

  return { isLoading, error, run, reset }
}

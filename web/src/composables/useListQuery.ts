import { onMounted, ref, watch, type Ref } from 'vue'
import { debounce } from 'lodash-es'
import { useAsyncTask } from '@/composables/useAsyncTask'

/** 交给页面 `task` 的上下文 */
export interface ListQueryTaskContext<T> {
  /** 当前搜索词 */
  q: string
  /** 当前筛选值。多数页是 status，Users 是 role —— 组合式不关心语义，只负责透传 */
  filter: string
  /**
   * 把取到的行交给列表。**在 `run` 回调内部调用**。
   *
   * 之所以是「页面调 commit」而不是「组合式拿到返回值自己赋值」：赋值之后的收尾必须
   * 仍然发生在 `useAsyncTask` 复位 loading **之前**。merchant/Products.vue 的
   * 「至少转够 minSpinnerMs」正是这种收尾 —— 挪到 `await` 之后 spinner 早就没了。
   */
  commit: (rows: T[]) => void
}

export interface UseListQueryOptions<T> {
  /** 拿不到具体原因时的兜底文案。各页传自己原有的那句，避免改变用户可见文案 */
  fallbackMessage: string
  /** 取数任务体，由页面提供 —— 组合式不碰任何具体 API */
  task: (ctx: ListQueryTaskContext<T>) => Promise<void>
  /** 搜索防抖毫秒，默认 300（与迁移前各页一致） */
  debounceMs?: number
  /** 透传给 useAsyncTask。**照抄各页原初值**，不要顺手统一 */
  initialLoading?: boolean
  /** 是否在 onMounted 自动取一次，默认 true */
  immediate?: boolean
}

/**
 * 列表页的六件套：数据 / 搜索词 / 筛选值 / loading / error / 取数管道。
 *
 * **搜索只有一条路**：`watch(searchQuery)` → debounce → load。任何显式动作（回车、
 * 刷新、切筛选、重试）都走 `reloadNow()`，它先取消挂起的 debounce 再立即取数。
 * 5b 修的正是「清空搜索发两个请求」—— 当时 `@clear` 立即发一次、watch 随后又补发
 * 一次。把显式动作统一收敛到 `reloadNow` 之后，这类重复不会再出现；也**刻意不导出
 * 未取消 debounce 的裸 load**，免得调用点又绕开这条规矩。
 */
export function useListQuery<T>(options: UseListQueryOptions<T>) {
  const debounceMs = options.debounceMs ?? 300

  const { isLoading, error, run } = useAsyncTask({
    fallbackMessage: options.fallbackMessage,
    initialLoading: options.initialLoading,
  })

  // ref([]) 会被推断成 never[]，这里显式标注
  const items = ref([]) as Ref<T[]>
  const searchQuery = ref('')
  const filter = ref('all')

  const load = async () => {
    await run(() =>
      options.task({
        q: searchQuery.value,
        filter: filter.value,
        commit: (rows) => {
          items.value = rows
        },
      }),
    )
  }

  const debouncedLoad = debounce(load, debounceMs)

  watch(searchQuery, () => {
    debouncedLoad()
  })

  /** 立即取数（回车 / 刷新 / 切筛选 / 重试）：先取消挂起的 debounce，避免重复发一次 */
  const reloadNow = () => {
    debouncedLoad.cancel()
    void load()
  }

  if (options.immediate !== false) onMounted(load)

  return { items, searchQuery, filter, isLoading, error, reloadNow }
}

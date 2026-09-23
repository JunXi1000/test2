import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { onUserScopeChange, scopedKey } from './userScope'
import { RUNTIME_USE_MOCK } from '@/config/env'
import { toErrorMessage } from '@/utils/error'
import {
  getReturns,
  createReturn,
  type ReturnRequest,
  type SubmitReturnPayload,
} from '@/api/modules/returns'

export type { ReturnRequest } from '@/api/modules/returns'

const STORAGE_KEY = 'nexus_return_requests'

function loadFromStorage(): ReturnRequest[] {
  try {
    return JSON.parse(localStorage.getItem(scopedKey(STORAGE_KEY)) || '[]')
  } catch {
    return []
  }
}
function saveToStorage(items: ReturnRequest[]) {
  localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(items))
}

export const useReturnStore = defineStore('returns', () => {
  const requests = ref<ReturnRequest[]>([])

  /**
   * 取数失败的原因（空串 = 没出错）。
   *
   * 为什么要有它：原先 catch 里是 `requests.value = []`，于是**加载失败**与**一条退换记录
   * 都没有**在界面上长得一模一样 —— 接口挂了，用户看到的是「没有退换申请」。
   * 这类缺陷阶段 3/5 在页面上修过几处，这里是 store 侧的同一问题。
   */
  const error = ref('')

  /** Hydrate from backend (non-mock) or local storage (mock). */
  async function load() {
    error.value = ''
    if (RUNTIME_USE_MOCK.value) {
      requests.value = loadFromStorage()
      return
    }
    try {
      requests.value = await getReturns()
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to load return requests')
      // **刻意不清空** requests：清空正是让失败看起来像空态的原因。
      // 保留上一次的数据，页面按 error 决定显示错误态还是列表。
    }
  }

  onUserScopeChange(() => {
    load()
  })

  const pending = computed(() => requests.value.filter((r) => r.status === 'pending'))
  const resolved = computed(() => requests.value.filter((r) => r.status !== 'pending'))

  async function submitRequest(data: SubmitReturnPayload): Promise<ReturnRequest> {
    if (RUNTIME_USE_MOCK.value) {
      const req: ReturnRequest = {
        id: `RET-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase(),
        ...data,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      requests.value.unshift(req)
      saveToStorage(requests.value)
      return req
    }

    const created = await createReturn(data)
    requests.value.unshift(created)
    return created
  }

  function getByOrderId(orderId: string): ReturnRequest | undefined {
    return requests.value.find((r) => r.orderId === orderId)
  }

  return { requests, error, pending, resolved, submitRequest, getByOrderId, load }
})

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { onUserScopeChange, scopedKey } from './userScope'
import { RUNTIME_USE_MOCK } from '@/config/env'
import { getReturns, createReturn, type ReturnRequest, type SubmitReturnPayload } from '@/api/modules/returns'

export type { ReturnRequest } from '@/api/modules/returns'

const STORAGE_KEY = 'nexus_return_requests'

function loadFromStorage(): ReturnRequest[] {
  try {
    return JSON.parse(localStorage.getItem(scopedKey(STORAGE_KEY)) || '[]')
  } catch { return [] }
}
function saveToStorage(items: ReturnRequest[]) {
  localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(items))
}

export const useReturnStore = defineStore('returns', () => {
  const requests = ref<ReturnRequest[]>([])

  /** Hydrate from backend (non-mock) or local storage (mock). */
  async function load() {
    if (RUNTIME_USE_MOCK.value) {
      requests.value = loadFromStorage()
      return
    }
    try {
      requests.value = await getReturns()
    } catch {
      requests.value = []
    }
  }

  onUserScopeChange(() => {
    load()
  })

  const pending = computed(() => requests.value.filter(r => r.status === 'pending'))
  const resolved = computed(() => requests.value.filter(r => r.status !== 'pending'))

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
    return requests.value.find(r => r.orderId === orderId)
  }

  return { requests, pending, resolved, submitRequest, getByOrderId, load }
})

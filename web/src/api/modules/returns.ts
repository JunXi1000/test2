import { USE_MOCK } from '@/config/env'
import { get, post } from '@/api/http'

export interface ReturnRequest {
  id: string
  orderId: string
  productTitle: string
  productImage: string
  reason: string
  detail: string
  status: 'pending' | 'approved' | 'rejected' | 'refunded'
  refundAmount: number
  createdAt: number
  updatedAt: number
}

export type SubmitReturnPayload = Omit<ReturnRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>

/** Current user's return requests (backend GET /returns). */
export async function getReturns(): Promise<ReturnRequest[]> {
  if (USE_MOCK) return []
  return get<ReturnRequest[]>('/returns')
}

/** Submit a return request (backend POST /returns). Returns the persisted record. */
export async function createReturn(data: SubmitReturnPayload): Promise<ReturnRequest> {
  if (USE_MOCK) {
    return {
      ...data,
      id: `RET-MOCK-${Date.now()}`,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }
  return post<ReturnRequest>('/returns', data)
}

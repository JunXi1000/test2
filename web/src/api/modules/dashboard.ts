import { USE_MOCK } from '@/config/env'
import { get } from '@/api/http'
import { getMergedMockOrders } from '@/api/modules/orders'

export interface Stat { label: string; value: string; change?: string; icon?: string }

function computeStatsFromOrders(): Stat[] {
  const orders = getMergedMockOrders()
  const total = orders.length
  const inTransit = orders.filter((o) => o.status === 'In Transit').length
  const completed = orders.filter((o) => o.status === 'Delivered').length
  const cancelled = orders.filter((o) => o.status === 'Cancelled').length
  const pending = Math.max(0, total - inTransit - completed - cancelled)
  return [
    { label: 'Total Orders', value: String(total) },
    { label: 'In Transit', value: String(inTransit) },
    { label: 'Pending', value: String(pending) },
    { label: 'Completed', value: String(completed) }
  ]
}

export async function getUserDashboardStats(): Promise<Stat[]> {
  if (USE_MOCK) return Promise.resolve(computeStatsFromOrders())
  return get<Stat[]>('/dashboard/stats')
}

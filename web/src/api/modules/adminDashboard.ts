import { USE_MOCK } from '@/config/env'
import { get } from '@/api/http'

export interface AdminStat { label: string; value: string; change: string; icon: 'DollarSign'|'Users'|'ShoppingBag'|'Activity' }
export interface RecentUser { name: string; email: string; joinedAt: string }
export interface RevenueData { date: string; value: number }

const MOCK_ADMIN_STATS: AdminStat[] = [
  { label: 'Total Revenue', value: '$45,231.89', change: '+20.1%', icon: 'DollarSign' },
  { label: 'Active Users', value: '2,350', change: '+180.1%', icon: 'Users' },
  { label: 'Sales', value: '+12,234', change: '+19%', icon: 'ShoppingBag' },
  { label: 'Active Now', value: '573', change: '+201', icon: 'Activity' },
]

const MOCK_RECENT_USERS: RecentUser[] = [
  { name: 'Alex Doe', email: 'alex@example.com', joinedAt: '2026-10-24' },
  { name: 'Maria Chen', email: 'maria@example.com', joinedAt: '2026-10-23' },
  { name: 'John Smith', email: 'john@example.com', joinedAt: '2026-10-22' },
]

const MOCK_REVENUE_CHART: RevenueData[] = [
  { date: 'Mon', value: 4000 },
  { date: 'Tue', value: 3000 },
  { date: 'Wed', value: 5000 },
  { date: 'Thu', value: 2780 },
  { date: 'Fri', value: 1890 },
  { date: 'Sat', value: 2390 },
  { date: 'Sun', value: 3490 },
]

export async function getAdminDashboardStats(): Promise<AdminStat[]> {
  if (USE_MOCK) return Promise.resolve(MOCK_ADMIN_STATS)
  return get<AdminStat[]>('/admin/dashboard/stats')
}

export async function getRecentUsers(): Promise<RecentUser[]> {
  if (USE_MOCK) return Promise.resolve(MOCK_RECENT_USERS)
  return get<RecentUser[]>('/admin/dashboard/recent-users')
}

export async function getRevenueChartData(): Promise<RevenueData[]> {
  if (USE_MOCK) return Promise.resolve(MOCK_REVENUE_CHART)
  return get<RevenueData[]>('/admin/dashboard/revenue-chart')
}

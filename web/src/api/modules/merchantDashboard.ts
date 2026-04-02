import { USE_MOCK } from '@/config/env'
import { get } from '@/api/http'

export interface MerchantStat { label: string; value: string; change: string; icon: 'DollarSign'|'ShoppingCart'|'Package'|'TrendingUp' }
export interface LowStock { title: string; sku: string; stock: number }

const MOCK_MERCHANT_STATS: MerchantStat[] = [
  { label: 'Total Sales', value: '$12,450.00', change: '+12%', icon: 'DollarSign' },
  { label: 'Orders', value: '156', change: '+8%', icon: 'ShoppingCart' },
  { label: 'Products', value: '45', change: '0%', icon: 'Package' },
  { label: 'Conversion Rate', value: '3.2%', change: '+1.1%', icon: 'TrendingUp' },
]

const MOCK_LOW_STOCK: LowStock[] = [
  { title: 'Nexus VR Strap', sku: 'NX-STR-01', stock: 5 },
  { title: 'Charging Dock', sku: 'CH-DK-02', stock: 3 },
  { title: 'Lens Protector', sku: 'LN-PR-07', stock: 2 },
]

export async function getMerchantDashboardStats(): Promise<MerchantStat[]> {
  if (USE_MOCK) return Promise.resolve(MOCK_MERCHANT_STATS)
  return get<MerchantStat[]>('/merchant/dashboard/stats')
}

export async function getLowStock(): Promise<LowStock[]> {
  if (USE_MOCK) return Promise.resolve(MOCK_LOW_STOCK)
  return get<LowStock[]>('/merchant/dashboard/low-stock')
}

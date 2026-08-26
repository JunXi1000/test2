import { get, post } from '@/api/http'
import { RUNTIME_USE_MOCK } from '@/config/env'

export interface MerchantWallet {
  balance: number
  pending: number
  currency: string
}

export interface WalletTransaction {
  id: string
  type: 'sale' | 'withdrawal' | 'refund' | 'fee'
  amount: number
  status: 'completed' | 'pending' | 'failed'
  date: string
  description: string
}

const MOCK_WALLET: MerchantWallet = {
  balance: 12450.00,
  pending: 340.00,
  currency: 'USD'
}

const MOCK_TRANSACTIONS: WalletTransaction[] = [
  { id: 'TX-001', type: 'sale', amount: 899.00, status: 'completed', date: '2023-10-25', description: 'Order #ORD-2023-001' },
  { id: 'TX-002', type: 'withdrawal', amount: -5000.00, status: 'completed', date: '2023-10-24', description: 'Payout to Bank **** 1234' },
  { id: 'TX-003', type: 'sale', amount: 299.00, status: 'completed', date: '2023-10-23', description: 'Order #ORD-2023-002' },
  { id: 'TX-004', type: 'fee', amount: -25.00, status: 'completed', date: '2023-10-23', description: 'Monthly Subscription' },
  { id: 'TX-005', type: 'sale', amount: 340.00, status: 'pending', date: '2023-10-26', description: 'Order #ORD-2023-006 (Escrow)' }
]

export async function getWalletBalance(): Promise<MerchantWallet> {
  if (RUNTIME_USE_MOCK.value) return Promise.resolve(MOCK_WALLET)
  return get<MerchantWallet>('/merchant/wallet')
}

export async function getTransactions(): Promise<WalletTransaction[]> {
  if (RUNTIME_USE_MOCK.value) return Promise.resolve(MOCK_TRANSACTIONS)
  return get<WalletTransaction[]>('/merchant/wallet/transactions')
}

export async function withdrawFunds(
  amount: number,
  meta?: { destinationId?: string; destinationLabel?: string }
): Promise<void> {
  const label = (meta?.destinationLabel || '').trim() || 'Saved payout method'
  if (RUNTIME_USE_MOCK.value) {
    if (amount > MOCK_WALLET.balance) throw new Error('Insufficient funds')
    MOCK_WALLET.balance -= amount
    MOCK_TRANSACTIONS.unshift({
      id: `TX-${Date.now()}`,
      type: 'withdrawal',
      amount: -amount,
      status: 'pending',
      date: new Date().toISOString().split('T')[0],
      description: `Withdrawal — ${label}`
    })
    return Promise.resolve()
  }
  return post('/merchant/wallet/withdraw', {
    amount,
    destinationId: meta?.destinationId,
    destinationLabel: meta?.destinationLabel
  })
}

/**
 * 积分 / 会员体系（阶段 5.1）
 *
 * 纯配置 + 纯函数：等级门槛、积分抵扣率、积分商城奖励目录。
 * 用户积分 / 累计消费状态由 `stores/loyalty.ts` 按用户作用域持久化，
 * 本模块不读写存储，只提供规则，便于 mock / 后端两种模式复用。
 */
export type LoyaltyTier = 'Silver' | 'Gold' | 'Platinum'

/** 抵扣率：100 积分 = $1 */
export const POINTS_PER_DOLLAR = 100

/** 返点率：消费 $1 = 1 积分（按实付金额向下取整） */
export const EARN_RATE = 1

export interface TierConfig {
  tier: LoyaltyTier
  /** 达到该等级所需累计消费（美元） */
  minSpend: number
  /** 等级积分倍率（预留，展示用） */
  multiplier: number
}

export const TIER_CONFIG: readonly TierConfig[] = [
  { tier: 'Silver', minSpend: 0, multiplier: 1 },
  { tier: 'Gold', minSpend: 500, multiplier: 1.5 },
  { tier: 'Platinum', minSpend: 2000, multiplier: 2 },
]

export interface LoyaltyReward {
  id: string
  title: string
  description: string
  /** 兑换所需积分 */
  cost: number
  type: 'coupon'
  /** 兑换后生成的优惠券码 */
  code: string
  discount: number
  minOrder: number
}

/** 积分商城奖励目录（兑换 → 优惠券入账） */
export const POINTS_MALL: readonly LoyaltyReward[] = [
  {
    id: 'loyal5',
    title: '$5 Off Any Order',
    description: 'Flat $5 off your next order',
    cost: 500,
    type: 'coupon',
    code: 'LOYAL5',
    discount: 5,
    minOrder: 0,
  },
  {
    id: 'loyal15',
    title: '$15 Off Orders Over $75',
    description: 'Flat $15 off orders over $75',
    cost: 1000,
    type: 'coupon',
    code: 'LOYAL15',
    discount: 15,
    minOrder: 75,
  },
  {
    id: 'loyal40',
    title: '$40 Off Orders Over $200',
    description: 'Flat $40 off orders over $200',
    cost: 2500,
    type: 'coupon',
    code: 'LOYAL40',
    discount: 40,
    minOrder: 200,
  },
]

/** 根据累计消费返回当前等级 */
export function getTier(spend: number): LoyaltyTier {
  let tier: LoyaltyTier = 'Silver'
  for (const t of TIER_CONFIG) {
    if (spend >= t.minSpend) tier = t.tier
  }
  return tier
}

/** 下一等级信息；已达最高等级返回 null */
export function getNextTier(spend: number): { tier: LoyaltyTier; minSpend: number } | null {
  const next = TIER_CONFIG.find(t => spend < t.minSpend)
  return next ? { tier: next.tier, minSpend: next.minSpend } : null
}

/** 距下一等级的进度 0-100（已达最高等级恒为 100） */
export function getTierProgress(spend: number): number {
  const idx = TIER_CONFIG.findIndex(t => spend < t.minSpend)
  if (idx === -1) return 100
  const lower = TIER_CONFIG[idx - 1] || TIER_CONFIG[0]
  const upper = TIER_CONFIG[idx]
  const span = upper.minSpend - lower.minSpend
  const progress = ((spend - lower.minSpend) / span) * 100
  return Math.min(100, Math.max(0, Math.round(progress)))
}

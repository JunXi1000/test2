/**
 * 积分 / 会员体系 store（阶段 5.1）
 *
 * 状态（积分余额、累计消费、已兑换奖励）按用户作用域隔离持久化到 localStorage，
 * 登录/登出时通过 userScope 广播自动重载。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { onUserScopeChange, scopedKey } from './userScope'
import {
  EARN_RATE,
  POINTS_PER_DOLLAR,
  POINTS_MALL,
  getTier,
  getNextTier,
  getTierProgress,
  type LoyaltyReward,
  type LoyaltyTier,
} from '@/api/modules/loyalty'

export { POINTS_MALL }
export type { LoyaltyReward, LoyaltyTier } from '@/api/modules/loyalty'

const STORAGE_KEY = 'nexus_loyalty'

export interface LoyaltyState {
  points: number
  lifetimeSpend: number
  redeemed: string[]
}

const EMPTY_STATE: LoyaltyState = { points: 0, lifetimeSpend: 0, redeemed: [] }

function loadState(): LoyaltyState {
  try {
    const raw = localStorage.getItem(scopedKey(STORAGE_KEY))
    if (!raw) return { ...EMPTY_STATE }
    const parsed = JSON.parse(raw)
    return {
      points: Number(parsed.points) || 0,
      lifetimeSpend: Number(parsed.lifetimeSpend) || 0,
      redeemed: Array.isArray(parsed.redeemed) ? parsed.redeemed : [],
    }
  } catch {
    return { ...EMPTY_STATE }
  }
}

function saveState(state: LoyaltyState) {
  try {
    localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(state))
  } catch { /* storage unavailable */ }
}

export const useLoyaltyStore = defineStore('loyalty', () => {
  const state = ref<LoyaltyState>(loadState())

  const tier = computed<LoyaltyTier>(() => getTier(state.value.lifetimeSpend))
  const nextTier = computed(() => getNextTier(state.value.lifetimeSpend))
  const tierProgress = computed(() => getTierProgress(state.value.lifetimeSpend))
  /** 当前积分可抵扣金额（100 积分 = $1，向下取整） */
  const redeemableValue = computed(() => Math.floor(state.value.points / POINTS_PER_DOLLAR))

  /** 积分 → 美元（向下取整） */
  const pointsToDollars = (points: number) => Math.floor(points / POINTS_PER_DOLLAR)

  /** 订单完成后返积分（实付 $1 = 1 积分），返回本次获得积分数 */
  function earnPoints(paidAmount: number): number {
    const earned = Math.floor(Math.max(0, paidAmount) * EARN_RATE)
    if (earned > 0) {
      state.value.points += earned
      saveState(state.value)
    }
    return earned
  }

  /** 累计消费（决定等级），按实付金额累加 */
  function recordSpend(paidAmount: number) {
    state.value.lifetimeSpend = +(state.value.lifetimeSpend + Math.max(0, paidAmount)).toFixed(2)
    saveState(state.value)
  }

  /** 结算时积分抵扣：扣除 points（100 的整数倍），返回可抵扣美元金额 */
  function spendPoints(points: number): number {
    const use = Math.min(Math.max(0, points), state.value.points)
    const dollars = Math.floor(use / POINTS_PER_DOLLAR)
    if (dollars <= 0) return 0
    state.value.points -= dollars * POINTS_PER_DOLLAR
    saveState(state.value)
    return dollars
  }

  const isRedeemed = (rewardId: string) => state.value.redeemed.includes(rewardId)

  /** 积分商城兑换奖励；成功返回奖励并扣积分，否则返回 null */
  function redeem(rewardId: string): LoyaltyReward | null {
    const reward = POINTS_MALL.find(r => r.id === rewardId)
    if (!reward || isRedeemed(rewardId) || state.value.points < reward.cost) return null
    state.value.points -= reward.cost
    state.value.redeemed.push(rewardId)
    saveState(state.value)
    return reward
  }

  // 登录/登出时按新用户作用域重新加载
  onUserScopeChange(() => {
    state.value = loadState()
  })

  return {
    state,
    tier,
    nextTier,
    tierProgress,
    redeemableValue,
    pointsToDollars,
    earnPoints,
    recordSpend,
    spendPoints,
    redeem,
    isRedeemed,
  }
})

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Coins, Award, Sparkles, Gift, Ticket, ArrowRight } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import { useToast } from '@/composables/useToast'
import { useLoyaltyStore, POINTS_MALL, type LoyaltyReward } from '@/stores/loyalty'
import { useCouponStore } from '@/stores/coupons'
import { POINTS_PER_DOLLAR } from '@/api/modules/loyalty'

const loyaltyStore = useLoyaltyStore()
const couponStore = useCouponStore()
const { toast } = useToast()
const { t } = useI18n()
const router = useRouter()

const tierBadgeClass: Record<string, string> = {
  Silver: 'bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200',
  Gold: 'bg-amber-400/20 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400',
  Platinum: 'bg-cyan-400/20 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300',
}

const tierIcon = computed(() => {
  const map: Record<string, any> = { Silver: Coins, Gold: Award, Platinum: Sparkles }
  return map[loyaltyStore.tier] || Coins
})

function tierLabel(tier: string): string {
  return t(`loyalty.${tier.toLowerCase()}`)
}

function handleRedeem(reward: LoyaltyReward) {
  if (loyaltyStore.state.points < reward.cost) {
    toast({
      title: t('loyalty.insufficient'),
      description: t('loyalty.insufficientDesc', { need: reward.cost, have: loyaltyStore.state.points }),
      variant: 'destructive',
    })
    return
  }
  if (loyaltyStore.isRedeemed(reward.id)) {
    toast({ title: t('loyalty.insufficient'), description: t('loyalty.redeemedAlready'), variant: 'destructive' })
    return
  }
  const redeemed = loyaltyStore.redeem(reward.id)
  if (!redeemed) return
  couponStore.addRedeemedCoupon({
    id: redeemed.id,
    code: redeemed.code,
    title: redeemed.title,
    description: redeemed.description,
    type: 'fixed',
    value: redeemed.discount,
    minOrder: redeemed.minOrder,
  })
  toast({
    title: t('loyalty.redeemSuccess'),
    description: t('loyalty.redeemSuccessDesc', { code: redeemed.code }),
    variant: 'success',
  })
}

function goCoupons() {
  router.push('/dashboard/coupons')
}
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-bold mb-2">{{ $t('loyalty.title') }}</h1>
      <p class="text-muted-foreground">{{ $t('loyalty.subtitle') }}</p>
    </div>

    <!-- 积分余额 + 等级 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="p-6 rounded-2xl bg-gradient-to-br from-primary/15 to-background border border-primary/20">
        <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
          <Coins class="w-4 h-4 text-primary" />
          {{ $t('loyalty.balanceTitle') }}
        </div>
        <div class="flex items-end gap-2">
          <span class="text-4xl font-bold tracking-tight">{{ loyaltyStore.state.points }}</span>
          <span class="text-sm text-muted-foreground mb-1.5">pts</span>
        </div>
        <p class="text-xs text-muted-foreground mt-2">
          {{ $t('loyalty.redeemableValue') }}:
          <span class="text-primary font-medium">${{ loyaltyStore.redeemableValue }}</span>
          <span class="text-muted-foreground/70">（{{ POINTS_PER_DOLLAR }} pts = $1）</span>
        </p>
      </div>

      <div class="p-6 rounded-2xl border border-border bg-card">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <component :is="tierIcon" class="w-4 h-4 text-primary" />
            {{ $t('loyalty.tierTitle') }}
          </div>
          <span class="text-xs px-2.5 py-1 rounded-full font-semibold" :class="tierBadgeClass[loyaltyStore.tier] || ''">
            {{ tierLabel(loyaltyStore.tier) }}
          </span>
        </div>

        <p class="text-lg font-bold">
          {{ $t('loyalty.currentTier', { tier: tierLabel(loyaltyStore.tier) }) }}
        </p>

        <div class="mt-4">
          <div class="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span v-if="loyaltyStore.nextTier">
              {{ $t('loyalty.progressTo', { tier: tierLabel(loyaltyStore.nextTier.tier) }) }}
            </span>
            <span v-else>{{ $t('loyalty.maxTier') }}</span>
            <span>{{ Math.round(loyaltyStore.tierProgress) }}%</span>
          </div>
          <div class="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              class="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
              :style="{ width: loyaltyStore.tierProgress + '%' }"
            />
          </div>
          <p class="text-xs text-muted-foreground mt-1.5">
            <template v-if="loyaltyStore.nextTier">
              {{ $t('loyalty.spendTo', { amount: (loyaltyStore.nextTier.minSpend - loyaltyStore.state.lifetimeSpend).toFixed(0), tier: tierLabel(loyaltyStore.nextTier.tier) }) }}
            </template>
            <template v-else>
              {{ $t('loyalty.lifetimeSpend', { amount: loyaltyStore.state.lifetimeSpend.toFixed(0) }) }}
            </template>
          </p>
        </div>
      </div>
    </div>

    <!-- 如何赚取 -->
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 rounded-xl border border-border bg-secondary/10 text-sm text-muted-foreground">
      <span class="flex items-center gap-2"><Coins class="w-4 h-4 text-primary" /> {{ $t('loyalty.earnRule') }}</span>
      <span class="flex items-center gap-2"><Award class="w-4 h-4 text-primary" /> {{ $t('loyalty.tierRule') }}</span>
      <Button size="sm" variant="ghost" class="ml-auto text-primary" @click="goCoupons">
        {{ $t('loyalty.goCoupons') }} <ArrowRight class="w-4 h-4 ml-1" />
      </Button>
    </div>

    <!-- 积分商城 -->
    <div>
      <h2 class="text-lg font-bold mb-4 flex items-center gap-2">
        <Gift class="w-5 h-5 text-primary" />
        {{ $t('loyalty.pointsMall') }}
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          v-for="reward in POINTS_MALL"
          :key="reward.id"
          class="flex flex-col p-5 rounded-2xl border border-border bg-card transition-colors"
          :class="loyaltyStore.isRedeemed(reward.id) ? 'opacity-60' : 'hover:border-primary/40'"
        >
          <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
            <Ticket class="w-5 h-5" />
          </div>
          <h3 class="font-semibold">{{ reward.title }}</h3>
          <p class="text-xs text-muted-foreground mt-1 flex-1">{{ reward.description }}</p>
          <div class="flex items-center justify-between mt-4">
            <span class="text-sm font-bold text-primary">{{ reward.cost }} pts</span>
            <Button
              size="sm"
              :disabled="loyaltyStore.state.points < reward.cost || loyaltyStore.isRedeemed(reward.id)"
              @click="handleRedeem(reward)"
            >
              {{ loyaltyStore.isRedeemed(reward.id) ? $t('loyalty.redeemed') : $t('loyalty.redeem') }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

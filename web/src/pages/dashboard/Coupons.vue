<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useCouponStore } from '@/stores/coupons'
import { useToast } from '@/composables/useToast'
import Button from '@/components/ui/button/Button.vue'
import Card from '@/components/ui/card/Card.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { Ticket, Tag, Gift, Clock, Check, Zap } from 'lucide-vue-next'

const couponStore = useCouponStore()
const { toast } = useToast()

const isLoadingRef = ref(true)
const activeTab = ref<'available' | 'mine'>('available')

onMounted(async () => {
  await couponStore.load()
  isLoadingRef.value = false
})

async function handleClaim(couponId: string) {
  const ok = await couponStore.claimCoupon(couponId)
  if (ok) {
    toast({ title: 'Coupon Claimed!', description: 'Coupon added to your account.', variant: 'success' })
  } else {
    toast({ title: 'Already Claimed', description: 'You already have this coupon.', variant: 'destructive' })
  }
}

function formatExpiry(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 3600 * 24))
  if (days <= 0) return 'Expired'
  if (days === 1) return '1 day left'
  if (days <= 3) return `${days} days left`
  return `Expires ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function getCouponIcon(type: string) {
  switch (type) {
    case 'percent': return Tag
    case 'fixed': return Gift
    case 'shipping': return Zap
    default: return Ticket
  }
}

function getCouponColor(type: string): string {
  switch (type) {
    case 'percent': return 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/20 dark:border-orange-800 dark:text-orange-400'
    case 'fixed': return 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400'
    case 'shipping': return 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-400'
    default: return 'bg-secondary border-border'
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Coupons & Offers</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ couponStore.available.length }} coupon{{ couponStore.available.length !== 1 ? 's' : '' }} available
        </p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
      <button
        @click="activeTab = 'available'"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all"
        :class="activeTab === 'available' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
      >
        Available Coupons
      </button>
      <button
        @click="activeTab = 'mine'"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5"
        :class="activeTab === 'mine' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
      >
        My Coupons
        <span class="text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">{{ couponStore.available.length }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoadingRef" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card v-for="i in 4" :key="i" class="p-6 space-y-3">
        <Skeleton class="h-5 w-20" />
        <Skeleton class="h-6 w-3/4" />
        <Skeleton class="h-4 w-full" />
      </Card>
    </div>

    <!-- Available tab -->
    <div v-else-if="activeTab === 'available'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card
        v-for="coupon in couponStore.catalog"
        :key="coupon.id"
        class="p-5 border-l-4 transition-all hover:shadow-md relative overflow-hidden"
        :class="[
          getCouponColor(coupon.type),
          couponStore.hasClaimed(coupon.id) ? 'opacity-60' : ''
        ]"
      >
        <div class="absolute -right-4 -top-4 w-16 h-16 rounded-full border-2 border-current opacity-10" />
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <component :is="getCouponIcon(coupon.type)" class="w-4 h-4 shrink-0" />
              <span class="text-xs font-bold uppercase tracking-wide opacity-70">{{ coupon.type }}</span>
            </div>
            <h3 class="font-bold text-lg">{{ coupon.title }}</h3>
            <p class="text-sm mt-0.5 opacity-80">{{ coupon.description }}</p>
            <div class="flex items-center gap-3 mt-3 text-xs opacity-70">
              <span class="flex items-center gap-1">
                <Clock class="w-3 h-3" /> {{ formatExpiry(coupon.expiresAt) }}
              </span>
              <span v-if="coupon.minOrder > 0">Min. order ${{ coupon.minOrder }}</span>
              <span v-if="coupon.category" class="bg-white/30 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px]">{{ coupon.category }}</span>
            </div>
          </div>
          <Button
            size="sm"
            :variant="couponStore.hasClaimed(coupon.id) ? 'ghost' : 'default'"
            :disabled="couponStore.hasClaimed(coupon.id)"
            @click="handleClaim(coupon.id)"
            class="shrink-0 ml-3"
          >
            <Check v-if="couponStore.hasClaimed(coupon.id)" class="w-4 h-4 mr-1" />
            {{ couponStore.hasClaimed(coupon.id) ? 'Claimed' : 'Claim' }}
          </Button>
        </div>
      </Card>
    </div>

    <!-- My Coupons tab -->
    <div v-else>
      <!-- Available -->
      <div v-if="couponStore.available.length > 0" class="mb-8">
        <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ready to Use</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card v-for="coupon in couponStore.available" :key="coupon.id" class="p-4 flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <component :is="getCouponIcon(coupon.type)" class="w-5 h-5 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="font-semibold text-sm">{{ coupon.title }}</h4>
              <p class="text-xs text-muted-foreground">{{ coupon.code }} · {{ formatExpiry(coupon.expiresAt) }}</p>
            </div>
            <span class="text-xs font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">Active</span>
          </Card>
        </div>
      </div>

      <!-- Used -->
      <div v-if="couponStore.used.length > 0" class="mb-8">
        <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Used</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card v-for="coupon in couponStore.used" :key="coupon.id" class="p-4 flex items-center gap-3 opacity-50">
            <div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Check class="w-5 h-5 text-muted-foreground" />
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="font-semibold text-sm line-through">{{ coupon.title }}</h4>
              <p class="text-xs text-muted-foreground">{{ coupon.code }}</p>
            </div>
          </Card>
        </div>
      </div>

      <!-- Empty -->
      <div v-if="couponStore.myCoupons.length === 0" class="text-center py-16 border border-dashed border-border rounded-xl">
        <Ticket class="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 class="text-lg font-semibold mb-1">No coupons yet</h3>
        <p class="text-muted-foreground text-sm">Switch to Available tab to claim coupons</p>
      </div>
    </div>
  </div>
</template>

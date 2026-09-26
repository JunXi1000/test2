<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  Star,
  ShieldCheck,
  Clock,
  ExternalLink,
  MapPin,
  Truck,
  RotateCcw,
  ThumbsUp,
  Users,
  Package,
} from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import EmptyState from '@/components/ui/state/EmptyState.vue'
import { useToast } from '@/composables/useToast'
import { getMerchantPublicProfile, type MerchantPublicProfile } from '@/api/modules/merchantPublic'
import type { ChatConversation } from '@/composables/useChatConversations'

/**
 * 对端（商家）资料抽屉。**只有买家页用**，所以从 dashboard/Messages.vue 里整块搬出来，
 * 而不是留在页面里跟「消息页」这个主题混在一起。
 *
 * 原先这个抽屉由页面上的三个 ref（`merchantInfoVisible` / `merchantInfoTargetId` /
 * `activeMerchantInfo`）加一个 `openMerchantInfo()` 手工驱动，其中「打开时拉资料」是
 * 调用方记得要调才有的副作用。现在改成跟着 `open` 走 —— 打开即拉，
 * 打开状态下换会话也会重拉，调用方不需要记住任何事。
 */
const props = defineProps<{
  /** 要展示的对端会话；页面传当前选中项，或列表里点头像的那个 */
  conversation: ChatConversation | null
}>()

const open = defineModel<boolean>({ required: true })

const { toast } = useToast()
const profile = ref<MerchantPublicProfile | null>(null)
const loading = ref(false)

async function loadProfile() {
  const conv = props.conversation
  if (!conv) return
  loading.value = true
  profile.value = null
  try {
    profile.value = await getMerchantPublicProfile(conv.participantId)
  } catch {
    toast({ title: 'Error', description: 'Failed to load merchant info', variant: 'destructive' })
  } finally {
    loading.value = false
  }
}

watch([open, () => props.conversation?.id], ([isOpen]) => {
  if (isOpen) loadProfile()
})

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return n.toString()
}
</script>

<template>
  <el-drawer v-model="open" title="Store Profile" size="400px" destroy-on-close>
    <div v-if="loading" class="space-y-5">
      <div class="flex items-center gap-3">
        <Skeleton class="w-14 h-14 rounded-full" />
        <div class="flex-1 space-y-2">
          <Skeleton class="h-5 w-32" />
          <Skeleton class="h-3 w-48" />
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <Skeleton class="h-16 rounded-lg" />
        <Skeleton class="h-16 rounded-lg" />
        <Skeleton class="h-16 rounded-lg" />
      </div>
      <Skeleton class="h-24 rounded-lg" />
      <Skeleton class="h-40 rounded-lg" />
    </div>

    <div v-else-if="profile" class="space-y-5">
      <div class="flex items-center gap-3">
        <div class="relative">
          <div class="w-14 h-14 rounded-full bg-secondary overflow-hidden border-2 border-border">
            <img :src="profile.avatar" class="w-full h-full object-cover" />
          </div>
          <!-- conversation.online 恒为 false（后端无在线字段），这个绿点目前不会出现；保留以维持原渲染 -->
          <span
            v-if="conversation?.online"
            class="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-card rounded-full"
          ></span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <span class="font-bold truncate">{{ profile.storeName }}</span>
            <ShieldCheck v-if="profile.verified" class="w-4 h-4 text-primary flex-shrink-0" />
          </div>
          <div class="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span class="flex items-center gap-1"
              ><Star class="w-3 h-3 text-amber-500 fill-amber-500" />
              {{ profile.stats.rating }}</span
            >
            <span>•</span>
            <span class="flex items-center gap-1"
              ><MapPin class="w-3 h-3" /> {{ profile.location }}</span
            >
          </div>
        </div>
      </div>

      <p class="text-sm text-muted-foreground leading-relaxed">{{ profile.description }}</p>

      <div class="flex gap-2">
        <router-link :to="`/store/${profile.id}`" class="flex-1" @click="open = false">
          <Button variant="outline" class="w-full h-9 text-sm gap-1.5">
            <ExternalLink class="w-3.5 h-3.5" />
            Visit Store
          </Button>
        </router-link>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-lg border border-border p-2.5 text-center">
          <p class="text-lg font-bold text-primary">
            {{ formatNumber(profile.stats.totalProducts) }}
          </p>
          <p class="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
            <Package class="w-3 h-3" /> Products
          </p>
        </div>
        <div class="rounded-lg border border-border p-2.5 text-center">
          <p class="text-lg font-bold text-primary">{{ formatNumber(profile.stats.totalSales) }}</p>
          <p class="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
            <ThumbsUp class="w-3 h-3" /> Sales
          </p>
        </div>
        <div class="rounded-lg border border-border p-2.5 text-center">
          <p class="text-lg font-bold text-primary">{{ formatNumber(profile.stats.followers) }}</p>
          <p class="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
            <Users class="w-3 h-3" /> Followers
          </p>
        </div>
      </div>

      <div class="flex gap-3 text-xs">
        <div class="flex items-center gap-1.5 text-muted-foreground">
          <Clock class="w-3.5 h-3.5 text-emerald-500" />
          <span>Replies {{ profile.responseTime }}</span>
        </div>
        <div class="flex items-center gap-1.5 text-muted-foreground">
          <ThumbsUp class="w-3.5 h-3.5 text-emerald-500" />
          <span>{{ profile.stats.satisfactionRate }}% satisfaction</span>
        </div>
      </div>

      <div v-if="profile.featuredProducts.length > 0">
        <h4 class="text-sm font-semibold mb-3">Popular Products</h4>
        <div class="space-y-2.5">
          <router-link
            v-for="product in profile.featuredProducts"
            :key="product.id"
            :to="`/product/${product.id}`"
            class="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-secondary/30 transition-all group"
            @click="open = false"
          >
            <div
              class="w-12 h-12 rounded-md bg-secondary overflow-hidden flex-shrink-0 border border-border"
            >
              <img
                :src="product.image"
                :alt="product.title"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate group-hover:text-primary transition-colors">
                {{ product.title }}
              </p>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-xs font-bold text-primary">${{ product.price }}</span>
                <span class="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Star class="w-2.5 h-2.5 text-amber-500 fill-amber-500" /> {{ product.rating }}
                </span>
                <span class="text-[10px] text-muted-foreground"
                  >{{ formatNumber(product.sales) }} sold</span
                >
              </div>
            </div>
            <ExternalLink
              class="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            />
          </router-link>
        </div>
      </div>

      <div>
        <h4 class="text-sm font-semibold mb-3">Store Policies</h4>
        <div class="space-y-2.5">
          <div class="flex gap-2.5 items-start rounded-lg border border-border p-3">
            <Truck class="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-xs font-medium mb-0.5">Shipping</p>
              <p class="text-xs text-muted-foreground leading-relaxed">
                {{ profile.policies.shipping }}
              </p>
            </div>
          </div>
          <div class="flex gap-2.5 items-start rounded-lg border border-border p-3">
            <RotateCcw class="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-xs font-medium mb-0.5">Returns</p>
              <p class="text-xs text-muted-foreground leading-relaxed">
                {{ profile.policies.returns }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <p class="text-[10px] text-muted-foreground text-center pt-2 border-t border-border">
        Member since {{ profile.joinedDate }} •
        {{ formatNumber(profile.stats.totalReviews) }} reviews
      </p>
    </div>

    <EmptyState v-else variant="compact" description="No merchant information available." />
  </el-drawer>
</template>

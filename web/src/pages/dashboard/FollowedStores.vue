<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Store, Users, ArrowRight, Bell } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { useFollowedStores } from '@/stores/followedStores'
import { useToast } from '@/composables/useToast'

const followedStores = useFollowedStores()
const { toast } = useToast()

const isLoadingRef = ref(true)

onMounted(() => {
  setTimeout(() => { isLoadingRef.value = false }, 300)
})

const count = computed(() => followedStores.items.length)

function formatFollowers(n?: number): string {
  if (!n) return '0'
  if (n >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return n.toString()
}

function unfollow(id: string, storeName: string) {
  const ok = window.confirm(`Unfollow "${storeName}"? You will stop seeing their updates.`)
  if (!ok) return
  followedStores.unfollow(id)
  toast({ title: 'Unfollowed', description: `You unfollowed ${storeName}.` })
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Followed Stores</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ count }} {{ count === 1 ? 'store' : 'stores' }} you follow
        </p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoadingRef" class="space-y-4">
      <div v-for="i in 3" :key="i" class="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
        <Skeleton class="w-14 h-14 rounded-2xl" />
        <div class="flex-1 space-y-2">
          <Skeleton class="h-5 w-40" />
          <Skeleton class="h-4 w-24" />
        </div>
        <Skeleton class="h-9 w-24" />
      </div>
    </div>

    <!-- Items -->
    <div v-else-if="count > 0" class="space-y-3">
      <div
        v-for="store in followedStores.items"
        :key="store.id"
        class="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all"
      >
        <!-- Avatar -->
        <router-link :to="`/store/${store.id}`" class="flex-shrink-0">
          <div class="w-14 h-14 rounded-2xl overflow-hidden border border-border bg-secondary">
            <img v-if="store.avatar" :src="store.avatar" :alt="store.storeName" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center text-muted-foreground">
              <Store class="w-6 h-6" />
            </div>
          </div>
        </router-link>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <router-link :to="`/store/${store.id}`" class="hover:text-primary transition-colors">
            <h3 class="font-bold truncate">{{ store.storeName }}</h3>
          </router-link>
          <p class="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Users class="w-3.5 h-3.5" />
            {{ formatFollowers(store.followers) }} followers
          </p>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" @click="unfollow(store.id, store.storeName)">
            Unfollow
          </Button>
          <router-link :to="`/store/${store.id}`">
            <Button size="sm">
              Visit Store
              <ArrowRight class="w-4 h-4 ml-1.5" />
            </Button>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else class="py-20 text-center border border-dashed border-border rounded-xl">
      <div class="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
        <Bell class="w-8 h-8" />
      </div>
      <h3 class="text-lg font-medium mb-2">You're not following any stores yet</h3>
      <p class="text-muted-foreground mb-6">Follow stores to get updates on their new products and deals.</p>
      <router-link to="/">
        <Button>
          Browse Stores
          <ArrowRight class="w-4 h-4 ml-2" />
        </Button>
      </router-link>
    </div>
  </div>
</template>

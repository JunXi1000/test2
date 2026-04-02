<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { User, Package, MapPin, Settings, LogOut, LayoutDashboard, MessageSquare } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { preloadByPath } from '@/router/preload'

const router = useRouter()
const route = useRoute()
const isFullBleedRoute = computed(() => route.name === 'UserMessages')
const { toast } = useToast()
const authStore = useAuthStore()

const sidebarItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'My Orders', path: '/dashboard/orders', icon: Package },
  { name: 'Messages', path: '/dashboard/messages', icon: MessageSquare },
  { name: 'Addresses', path: '/dashboard/addresses', icon: MapPin },
  { name: 'Account Settings', path: '/dashboard/settings', icon: Settings },
]

const handleLogout = () => {
  authStore.logout()
  toast({
    title: 'Logged out',
    description: 'You have been successfully logged out.',
    variant: 'default'
  })
  router.push('/')
}

const preloadRoute = (path: string) => {
  preloadByPath(path)
}
</script>

<template>
  <!-- 占满 DefaultLayout 主区高度；滚动只在侧栏卡片 / 右侧内容卡片内 -->
  <div class="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background">
    <div
      class="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 pb-4"
      :class="isFullBleedRoute ? 'pt-3' : 'pt-6'"
    >
      <div
        class="flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch"
        :class="isFullBleedRoute ? 'gap-3 lg:gap-4' : 'gap-6'"
      >
        <aside
          class="flex w-full shrink-0 flex-col overflow-y-auto overscroll-contain lg:w-64 lg:min-h-0 lg:overflow-visible max-h-[40vh] lg:max-h-none"
        >
          <div
            class="rounded-xl border border-border bg-card p-6 shadow-sm lg:flex lg:h-full lg:min-h-0 lg:max-h-full lg:flex-col lg:overflow-y-auto lg:overscroll-contain"
          >
            <div class="mb-8 flex items-center gap-4">
              <div class="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
                <img v-if="authStore.user?.avatar" :src="authStore.user.avatar" class="h-full w-full object-cover" />
                <User v-else class="h-6 w-6" />
              </div>
              <div>
                <h3 class="text-lg font-bold leading-tight">{{ authStore.user?.name || 'Guest' }}</h3>
                <p class="text-xs text-muted-foreground">Gold Member</p>
              </div>
            </div>

            <nav class="space-y-1">
              <router-link
                v-for="item in sidebarItems"
                :key="item.name"
                :to="item.path"
                @mouseenter="preloadRoute(item.path)"
                @focus="preloadRoute(item.path)"
                class="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors"
                :class="route.path === item.path ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'"
              >
                <component :is="item.icon" class="h-4 w-4" />
                {{ item.name }}
              </router-link>

              <div class="my-4 h-px bg-border" />

              <button
                type="button"
                @click="handleLogout"
                class="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut class="h-4 w-4" />
                Sign Out
              </button>
            </nav>
          </div>
        </aside>

        <main class="flex min-h-0 min-w-0 flex-1 flex-col lg:min-h-0">
          <div
            class="flex min-h-0 flex-1 flex-col overscroll-contain rounded-xl border border-border bg-card shadow-sm"
            :class="isFullBleedRoute ? 'p-0 overflow-hidden' : 'p-6 lg:p-8 overflow-y-auto'"
          >
            <router-view />
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

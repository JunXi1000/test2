<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMerchantNotifications } from '@/composables/useMerchantNotifications'
import MerchantNotificationPanel from '@/components/merchant/MerchantNotificationPanel.vue'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Settings,
  LogOut,
  Store,
  Bell,
  Wallet,
  MessageSquare
} from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { preloadByPath } from '@/router/preload'

const router = useRouter()
const route = useRoute()
const { toast } = useToast()
const authStore = useAuthStore()

const isFullBleedRoute = computed(() => route.name === 'MerchantMessages')

const merchantLabel = computed(() => authStore.user?.name?.trim() || 'Merchant')

const navItems = [
  { name: 'Overview', path: '/merchant/dashboard', icon: LayoutDashboard },
  { name: 'Products', path: '/merchant/dashboard/products', icon: Package },
  { name: 'Orders', path: '/merchant/dashboard/orders', icon: ShoppingCart },
  { name: 'Messages', path: '/merchant/dashboard/messages', icon: MessageSquare },
  { name: 'Wallet', path: '/merchant/dashboard/wallet', icon: Wallet },
  { name: 'Settings', path: '/merchant/dashboard/settings', icon: Settings }
]

function isNavActive(path: string) {
  return path === '/merchant/dashboard'
    ? route.path === '/merchant/dashboard'
    : route.path.startsWith(path)
}

const handleLogout = () => {
  authStore.logout()
  toast({ title: 'Logged out', variant: 'default' })
  router.push('/merchant/login')
}

const preloadRoute = (path: string) => {
  preloadByPath(path)
}

const { hasUnread, load: loadNotifications } = useMerchantNotifications()
const notifOpen = ref(false)

onMounted(() => {
  loadNotifications()
})
</script>

<template>
  <div
    class="flex h-dvh max-h-dvh flex-col overflow-hidden bg-zinc-50 transition-colors duration-300 dark:bg-zinc-950"
  >
    <header
      class="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/95"
    >
      <div
        class="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:gap-4 lg:px-6 lg:py-2.5"
      >
        <div class="flex shrink-0 items-center gap-3">
          <router-link
            to="/merchant/dashboard"
            class="flex items-center gap-2 text-lg font-bold tracking-tight text-amber-600 dark:text-amber-500"
          >
            <Store class="h-6 w-6 shrink-0" />
            <span class="whitespace-nowrap">MERCHANT</span>
          </router-link>
        </div>

        <nav
          class="merchant-top-nav flex flex-nowrap items-center gap-1 overflow-x-auto pb-1 lg:min-w-0 lg:flex-1 lg:pb-0"
          aria-label="Merchant navigation"
        >
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            @mouseenter="preloadRoute(item.path)"
            @focus="preloadRoute(item.path)"
            class="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap"
            :class="[
              isNavActive(item.path)
                ? 'bg-amber-500 text-white shadow-sm dark:bg-amber-600'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200'
            ]"
          >
            <component :is="item.icon" class="h-4 w-4 shrink-0" />
            {{ item.name }}
          </router-link>
        </nav>

        <div
          class="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-200 pt-2 dark:border-white/10 lg:border-0 lg:pt-0"
        >
          <el-popover
            v-model:visible="notifOpen"
            placement="bottom-end"
            :width="392"
            trigger="click"
            :show-arrow="true"
            popper-class="merchant-notif-popover"
          >
            <template #reference>
              <button
                type="button"
                class="relative rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/5 dark:hover:text-white"
                :class="
                  notifOpen
                    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30'
                    : ''
                "
                :aria-expanded="notifOpen"
                aria-label="Notifications"
                aria-haspopup="dialog"
              >
                <Bell class="h-5 w-5" />
                <span
                  v-if="hasUnread"
                  class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-zinc-900"
                  aria-hidden="true"
                />
              </button>
            </template>
            <MerchantNotificationPanel />
          </el-popover>
          <div
            class="hidden items-center gap-2 border-l border-zinc-200 pl-3 text-right dark:border-white/10 sm:flex"
          >
            <div>
              <div class="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {{ merchantLabel }}
              </div>
              <div class="text-xs text-zinc-500">Verified Merchant</div>
            </div>
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
            >
              {{ merchantLabel.charAt(0).toUpperCase() }}
            </div>
          </div>
          <button
            type="button"
            @click="handleLogout"
            class="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <LogOut class="h-4 w-4" />
            <span class="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>

    <main
      class="min-h-0 flex-1 overscroll-contain [-webkit-overflow-scrolling:touch]"
      :class="
        isFullBleedRoute
          ? 'flex flex-col overflow-hidden p-0'
          : 'overflow-y-auto p-3 sm:p-4 lg:p-5'
      "
    >
      <div
        class="min-w-0"
        :class="isFullBleedRoute ? 'flex min-h-0 flex-1 flex-col' : ''"
      >
        <router-view />
      </div>
    </main>
  </div>
</template>

<style scoped>
.merchant-top-nav {
  scrollbar-width: thin;
  scrollbar-color: rgb(212 212 216) transparent;
}
.dark .merchant-top-nav {
  scrollbar-color: rgb(63 63 70) transparent;
}
.merchant-top-nav::-webkit-scrollbar {
  height: 6px;
}
.merchant-top-nav::-webkit-scrollbar-thumb {
  background: rgb(212 212 216);
  border-radius: 3px;
}
.dark .merchant-top-nav::-webkit-scrollbar-thumb {
  background: rgb(63 63 70);
}
</style>

<!-- Popover 挂载在 body：收紧默认内边距 -->
<style>
.merchant-notif-popover.el-popover.el-popper {
  padding: 0;
}
</style>

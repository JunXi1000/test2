<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  Settings,
  LogOut,
  Shield,
  Bell,
  Store,
  ShoppingCart,
  Star
} from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { preloadByPath } from '@/router/preload'

const router = useRouter()
const route = useRoute()
const { toast } = useToast()
const authStore = useAuthStore()

const navItems = [
  { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Users', path: '/admin/dashboard/users', icon: Users },
  { name: 'Merchants', path: '/admin/dashboard/merchants', icon: Store },
  { name: 'Products', path: '/admin/dashboard/products', icon: ShoppingBag },
  { name: 'Orders', path: '/admin/dashboard/orders', icon: ShoppingCart },
  { name: 'Reviews', path: '/admin/dashboard/reviews', icon: Star },
  { name: 'Settings', path: '/admin/dashboard/settings', icon: Settings }
]

function isNavActive(path: string) {
  return path === '/admin/dashboard'
    ? route.path === '/admin/dashboard'
    : route.path.startsWith(path)
}

const handleLogout = () => {
  authStore.logout()
  toast({ title: 'Logged out', variant: 'default' })
  router.push('/admin/login')
}

const preloadRoute = (path: string) => {
  preloadByPath(path)
}
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-white flex flex-col">
    <!-- Top bar: brand + horizontal nav + actions -->
    <header
      class="sticky top-0 z-50 border-b border-zinc-800/80 bg-[#1a1a1c]/95 backdrop-blur-md shadow-lg shadow-black/20"
    >
      <div
        class="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:gap-4 lg:px-6 lg:py-2.5"
      >
        <div class="flex items-center justify-between gap-3 lg:shrink-0">
          <router-link
            to="/admin/dashboard"
            class="flex items-center gap-2 text-blue-500 font-bold text-lg tracking-tight"
          >
            <Shield class="w-6 h-6 shrink-0" />
            <span class="whitespace-nowrap">NEXUS ADMIN</span>
          </router-link>
        </div>

        <nav
          class="flex flex-nowrap items-center gap-1 overflow-x-auto pb-1 lg:pb-0 lg:flex-1 lg:min-w-0 admin-nav-scroll"
          aria-label="Admin navigation"
        >
          <router-link
            v-for="item in navItems"
            :key="item.name"
            :to="item.path"
            @mouseenter="preloadRoute(item.path)"
            @focus="preloadRoute(item.path)"
            class="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap"
            :class="[
              isNavActive(item.path)
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:bg-white/5 hover:text-white'
            ]"
          >
            <component :is="item.icon" class="w-4 h-4 shrink-0" />
            {{ item.name }}
          </router-link>
        </nav>

        <div class="flex shrink-0 items-center justify-end gap-2 border-t border-white/5 pt-2 lg:border-0 lg:pt-0">
          <button
            type="button"
            @click="router.push('/admin/dashboard/notifications')"
            @mouseenter="preloadRoute('/admin/dashboard/notifications')"
            @focus="preloadRoute('/admin/dashboard/notifications')"
            class="relative rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Notifications"
          >
            <Bell class="w-5 h-5" />
            <span class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold"
            aria-hidden="true"
          >
            A
          </div>
          <button
            type="button"
            @click="handleLogout"
            class="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            <LogOut class="w-4 h-4" />
            <span class="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>

    <main class="min-h-0 flex-1 overflow-y-auto p-4 lg:p-8">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.admin-nav-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgb(63 63 70) transparent;
}
.admin-nav-scroll::-webkit-scrollbar {
  height: 6px;
}
.admin-nav-scroll::-webkit-scrollbar-thumb {
  background: rgb(63 63 70);
  border-radius: 3px;
}
</style>

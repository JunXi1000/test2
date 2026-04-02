<script setup lang="ts">
import { RouterView, useRoute, useRouter } from 'vue-router'
import { ShoppingCart, User, Menu, Sun, Moon, X, LogIn, Twitter, Instagram, Facebook, MessageSquare, ArrowUp, Search, RefreshCw } from 'lucide-vue-next'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { useDark, useToggle, useWindowScroll, useWindowSize } from '@vueuse/core'
import { ref, watch, computed, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { useToast } from '@/composables/useToast'
const ChatWidget = defineAsyncComponent(() => import('@/components/ui/chat/ChatWidget.vue'))
import { preloadByPath } from '@/router/preload'

const isMobileMenuOpen = ref(false)
const cartStore = useCartStore()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const { toast } = useToast()

const isDark = useDark()
const toggleDark = useToggle(isDark)

const { y } = useWindowScroll()
const { width } = useWindowSize()
const showBackToTop = computed(() => y.value > 300)
const isHomeRoute = computed(() => route.name === 'Home')
/** 用户仪表盘：整页固定视口高度，滚动只在侧栏/主内容模块内 */
const isUserDashboardRoute = computed(() => {
  const p = route.path
  return p === '/dashboard' || p.startsWith('/dashboard/')
})
/** 勿用 fullPath：仪表盘子路由切换时应复用 DashboardLayout，否则整布局被销毁重建会白屏 */
const routerViewComponentKey = computed(() => {
  if (isUserDashboardRoute.value) return 'user-dashboard'
  return route.fullPath
})
const isHeaderCompact = computed(() => y.value > 24)
const isMobileViewport = computed(() => width.value < 768)
const hiddenChatWidgetRoutes = new Set(['UserMessages', 'MerchantMessages'])
const shouldShowChatWidget = computed(() => {
  if (hiddenChatWidgetRoutes.has(String(route.name || ''))) return false
  if (route.name === 'ProductDetail' && isMobileViewport.value) return false
  return true
})

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function refreshPage() {
  window.location.reload()
}

function preloadRoute(path: string) {
  preloadByPath(path)
}

function updateHeaderOffsetVar() {
  const root = document.documentElement
  root.style.setProperty('--app-header-offset', isHeaderCompact.value ? '56px' : '64px')
}

// Close mobile menu when route changes
watch(() => route.path, () => {
  isMobileMenuOpen.value = false
  updateHeaderOffsetVar()
})

onMounted(() => {
  updateHeaderOffsetVar()
})

onBeforeUnmount(() => {
  document.documentElement.style.setProperty('--app-header-offset', '64px')
})

watch([isHeaderCompact, isMobileMenuOpen], () => {
  updateHeaderOffsetVar()
})
</script>

<template>
  <div
    class="bg-background text-foreground font-sans selection:bg-primary selection:text-white transition-colors duration-300 flex flex-col"
    :class="isUserDashboardRoute ? 'h-dvh max-h-dvh min-h-0 overflow-hidden' : 'min-h-screen'"
  >
    <!-- Header -->
    <header
      class="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 transition-all duration-300"
      :class="[isHeaderCompact ? 'shadow-sm' : '']"
    >
      <div
        class="container mx-auto px-4 flex items-center justify-between transition-all duration-300"
        :class="isHeaderCompact ? 'h-14' : 'h-16'"
      >
        <!-- Logo -->
        <div class="flex items-center gap-2">
          <router-link to="/" class="text-xl font-bold tracking-tighter flex items-center gap-2">
            <div
              class="bg-primary rounded-lg flex items-center justify-center text-white font-bold transition-all duration-300"
              :class="isHeaderCompact ? 'w-7 h-7 md:w-8 md:h-8 text-xs md:text-sm' : 'w-8 h-8 md:w-9 md:h-9 text-sm md:text-base'"
            >
              N
            </div>
            <span
              class="font-extrabold tracking-tight transition-all duration-300"
              :class="isHeaderCompact ? 'text-[20px] md:text-[22px]' : 'text-[22px] md:text-2xl'"
            >
              NEXUS
            </span>
          </router-link>
        </div>

        <!-- Desktop Nav -->
        <nav class="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <!-- Navigation links removed as per user request -->
        </nav>

        <!-- Actions -->
        <div class="flex items-center transition-all duration-300" :class="isHeaderCompact ? 'gap-3' : 'gap-4'">
          <button @click="toggleDark()" class="h-9 w-9 inline-flex items-center justify-center hover:bg-secondary rounded-lg transition-colors" aria-label="Toggle theme">
            <Sun v-if="isDark" class="h-5 w-5" />
            <Moon v-else class="h-5 w-5" />
          </button>
          
          <router-link to="/cart" @mouseenter="preloadRoute('/cart')" @focus="preloadRoute('/cart')">
            <button class="relative h-9 w-9 inline-flex items-center justify-center hover:bg-secondary rounded-lg transition-colors" title="Cart" aria-label="Cart">
              <ShoppingCart class="h-5 w-5" />
              <span v-if="cartStore.totalItems > 0" class="absolute top-0 right-0 h-4 w-4 text-[10px] flex items-center justify-center rounded-full bg-primary text-white font-bold border border-background">
                {{ cartStore.totalItems }}
              </span>
            </button>
          </router-link>

          <!-- Messages (Logged In) -->
          <router-link v-if="authStore.isAuthenticated" to="/dashboard/messages" @mouseenter="preloadRoute('/dashboard/messages')" @focus="preloadRoute('/dashboard/messages')">
            <button class="relative h-9 w-9 inline-flex items-center justify-center hover:bg-secondary rounded-lg transition-colors" title="Messages" aria-label="Messages">
              <MessageSquare class="h-5 w-5" />
              <span class="absolute -top-1 -right-1 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold leading-none">
                1
              </span>
            </button>
          </router-link>
          
          <!-- User Menu (Logged In) -->
          <router-link v-if="authStore.isAuthenticated" to="/dashboard" @mouseenter="preloadRoute('/dashboard')" @focus="preloadRoute('/dashboard')">
            <button class="h-9 px-2 hover:bg-secondary rounded-lg transition-colors flex items-center gap-2" title="Dashboard" aria-label="Dashboard">
              <div v-if="authStore.user?.avatar" class="w-6 h-6 rounded-full overflow-hidden border border-border">
                <img :src="authStore.user.avatar" alt="Avatar" class="w-full h-full object-cover" />
              </div>
              <User v-else class="h-5 w-5" />
            </button>
          </router-link>

          <!-- Guest Menu (Not Logged In) -->
          <div v-else class="hidden md:flex items-center gap-1">
            <router-link to="/login" @mouseenter="preloadRoute('/login')" @focus="preloadRoute('/login')">
              <button class="h-9 px-3 text-sm font-medium text-foreground/80 hover:text-primary hover:bg-secondary rounded-lg transition-colors">Log in</button>
            </router-link>
            <router-link to="/signup" @mouseenter="preloadRoute('/signup')" @focus="preloadRoute('/signup')">
              <button class="h-9 px-4 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm">Sign up</button>
            </router-link>
          </div>

          <button @click="isMobileMenuOpen = !isMobileMenuOpen" class="md:hidden p-2 hover:bg-secondary rounded-lg transition-colors relative z-50">
            <X v-if="isMobileMenuOpen" class="h-5 w-5" />
            <Menu v-else class="h-5 w-5" />
          </button>
        </div>
      </div>

      <!-- Mobile Menu Overlay -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div v-if="isMobileMenuOpen" class="absolute top-16 left-0 w-full bg-background border-b border-border shadow-lg md:hidden z-40 p-4">
          <nav class="flex flex-col gap-4 text-base font-medium">
             <!-- Mobile Search -->
            <div class="relative mb-2">
               <Search class="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
               <input 
                type="search" 
                placeholder="Search products..." 
                class="w-full h-10 rounded-lg bg-secondary pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <router-link to="/" class="px-4 py-2 rounded-lg hover:bg-secondary transition-colors" active-class="bg-secondary" @mouseenter="preloadRoute('/')" @focus="preloadRoute('/')">
              Home
            </router-link>
            <router-link to="/products" class="px-4 py-2 rounded-lg hover:bg-secondary transition-colors" active-class="bg-secondary">
              Products
            </router-link>
            <router-link to="/about" class="px-4 py-2 rounded-lg hover:bg-secondary transition-colors" active-class="bg-secondary">
              About
            </router-link>
            
            <div class="h-px bg-border my-2"></div>
            
            <router-link to="/cart" class="flex items-center justify-between px-4 py-2 rounded-lg hover:bg-secondary transition-colors" @mouseenter="preloadRoute('/cart')" @focus="preloadRoute('/cart')">
              <span>Cart</span>
              <span v-if="cartStore.totalItems > 0" class="bg-primary text-white text-xs px-2 py-0.5 rounded-full">{{ cartStore.totalItems }}</span>
            </router-link>
            
            <template v-if="authStore.isAuthenticated">
              <router-link to="/dashboard" class="px-4 py-2 rounded-lg hover:bg-secondary transition-colors" @mouseenter="preloadRoute('/dashboard')" @focus="preloadRoute('/dashboard')">My Account</router-link>
            </template>
            <template v-else>
              <router-link to="/login" class="px-4 py-2 rounded-lg hover:bg-secondary transition-colors" @mouseenter="preloadRoute('/login')" @focus="preloadRoute('/login')">Log in</router-link>
              <router-link to="/signup" class="px-4 py-2 rounded-lg hover:bg-secondary transition-colors text-primary font-medium" @mouseenter="preloadRoute('/signup')" @focus="preloadRoute('/signup')">Sign up</router-link>
            </template>
          </nav>
        </div>
      </Transition>
    </header>

    <!-- Main Content -->
    <main
      class="flex min-h-0 min-w-0 flex-1 flex-col"
      :class="isUserDashboardRoute ? 'overflow-hidden' : ''"
    >
      <!-- 不用 display:contents，避免与 Transition、非 flex 子页面布局冲突导致白屏 -->
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <RouterView v-slot="{ Component }">
          <Transition
            appear
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0 translate-y-2"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-2"
          >
            <component
              :is="Component"
              :key="routerViewComponentKey"
              :class="isUserDashboardRoute ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'min-w-0 flex-1'"
            />
          </Transition>
        </RouterView>
      </div>
    </main>

    <!-- Footer：仅首页展示 -->
    <footer v-if="isHomeRoute" class="border-t border-border/40 bg-secondary/20 mt-auto">
      <div class="container mx-auto px-4 py-12">
        <div class="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div class="md:col-span-2">
            <div class="flex items-center gap-2 mb-4">
               <div class="w-6 h-6 bg-primary rounded flex items-center justify-center text-white text-xs font-bold">N</div>
               <span class="font-bold text-lg">NEXUS STORE</span>
            </div>
            <p class="text-sm text-muted-foreground mb-6 max-w-sm">
              Redefining digital commerce with a curated selection of premium lifestyle products. 
              Designed for the modern minimalist.
            </p>
            <div class="flex gap-4">
              <button class="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center hover:border-primary hover:text-primary transition-colors">
                <Twitter class="w-4 h-4" />
              </button>
              <button class="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center hover:border-primary hover:text-primary transition-colors">
                <Instagram class="w-4 h-4" />
              </button>
              <button class="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center hover:border-primary hover:text-primary transition-colors">
                <Facebook class="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div>
            <h4 class="font-bold mb-4">Shop</h4>
            <ul class="space-y-2 text-sm text-muted-foreground">
              <li class="hover:text-primary transition-colors cursor-pointer">All Products</li>
              <li class="hover:text-primary transition-colors cursor-pointer">New Arrivals</li>
              <li class="hover:text-primary transition-colors cursor-pointer">Best Sellers</li>
            </ul>
          </div>
          
          <div>
            <h4 class="font-bold mb-4">Company</h4>
            <ul class="space-y-2 text-sm text-muted-foreground">
              <li class="hover:text-primary transition-colors cursor-pointer">About Us</li>
              <li class="hover:text-primary transition-colors cursor-pointer">Careers</li>
              <li class="hover:text-primary transition-colors cursor-pointer">Press</li>
            </ul>
          </div>

          <div>
            <h4 class="font-bold mb-4">Partners</h4>
            <ul class="space-y-2 text-sm text-muted-foreground">
              <li>
                <router-link
                  to="/merchant/login"
                  class="transition-colors hover:text-primary"
                  @mouseenter="preloadRoute('/merchant/login')"
                  @focus="preloadRoute('/merchant/login')"
                >
                  Merchant Login
                </router-link>
              </li>
              <li>
                <router-link
                  to="/admin/login"
                  class="transition-colors hover:text-primary"
                  @mouseenter="preloadRoute('/admin/login')"
                  @focus="preloadRoute('/admin/login')"
                >
                  Admin Portal
                </router-link>
              </li>
              <li class="hover:text-primary transition-colors cursor-pointer">Affiliate Program</li>
            </ul>
          </div>
        </div>
        
        <div class="border-t border-border/40 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <p>&copy; 2026 Nexus Store Inc. All rights reserved.</p>
          <div class="flex gap-6">
            <span class="hover:text-foreground cursor-pointer">Privacy Policy</span>
            <span class="hover:text-foreground cursor-pointer">Terms of Service</span>
            <span class="hover:text-foreground cursor-pointer">Cookie Policy</span>
          </div>
        </div>
      </div>
    </footer>

    <!-- Floating actions: refresh（仅首页）+ back to top -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div
        v-if="showBackToTop"
        class="fixed bottom-24 right-6 z-40 flex flex-col gap-2 items-center"
        role="group"
        aria-label="Page actions"
      >
        <button
          v-if="isHomeRoute"
          type="button"
          @click="refreshPage"
          class="h-10 w-10 rounded-full bg-secondary text-foreground border border-border shadow-lg hover:bg-secondary/80 hover:-translate-y-1 transition-all duration-300 flex items-center justify-center"
          title="Refresh"
          aria-label="Refresh page"
        >
          <RefreshCw class="w-5 h-5" />
        </button>
        <button
          type="button"
          @click="scrollToTop"
          class="h-10 w-10 rounded-full bg-secondary text-foreground border border-border shadow-lg hover:bg-secondary/80 hover:-translate-y-1 transition-all duration-300 flex items-center justify-center"
          title="Back to Top"
          aria-label="Back to top"
        >
          <ArrowUp class="w-5 h-5" />
        </button>
      </div>
    </Transition>

    <!-- Chat Widget -->
    <ChatWidget v-if="shouldShowChatWidget" />
  </div>
</template>

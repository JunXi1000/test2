import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
  type LocationQueryRaw,
} from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { loginRouteNameFromAppPath } from '@/utils/loginRoutes'
import { preloadByRouteNames, getDefaultPreloadTargets } from './preload'

function scheduleIdlePreload(callback: () => void) {
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
  }
  if (typeof win.requestIdleCallback === 'function') {
    win.requestIdleCallback(callback, { timeout: 2000 })
  } else {
    window.setTimeout(callback, 300)
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/dashboard',
    component: () => import('@/pages/admin/AdminLayout.vue'),
    meta: { requiresAuth: true, role: 'admin' },
    children: [
      {
        path: '',
        name: 'AdminHome',
        component: () => import('@/pages/admin/AdminHome.vue'),
      },
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('@/pages/admin/Users.vue'),
      },
      {
        path: 'merchants',
        name: 'AdminMerchants',
        component: () => import('@/pages/admin/Merchants.vue'),
      },
      {
        path: 'products',
        name: 'AdminProducts',
        component: () => import('@/pages/admin/Products.vue'),
      },
      {
        path: 'orders',
        name: 'AdminOrders',
        component: () => import('@/pages/admin/Orders.vue'),
      },
      {
        path: 'reviews',
        name: 'AdminReviews',
        component: () => import('@/pages/admin/Reviews.vue'),
      },
      {
        path: 'settings',
        name: 'AdminSettings',
        component: () => import('@/pages/admin/Settings.vue'),
      },
      {
        path: 'notifications',
        name: 'AdminNotifications',
        component: () => import('@/pages/admin/Notifications.vue'),
      },
    ],
  },
  {
    path: '/merchant/dashboard',
    component: () => import('@/pages/merchant/MerchantLayout.vue'),
    meta: { requiresAuth: true, role: 'merchant' },
    children: [
      {
        path: '',
        name: 'MerchantHome',
        meta: { title: 'Store Overview' },
        component: () => import('@/pages/merchant/MerchantHome.vue'),
      },
      {
        path: 'products',
        name: 'MerchantProducts',
        meta: { title: 'Product Management' },
        component: () => import('@/pages/merchant/Products.vue'),
      },
      {
        path: 'orders',
        name: 'MerchantOrders',
        meta: { title: 'Order Management' },
        component: () => import('@/pages/merchant/Orders.vue'),
      },
      {
        path: 'wallet',
        name: 'MerchantWallet',
        meta: { title: 'Wallet & Payouts' },
        component: () => import('@/pages/merchant/Wallet.vue'),
      },
      {
        path: 'settings',
        name: 'MerchantSettings',
        meta: { title: 'Store Settings' },
        component: () => import('@/pages/merchant/Settings.vue'),
      },
      {
        path: 'messages',
        name: 'MerchantMessages',
        meta: { title: 'Messages' },
        component: () => import('@/pages/merchant/Messages.vue'),
      },
    ],
  },
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: () => import('@/pages/Login.vue'),
    meta: { guestOnly: true, loginPortal: 'admin' },
  },
  {
    path: '/merchant/login',
    name: 'MerchantLogin',
    component: () => import('@/pages/Login.vue'),
    meta: { guestOnly: true, loginPortal: 'merchant' },
  },
  {
    path: '/admin',
    redirect: '/admin/login',
  },
  {
    path: '/merchant',
    redirect: '/merchant/login',
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/Login.vue'),
    meta: { guestOnly: true, loginPortal: 'user' },
  },
  {
    path: '/',
    component: DefaultLayout,
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/pages/Home.vue'),
      },
      {
        path: 'product/:id',
        name: 'ProductDetail',
        component: () => import('@/pages/ProductDetail.vue'),
      },
      {
        path: 'search',
        name: 'SearchResults',
        component: () => import('@/pages/SearchResults.vue'),
      },
      {
        path: 'compare',
        name: 'Compare',
        component: () => import('@/pages/Compare.vue'),
      },
      {
        path: 'store/:id',
        name: 'StorePage',
        component: () => import('@/pages/StorePage.vue'),
      },
      {
        path: 'cart',
        name: 'Cart',
        component: () => import('@/pages/Cart.vue'),
      },
      {
        /**
         * 结算页必须登录（2026-10-01，TASK-002 / C0）。
         *
         * 这里加 `requiresAuth` 不是"顺手收紧"，而是修一个真实的错误流程：
         * `/checkout/summary` 与 `/checkout/promo` 已按 C0 移出白名单 ⇒ 匿名调用返回 401，
         * 而 `api/http.ts` 的 401 拦截器把 401 当作**会话过期**处理：清 token、跳登录。
         * 于是匿名访客只要打开结算页，就会被当成"登录过期"踢出去 —— 而路由守卫本来
         * 能在**发请求之前**干净地跳 `?redirect=/checkout`。守卫做这件事比拦截器做更准确。
         *
         * 角色限 `user`：结算/支付是买家动作，商家/管理员账号没有买家购物车
         * （与 `dashboard` 一致），避免他们误入后触发一堆 403/401。
         *
         * `/cart` **保持公开**：购物车可以匿名浏览（本地小计 + 登录后可见总额，
         * 见 `composables/useCartSummary.ts`），它不发任何非白名单请求。
         */
        path: 'checkout',
        name: 'Checkout',
        component: () => import('@/pages/Checkout.vue'),
        meta: { requiresAuth: true, role: 'user' },
      },
      {
        path: 'signup',
        name: 'Signup',
        component: () => import('@/pages/Signup.vue'),
        meta: { guestOnly: true },
      },
      {
        path: 'dashboard',
        component: () => import('@/pages/dashboard/DashboardLayout.vue'),
        meta: { requiresAuth: true, role: 'user' },
        children: [
          {
            path: '',
            name: 'DashboardHome',
            component: () => import('@/pages/dashboard/DashboardHome.vue'),
          },
          {
            path: 'orders',
            name: 'DashboardOrders',
            component: () => import('@/pages/dashboard/Orders.vue'),
          },
          {
            path: 'wishlist',
            name: 'DashboardWishlist',
            component: () => import('@/pages/dashboard/Wishlist.vue'),
          },
          {
            path: 'addresses',
            name: 'Addresses',
            component: () => import('@/pages/dashboard/Addresses.vue'),
          },
          {
            path: 'returns',
            name: 'DashboardReturns',
            component: () => import('@/pages/dashboard/Returns.vue'),
          },
          {
            path: 'coupons',
            name: 'DashboardCoupons',
            component: () => import('@/pages/dashboard/Coupons.vue'),
          },
          {
            path: 'loyalty',
            name: 'DashboardLoyalty',
            component: () => import('@/pages/dashboard/Loyalty.vue'),
          },
          {
            path: 'settings',
            name: 'AccountSettings',
            component: () => import('@/pages/dashboard/Settings.vue'),
          },
          {
            path: 'messages',
            name: 'UserMessages',
            component: () => import('@/pages/dashboard/Messages.vue'),
          },
          {
            path: 'followed-stores',
            name: 'FollowedStores',
            component: () => import('@/pages/dashboard/FollowedStores.vue'),
          },
        ],
      },
      {
        path: 'forgot-password',
        name: 'ForgotPassword',
        component: () => import('@/pages/ForgotPassword.vue'),
      },
      {
        path: 'reset-password',
        name: 'ResetPassword',
        component: () => import('@/pages/ResetPassword.vue'),
      },
      {
        path: 'thank-you',
        name: 'ThankYou',
        component: () => import('@/pages/ThankYou.vue'),
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('@/pages/NotFound.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach((to, _from, next) => {
  const qRole = to.query.role
  if (to.name === 'Login' && (qRole === 'admin' || qRole === 'merchant')) {
    const rest = { ...to.query } as LocationQueryRaw
    delete rest.role
    const path = qRole === 'admin' ? '/admin/login' : '/merchant/login'
    return next({ path, query: rest, replace: true })
  }

  const auth = useAuthStore()
  if (!auth.authReady) {
    auth.initAuth()
  }
  const isAuthed = auth.isAuthenticated
  const role = auth.user?.role

  const requiresAuth = to.matched.some((r) => r.meta?.requiresAuth)
  const guestOnly = to.matched.some((r) => r.meta?.guestOnly)
  const targetRole = to.matched.find((r) => r.meta?.role)?.meta?.role as
    'user' | 'admin' | 'merchant' | undefined

  const allowedRoles = new Set(['user', 'admin', 'merchant'])
  if (isAuthed && (!role || !allowedRoles.has(role))) {
    try {
      sessionStorage.setItem('auth_cleared', '1')
    } catch {}
    auth.logout()
    return next({
      name: loginRouteNameFromAppPath(to.path),
      query: { redirect: to.fullPath },
    })
  }

  // Redirect authed users away from guest-only routes
  if (guestOnly && isAuthed) {
    if (role === 'admin') return next({ name: 'AdminHome' })
    if (role === 'merchant') return next({ name: 'MerchantHome' })
    return next({ name: 'Home' })
  }

  // Protect auth-required routes
  if (requiresAuth && !isAuthed) {
    return next({
      name: loginRouteNameFromAppPath(to.path),
      query: { redirect: to.fullPath },
    })
  }

  // Role-based routes
  if (targetRole && isAuthed && targetRole !== role) {
    if (role === 'admin') return next({ name: 'AdminHome' })
    if (role === 'merchant') return next({ name: 'MerchantHome' })
    return next({ name: 'Home' })
  }

  return next()
})

let hasScheduledInitialPreload = false
router.afterEach(() => {
  if (hasScheduledInitialPreload) return
  hasScheduledInitialPreload = true
  const auth = useAuthStore()
  const targets = getDefaultPreloadTargets(auth.user?.role, auth.isAuthenticated)
  scheduleIdlePreload(() => preloadByRouteNames(targets))
})

export default router

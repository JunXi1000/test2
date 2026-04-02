import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
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
        component: () => import('@/pages/admin/AdminHome.vue')
      },
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('@/pages/admin/Users.vue')
      },
      {
        path: 'merchants',
        name: 'AdminMerchants',
        component: () => import('@/pages/admin/Merchants.vue')
      },
      {
        path: 'products',
        name: 'AdminProducts',
        component: () => import('@/pages/admin/Products.vue')
      },
      {
        path: 'orders',
        name: 'AdminOrders',
        component: () => import('@/pages/admin/Orders.vue')
      },
      {
        path: 'reviews',
        name: 'AdminReviews',
        component: () => import('@/pages/admin/Reviews.vue')
      },
      {
        path: 'settings',
        name: 'AdminSettings',
        component: () => import('@/pages/admin/Settings.vue')
      },
      {
        path: 'notifications',
        name: 'AdminNotifications',
        component: () => import('@/pages/admin/Notifications.vue')
      }
    ]
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
        component: () => import('@/pages/merchant/MerchantHome.vue')
      },
      {
        path: 'products',
        name: 'MerchantProducts',
        meta: { title: 'Product Management' },
        component: () => import('@/pages/merchant/Products.vue')
      },
      {
        path: 'orders',
        name: 'MerchantOrders',
        meta: { title: 'Order Management' },
        component: () => import('@/pages/merchant/Orders.vue')
      },
      {
        path: 'wallet',
        name: 'MerchantWallet',
        meta: { title: 'Wallet & Payouts' },
        component: () => import('@/pages/merchant/Wallet.vue')
      },
      {
        path: 'settings',
        name: 'MerchantSettings',
        meta: { title: 'Store Settings' },
        component: () => import('@/pages/merchant/Settings.vue')
      },
      {
        path: 'messages',
        name: 'MerchantMessages',
        meta: { title: 'Messages' },
        component: () => import('@/pages/merchant/Messages.vue')
      }
    ]
  },
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: () => import('@/pages/Login.vue'),
    meta: { guestOnly: true, loginPortal: 'admin' }
  },
  {
    path: '/merchant/login',
    name: 'MerchantLogin',
    component: () => import('@/pages/Login.vue'),
    meta: { guestOnly: true, loginPortal: 'merchant' }
  },
  {
    path: '/admin',
    redirect: '/admin/login'
  },
  {
    path: '/merchant',
    redirect: '/merchant/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/Login.vue'),
    meta: { guestOnly: true, loginPortal: 'user' }
  },
  {
    path: '/',
    component: DefaultLayout,
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/pages/Home.vue')
      },
      {
        path: 'product/:id',
        name: 'ProductDetail',
        component: () => import('@/pages/ProductDetail.vue')
      },
      {
        path: 'store/:id',
        name: 'StorePage',
        component: () => import('@/pages/StorePage.vue')
      },
      {
        path: 'cart',
        name: 'Cart',
        component: () => import('@/pages/Cart.vue')
      },
      {
        path: 'checkout',
        name: 'Checkout',
        component: () => import('@/pages/Checkout.vue')
      },
      {
        path: 'signup',
        name: 'Signup',
        component: () => import('@/pages/Signup.vue'),
        meta: { guestOnly: true }
      },
      {
        path: 'dashboard',
        component: () => import('@/pages/dashboard/DashboardLayout.vue'),
        meta: { requiresAuth: true, role: 'user' },
        children: [
          {
            path: '',
            name: 'DashboardHome',
            component: () => import('@/pages/dashboard/DashboardHome.vue')
          },
          {
            path: 'orders',
            name: 'DashboardOrders',
            component: () => import('@/pages/dashboard/Orders.vue')
          },
          {
            path: 'wishlist',
            name: 'DashboardWishlist',
            component: () => import('@/pages/dashboard/Wishlist.vue')
          },
          {
            path: 'addresses',
            name: 'Addresses',
            component: () => import('@/pages/dashboard/Addresses.vue')
          },
          {
            path: 'settings',
            name: 'AccountSettings',
            component: () => import('@/pages/dashboard/Settings.vue')
          },
          {
            path: 'messages',
            name: 'UserMessages',
            component: () => import('@/pages/dashboard/Messages.vue')
          }
        ]
      },
      {
        path: 'forgot-password',
        name: 'ForgotPassword',
        component: () => import('@/pages/ForgotPassword.vue')
      },
      {
        path: 'reset-password',
        name: 'ResetPassword',
        component: () => import('@/pages/ResetPassword.vue')
      },
      {
        path: 'thank-you',
        name: 'ThankYou',
        component: () => import('@/pages/ThankYou.vue')
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('@/pages/NotFound.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

router.beforeEach((to, _from, next) => {
  const qRole = to.query.role
  if (to.name === 'Login' && (qRole === 'admin' || qRole === 'merchant')) {
    const rest = { ...to.query } as Record<string, unknown>
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

  const requiresAuth = to.matched.some(r => r.meta?.requiresAuth)
  const guestOnly = to.matched.some(r => r.meta?.guestOnly)
  const targetRole = to.matched.find(r => r.meta?.role)?.meta?.role as 'user' | 'admin' | 'merchant' | undefined

  const allowedRoles = new Set(['user', 'admin', 'merchant'])
  if (isAuthed && (!role || !allowedRoles.has(role))) {
    try {
      sessionStorage.setItem('auth_cleared', '1')
    } catch {}
    auth.logout()
    return next({
      name: loginRouteNameFromAppPath(to.path),
      query: { redirect: to.fullPath }
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
      query: { redirect: to.fullPath }
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

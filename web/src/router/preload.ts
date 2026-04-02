type PreloadLoader = () => Promise<unknown>
type UserRole = 'user' | 'admin' | 'merchant'
type PreloadTrigger = 'idle' | 'interaction'

const preloadedKeys = new Set<string>()

const PRELOAD_BUDGET_KEY = 'route_preload_budget_v1'
const MAX_PRELOAD_BUDGET = 14
const IDLE_PRELOAD_BUDGET = 8
let sessionPreloadCount = 0
let idlePreloadCount = 0

function restoreSessionBudget() {
  try {
    const raw = sessionStorage.getItem(PRELOAD_BUDGET_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as { sessionCount?: number; idleCount?: number }
    sessionPreloadCount = Number(parsed.sessionCount ?? 0)
    idlePreloadCount = Number(parsed.idleCount ?? 0)
  } catch {
    sessionPreloadCount = 0
    idlePreloadCount = 0
  }
}

function persistSessionBudget() {
  try {
    sessionStorage.setItem(
      PRELOAD_BUDGET_KEY,
      JSON.stringify({ sessionCount: sessionPreloadCount, idleCount: idlePreloadCount })
    )
  } catch {
    // Ignore storage failures
  }
}

restoreSessionBudget()

const namePreloaders: Record<string, PreloadLoader> = {
  Home: () => import('@/pages/Home.vue'),
  ProductDetail: () => import('@/pages/ProductDetail.vue'),
  Cart: () => import('@/pages/Cart.vue'),
  Checkout: () => import('@/pages/Checkout.vue'),
  Login: () => import('@/pages/Login.vue'),
  AdminLogin: () => import('@/pages/Login.vue'),
  MerchantLogin: () => import('@/pages/Login.vue'),
  Signup: () => import('@/pages/Signup.vue'),
  DashboardHome: () => import('@/pages/dashboard/DashboardHome.vue'),
  DashboardOrders: () => import('@/pages/dashboard/Orders.vue'),
  Addresses: () => import('@/pages/dashboard/Addresses.vue'),
  UserMessages: () => import('@/pages/dashboard/Messages.vue'),
  AdminHome: () => import('@/pages/admin/AdminHome.vue'),
  AdminOrders: () => import('@/pages/admin/Orders.vue'),
  AdminReviews: () => import('@/pages/admin/Reviews.vue'),
  AdminNotifications: () => import('@/pages/admin/Notifications.vue'),
  MerchantHome: () => import('@/pages/merchant/MerchantHome.vue'),
  MerchantOrders: () => import('@/pages/merchant/Orders.vue'),
  MerchantMessages: () => import('@/pages/merchant/Messages.vue'),
}

const pathPreloaders: Record<string, PreloadLoader> = {
  '/': namePreloaders.Home,
  '/cart': namePreloaders.Cart,
  '/checkout': namePreloaders.Checkout,
  '/login': namePreloaders.Login,
  '/admin/login': namePreloaders.AdminLogin,
  '/merchant/login': namePreloaders.MerchantLogin,
  '/signup': namePreloaders.Signup,
  '/dashboard': namePreloaders.DashboardHome,
  '/dashboard/orders': namePreloaders.DashboardOrders,
  '/dashboard/addresses': namePreloaders.Addresses,
  '/dashboard/messages': namePreloaders.UserMessages,
  '/admin/dashboard': namePreloaders.AdminHome,
  '/admin/dashboard/orders': namePreloaders.AdminOrders,
  '/admin/dashboard/reviews': namePreloaders.AdminReviews,
  '/admin/dashboard/notifications': namePreloaders.AdminNotifications,
  '/merchant/dashboard': namePreloaders.MerchantHome,
  '/merchant/dashboard/orders': namePreloaders.MerchantOrders,
  '/merchant/dashboard/messages': namePreloaders.MerchantMessages,
}

function getNetworkHints() {
  type NetworkInfo = {
    saveData?: boolean
    effectiveType?: string
  }
  const nav = navigator as Navigator & { connection?: NetworkInfo }
  const connection = nav.connection
  return {
    saveData: Boolean(connection?.saveData),
    effectiveType: connection?.effectiveType ?? '',
    cpuCores: navigator.hardwareConcurrency ?? 4,
  }
}

function canPreload(trigger: PreloadTrigger) {
  const { saveData, effectiveType, cpuCores } = getNetworkHints()
  const verySlow = effectiveType.includes('2g')
  const lowEndDevice = cpuCores <= 2

  // Respect user data-saver and very slow networks
  if (saveData || verySlow) return false
  // Background preloading should be conservative on low-end devices
  if (trigger === 'idle' && lowEndDevice) return false
  // Session-level cap to avoid excessive prefetching
  if (sessionPreloadCount >= MAX_PRELOAD_BUDGET) return false
  // Idle preloading has a stricter cap; interaction preloading can still proceed
  if (trigger === 'idle' && idlePreloadCount >= IDLE_PRELOAD_BUDGET) return false
  return true
}

function runPreload(key: string, loader: PreloadLoader | undefined, trigger: PreloadTrigger) {
  if (!canPreload(trigger)) return
  if (!loader || preloadedKeys.has(key)) return
  preloadedKeys.add(key)
  loader().catch(() => {
    preloadedKeys.delete(key)
  }).finally(() => {
    sessionPreloadCount += 1
    if (trigger === 'idle') idlePreloadCount += 1
    persistSessionBudget()
  })
}

export function preloadByRouteNames(routeNames: string[]) {
  for (const name of routeNames) {
    runPreload(`name:${name}`, namePreloaders[name], 'idle')
  }
}

export function preloadByPath(path: string) {
  runPreload(`path:${path}`, pathPreloaders[path], 'interaction')
}

export function getDefaultPreloadTargets(role?: UserRole, isAuthed?: boolean) {
  const { effectiveType, cpuCores } = getNetworkHints()
  const constrained = effectiveType === '3g' || cpuCores <= 2

  // On constrained networks/devices, preload fewer but highest-probability routes.
  const common = constrained
    ? ['Home', 'Cart', 'Checkout']
    : ['Home', 'ProductDetail', 'Cart', 'Checkout']

  if (!isAuthed) {
    return constrained
      ? [...common, 'Login', 'AdminLogin', 'MerchantLogin']
      : [...common, 'Login', 'AdminLogin', 'MerchantLogin', 'Signup']
  }
  if (role === 'admin') return constrained ? [...common, 'AdminHome'] : [...common, 'AdminHome', 'AdminOrders']
  if (role === 'merchant') return constrained ? [...common, 'MerchantHome'] : [...common, 'MerchantHome', 'MerchantOrders']
  return constrained ? [...common, 'DashboardHome'] : [...common, 'DashboardHome', 'DashboardOrders', 'Addresses']
}

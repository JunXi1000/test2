import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import './assets/css/tailwind.css'
// Programmatic APIs (ElMessageBox / ElMessage) are not tied to SFC auto-import — include their styles or overlays render unpositioned (top-left).
import 'element-plus/es/components/message-box/style/css'
import 'element-plus/es/components/message/style/css'
// Element Plus 的暗色变量。storefront/dashboard 走 DefaultLayout 的 useDark()，会给 <html> 挂 .dark，
// 但 EP 自己的 --el-bg-color/--el-text-color-primary 不跟 Tailwind 令牌联动：不引这个文件，
// 暗色页面上每个 el-* 组件仍是白底（#fff）——只有这一个文件能修，且它自身就是 .dark 作用域。
import 'element-plus/theme-chalk/dark/css-vars.css'
import { useAuthStore } from '@/stores/auth'
import { AUTH_USER_KEY, AUTH_TOKEN_KEY } from '@/auth/session'
import { loginPathFromAppPath } from '@/utils/loginRoutes'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)

// 初始化时同步 <html lang>（界面语言固定为 English，中英切换已移除）
document.documentElement.setAttribute('lang', 'en')
document.documentElement.setAttribute('data-locale', 'en')

function getHomeByRole(role?: 'user' | 'admin' | 'merchant') {
  if (role === 'admin') return '/admin/dashboard'
  if (role === 'merchant') return '/merchant/dashboard'
  return '/'
}

// Cross-tab auth sync: login/logout in one tab propagates to others.
window.addEventListener('storage', (event) => {
  if (event.key !== AUTH_USER_KEY && event.key !== AUTH_TOKEN_KEY) return

  const auth = useAuthStore(pinia)
  if (event.newValue === null) {
    auth.logout()
    const isLoginRoute = window.location.pathname.includes('/login')
    if (!isLoginRoute) {
      const redirect = encodeURIComponent(window.location.pathname + window.location.search)
      const loginPath = loginPathFromAppPath(window.location.pathname)
      router.push(`${loginPath}?redirect=${redirect}`)
    }
    return
  }

  // When other tabs update auth data, refresh local in-memory state.
  auth.initAuth()

  // If this tab is on guest-only pages, auto-enter the app after cross-tab login.
  if (auth.isAuthenticated) {
    const currentPath = router.currentRoute.value.path
    const isGuestPage =
      currentPath === '/login' ||
      currentPath === '/admin/login' ||
      currentPath === '/merchant/login' ||
      currentPath === '/signup'
    if (isGuestPage) {
      router.push(getHomeByRole(auth.user?.role))
    }
  }
})

// PWA: Register service worker
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silently fail — non-critical enhancement
    })
  })
}

app.mount('#app')

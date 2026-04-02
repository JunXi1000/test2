import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/css/tailwind.css'
// Programmatic APIs (ElMessageBox / ElMessage) are not tied to SFC auto-import — include their styles or overlays render unpositioned (top-left).
import 'element-plus/es/components/message-box/style/css'
import 'element-plus/es/components/message/style/css'
import { useAuthStore } from '@/stores/auth'
import { AUTH_USER_KEY, AUTH_TOKEN_KEY } from '@/auth/session'
import { loginPathFromAppPath } from '@/utils/loginRoutes'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

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

app.mount('#app')

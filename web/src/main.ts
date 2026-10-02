import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import './assets/css/tailwind.css'
// Element Plus 样式：**一次性全量引入**（与 vite.config.ts 里 ElementPlusResolver({ importStyle: false }) 配套）。
//
// 为什么不用按需样式：按需会把每个组件展开成 `element-plus/es/components/<组件>/style/css`
// 这样的深层导入，而 Vite 的依赖预构建**启动时不知道**这些路径，只能用到哪个才发现哪个 ——
// 每发现一个新的就重跑预构建并打印 `optimized dependencies changed. reloading`，
// 也就是**整页强制刷新**。实测前端日志里 11 分钟内出现了 8 次，症状正是
// 「一进新页面就卡很久、请求暴增」：刷新会把全部首屏模块重新下载执行一遍。
// 全量引入后这些深层样式模块根本不在依赖图里，重载循环随之消失。
//
// 代价：CSS 从按需的约 150KB 涨到 357KB（gzip 后约 +25KB），dev 与生产都一样。
// 这是**有意接受的**取舍：换掉的是每次导航都可能触发的整页重载。
//
// 程序式 API（ElMessage / ElMessageBox）与 v-loading 指令的样式也都在这个文件里，
// 所以下面不再需要单独引它们的 style/css —— 删掉那两行前请先确认这一点仍然成立。
import 'element-plus/dist/index.css'
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

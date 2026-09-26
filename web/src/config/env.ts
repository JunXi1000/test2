import { ref } from 'vue'

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api'

const getRuntimeMockValue = () => {
  try {
    const v = localStorage.getItem('RUNTIME_USE_MOCK')
    if (v === null) return null
    return v === 'true'
  } catch {
    return null
  }
}

/**
 * localStorage 覆盖**只在 dev 构建生效**（生产构建恒为 null）。
 *
 * 为什么要这条限制：该开关能静默把整个应用切成 mock 模式，且**界面上没有任何提示**。
 * 症状极具迷惑性 —— 登录"成功"、存下假 token，随后没有 mock 分支的接口拿它打真后端
 * 得到 401，`http.ts` 的 401 拦截器再清登录态跳回 `/login`，表现为**登录死循环**。
 * 它本是给 E2E 用的，一旦残留在真实浏览器里就会污染生产构建。
 *
 * ⚠️ **它解决不了 dev 下的同一问题**，这是有意的：整套 E2E 正是靠 dev server +
 * storageState 注入这个键来跑的，dev 必须保留这条通路。若在 dev 下踩到残留，
 * 仍需手动 `localStorage.removeItem('RUNTIME_USE_MOCK')` 或清站点数据。
 */
const runtimeMock = import.meta.env.DEV ? getRuntimeMockValue() : null

export const USE_MOCK: boolean =
  runtimeMock !== null ? runtimeMock : String(import.meta.env.VITE_USE_MOCK) === 'true'

// Reactive version for components/watchers if needed, though usually we reload page
export const RUNTIME_USE_MOCK = ref(USE_MOCK)

export const FEATURE_DEV_LOGOUT: boolean =
  String(import.meta.env.VITE_FEATURE_DEV_LOGOUT) === 'true' || import.meta.env.DEV

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { API_BASE_URL } from '@/config/env'
import type { ApiResponse } from './types'
import { clearAuthStorage, getStoredToken } from '@/auth/session'
import { loginPathFromAppPath } from '@/utils/loginRoutes'
import { notifyUserScopeChange } from '@/stores/userScope'

let isHandlingUnauthorized = false

const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
  withCredentials: false,
})

http.interceptors.request.use((config) => {
  // Read token from centralized auth storage
  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    // If server follows { code, message, data } structure
    const res = response.data as any
    if (typeof res?.code === 'number') {
      if (res.code === 0 || res.code === 200) return res.data
      const err = new Error(res.msg || res.message || 'Request Error')
      // Attach for debugging if needed
      ;(err as any).code = res.code
      throw err
    }
    // Otherwise return raw data
    return response.data as any
  },
  (error) => {
    const status = error?.response?.status
    if (status === 401) {
      if (!isHandlingUnauthorized) {
        isHandlingUnauthorized = true

        clearAuthStorage()
        notifyUserScopeChange() // 会话失效后本地数据回退到 guest 作用域
        try {
          sessionStorage.setItem('auth_cleared', '1')
        } catch {}

        const path = window.location.pathname + window.location.search
        const isLoginRoute = window.location.pathname.includes('/login')
        if (!isLoginRoute) {
          const redirect = encodeURIComponent(path)
          const loginPath = loginPathFromAppPath(window.location.pathname)
          window.location.href = `${loginPath}?redirect=${redirect}`
        } else {
          // Reset lock on login page to allow future 401 handling if needed
          isHandlingUnauthorized = false
        }
      }
    } else if (error?.response?.data) {
      // 非 401 业务错误(如登录凭据错误 → 409):透传后端具体原因,
      // 否则用户只会看到笼统的 "Request failed with status code 409"。
      // 后端错误体形如 { code, msg: '操作失败', data: '用户名或密码错误' } —— data 才是具体原因。
      const res = error.response.data as any
      const msg =
        typeof res?.data === 'string' && res.data
          ? res.data
          : typeof res?.msg === 'string' && res.msg
            ? res.msg
            : ''
      if (msg) error.message = msg
    }
    return Promise.reject(error)
  },
)

/**
 * 四个动词的 T 默认 `unknown` 而不是 `any`。
 *
 * `any` 会**静默传染**：`const data = await get('/x')` 拿到 any，再漏进组件 prop，
 * 编译器全程不响 —— 这是 CLAUDE.md「接口数据不默认 any」要堵的口子。
 * 换成 `unknown` 后，**没写注解的调用点会在编译期报错**，逼调用方写明期望的形状。
 *
 * 为什么改了默认值却没动任何调用点：TypeScript 会用**上下文类型反推泛型**。
 * `const t: string = await post(...)` 会把 T 推成 `string`；`Promise<void>` 里的
 * `return del(...)` 会推成 `void`（已用 `vue-tsc` + LSP hover 验证：hover 显示
 * `get<string>(...): Promise<string>`）。所以存量调用点因注解/声明返回类型而全部保住，
 * 收益完整落在将来新写的、忘了声明的调用点上 —— 那才是 `any` 原来真正伤人的地方。
 */
export function get<T = unknown>(url: string, config?: AxiosRequestConfig) {
  return http.get<any, T>(url, config)
}

export function post<T = unknown>(url: string, data?: any, config?: AxiosRequestConfig) {
  return http.post<any, T>(url, data, config)
}

export function put<T = unknown>(url: string, data?: any, config?: AxiosRequestConfig) {
  return http.put<any, T>(url, data, config)
}

export function del<T = unknown>(url: string, config?: AxiosRequestConfig) {
  return http.delete<any, T>(url, config)
}

export default http

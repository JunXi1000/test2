import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { API_BASE_URL } from '@/config/env'
import type { ApiResponse } from './types'
import { clearAuthStorage, getStoredToken } from '@/auth/session'
import { loginPathFromAppPath } from '@/utils/loginRoutes'

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
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    }
  }
  return config
})

http.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    // If server follows { code, message, data } structure
    const res = response.data as any
    if (typeof res?.code === 'number') {
      if (res.code === 0) return res.data
      const err = new Error(res.message || 'Request Error')
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
    }
    return Promise.reject(error)
  }
)

export function get<T = any>(url: string, config?: AxiosRequestConfig) {
  return http.get<any, T>(url, config)
}

export function post<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
  return http.post<any, T>(url, data, config)
}

export function put<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
  return http.put<any, T>(url, data, config)
}

export function del<T = any>(url: string, config?: AxiosRequestConfig) {
  return http.delete<any, T>(url, config)
}

export default http

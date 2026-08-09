import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { AUTH_USER_KEY, clearAuthStorage, getStoredToken, setStoredToken } from '@/auth/session'
import { notifyUserScopeChange } from './userScope'

export interface User {
  id: string
  name: string
  email: string
  role: 'user' | 'admin' | 'merchant'
  avatar?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string>('')
  const authReady = ref(false)

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  function initAuth() {
    if (authReady.value) return
    try {
      const storedUser = localStorage.getItem(AUTH_USER_KEY)
      const parsed = storedUser ? JSON.parse(storedUser) : null
      if (parsed && ['user', 'admin', 'merchant'].includes(parsed.role)) {
        user.value = parsed
      } else {
        clearAuthStorage()
      }
      token.value = getStoredToken()
      if (!token.value || !user.value) {
        user.value = null
        token.value = ''
      }
    } catch {
      clearAuthStorage()
      user.value = null
      token.value = ''
    } finally {
      authReady.value = true
    }
  }

  function login(userData: User, accessToken?: string) {
    user.value = userData
    if (accessToken) {
      token.value = accessToken
      setStoredToken(accessToken)
    } else if (!token.value) {
      // Fallback for mock mode/dev, keep auth flow available
      token.value = `mock_${userData.id}`
      setStoredToken(token.value)
    }
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData))
    // 用户变化后通知各 store 重载对应作用域的数据, 避免新用户读到旧用户数据
    notifyUserScopeChange()
  }

  function logout() {
    user.value = null
    token.value = ''
    clearAuthStorage()
    notifyUserScopeChange()
  }

  function updateUser(userData: Partial<User>) {
    if (user.value) {
      user.value = { ...user.value, ...userData }
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user.value))
    }
  }

  return { user, token, authReady, isAuthenticated, initAuth, login, logout, updateUser }
})

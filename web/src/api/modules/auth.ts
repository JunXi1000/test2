import { USE_MOCK } from '@/config/env'
import { post } from '@/api/http'
import type { User } from '@/stores/auth'

interface LoginPayload { email: string; password: string; role?: 'user' | 'admin' | 'merchant' }
export interface LoginResult {
  user: User
  token?: string
}

export async function login(payload: LoginPayload): Promise<LoginResult> {
  if (USE_MOCK) {
    const role = payload.role || 'user'
    return Promise.resolve({
      user: {
        id: `${role}_123`,
        name: role === 'admin' ? 'System Admin' : role === 'merchant' ? 'Nike Store' : 'Alex Doe',
        email: payload.email,
        role: role,
        avatar: role === 'admin' 
          ? 'https://images.unsplash.com/photo-1531123414780-f7423cb3e09d?q=80&w=200&auto=format&fit=crop'
          : role === 'merchant'
          ? 'https://images.unsplash.com/photo-1517849845537-4d257902454a?q=80&w=200&auto=format&fit=crop'
          : 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop'
      },
      token: `mock_${role}_token`
    })
  }
  // Compatible with both response styles:
  // 1) { user, token }
  // 2) user only
  return post<any>('/auth/login', payload).then((res) => {
    if (res?.user) {
      return { user: res.user as User, token: res.token }
    }
    return { user: res as User, token: res?.token }
  })
}

/** Mock 环境下忘记密码成功页展示的测试用 token，用于打开「重置密码」页联调。 */
export const MOCK_PASSWORD_RESET_TOKEN = 'mock-dev-reset-token'

/** 请求发送重置密码邮件（真实环境由后端发信，邮件内带指向 `/reset-password?token=...` 的链接）。 */
export async function requestPasswordReset(email: string): Promise<void> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 800))
    return
  }
  await post('/auth/forgot-password', { email })
}

/** 使用邮件中的 token 设置新密码（无需登录）。 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 800))
    const t = token.trim()
    if (!t) throw new Error('无效的重置链接。')
    return
  }
  await post('/auth/reset-password', { token: token.trim(), password: newPassword })
}

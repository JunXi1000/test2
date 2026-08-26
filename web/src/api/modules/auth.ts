import { USE_MOCK } from '@/config/env'
import { get, post, put } from '@/api/http'
import type { User } from '@/stores/auth'

// ── Role / type mapping ──────────────────────────────────────────────
const ROLE_TO_TYPE: Record<string, string> = {
  user: 'USER',
  merchant: 'SHOP',
  admin: 'ADMIN'
}

const TYPE_TO_ROLE: Record<string, User['role']> = {
  USER: 'user',
  SHOP: 'merchant',
  ADMIN: 'admin'
}

// ── JWT payload decoding (no signature verification — just reading claims) ──
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    // Convert URL-safe base64 to standard base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    // atob 返回 Latin-1 二进制串,中文等 UTF-8 字节会被逐字节误解释成乱码;
    // 需先把字节还原成 Uint8Array,再按 UTF-8 解码为字符串。
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const json = new TextDecoder('utf-8').decode(bytes)
    return JSON.parse(json)
  } catch {
    return null
  }
}

function userFromBackendDto(dto: {
  id: number | string
  type?: string
  username?: string
  nickname?: string
  avatarUrl?: string
  email?: string
}): User {
  const role = TYPE_TO_ROLE[dto.type || ''] || 'user'
  return {
    id: String(dto.id),
    name: dto.nickname || dto.username || '',
    email: dto.email || '',
    role,
    avatar: dto.avatarUrl
  }
}

// ── Login ────────────────────────────────────────────────────────────
export interface LoginPayload {
  email: string
  password: string
  role?: 'user' | 'admin' | 'merchant'
}

export interface LoginResult {
  user: User
  token: string
}

export async function login(payload: LoginPayload): Promise<LoginResult> {
  if (USE_MOCK) {
    const role = payload.role || 'user'
    return {
      user: {
        id: `${role}_123`,
        name: role === 'admin' ? 'System Admin' : role === 'merchant' ? 'Nike Store' : 'Alex Doe',
        email: payload.email,
        role,
        avatar: ''
      },
      token: `mock_${role}_token`
    }
  }

  // Backend expects { username, password, type } at POST /common/login
  const type = ROLE_TO_TYPE[payload.role || 'user'] || 'USER'
  const token: string = await post('/common/login', {
    username: payload.email,   // frontend uses email field, backend uses username
    password: payload.password,
    type
  })

  // Decode JWT payload to extract user info
  const claims = decodeJwtPayload(token)
  let user: User
  if (claims?.currentUser) {
    const dto = typeof claims.currentUser === 'string'
      ? JSON.parse(claims.currentUser)
      : claims.currentUser
    user = userFromBackendDto(dto)
  } else {
    // Fallback: make a separate call to get current user
    const dto = await get<any>('/common/currentUser')
    user = userFromBackendDto(dto)
  }

  return { user, token }
}

// ── Register ─────────────────────────────────────────────────────────
export interface RegisterPayload {
  role: 'user' | 'merchant'
  email: string        // becomes username on backend
  password: string
  nickname: string     // display name
  /** Merchant-only: store name */
  storeName?: string
  /** Merchant-only: qualification image URLs (comma-separated or JSON array) */
  aptitudeImgs?: string
}

export async function register(payload: RegisterPayload): Promise<void> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 800))
    return
  }

  const type = ROLE_TO_TYPE[payload.role] || 'USER'
  const body: Record<string, any> = {
    type,
    username: payload.email,
    password: payload.password,
    nickname: payload.nickname,
    // 邮箱必须同时以 email 字段传给后端,否则后端 email 列落空,管理端用户列表显示为空
    email: payload.email
  }

  if (type === 'SHOP') {
    body.name = payload.storeName || payload.nickname
    body.aptitudeImgs = payload.aptitudeImgs || ''
  }

  await put('/common/register', body)
}

// ── Password reset ───────────────────────────────────────────────────

/**
 * 第一步:请求发送重置验证码。
 * @returns 6 位验证码(演示环境后端直接返回,便于页面展示;接入短信后不再返回)
 */
export async function requestPasswordReset(email: string): Promise<string> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 800))
    return '123456' // 演示验证码
  }
  // 真实分支:POST /common/sendResetCode { type, tel }
  return post<string>('/common/sendResetCode', {
    type: 'USER',
    tel: email
  })
}

/**
 * 第二步:用验证码 + 手机号 + 新密码完成改密。
 * 后端校验验证码(不存在/过期/不匹配均拒绝)后才写入新密码。
 */
export async function resetPasswordWithToken(code: string, email: string, newPassword: string): Promise<void> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 800))
    if (!code.trim()) throw new Error('无效的重置验证码。')
    return
  }
  // 真实分支:POST /common/retrievePassword { type, tel, code, password }
  await post('/common/retrievePassword', {
    type: 'USER',
    tel: email,
    code,
    password: newPassword
  })
}

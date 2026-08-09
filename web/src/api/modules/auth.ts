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
    const json = atob(base64)
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
    nickname: payload.nickname
  }

  if (type === 'SHOP') {
    body.name = payload.storeName || payload.nickname
    body.aptitudeImgs = payload.aptitudeImgs || ''
  }

  await put('/common/register', body)
}

// ── Password reset ───────────────────────────────────────────────────
export const MOCK_PASSWORD_RESET_TOKEN = 'mock-dev-reset-token'

export async function requestPasswordReset(email: string): Promise<void> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 800))
    return
  }
  // Backend: POST /common/retrievePassword expects RetrievePasswordDTO { type, tel, code, password }
  // Frontend sends email; backend uses tel field — this is inherently mismatched
  // For now, send as best-effort
  await post('/common/retrievePassword', {
    type: 'USER',
    tel: email,
    password: ''
  })
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 800))
    const t = token.trim()
    if (!t) throw new Error('无效的重置链接。')
    return
  }
  // Backend: POST /common/resetPassword?type=USER&id=<userId>
  // The token from the email would need to encode the user ID
  await post(`/common/resetPassword?type=USER&id=${token}`)
}

/**
 * 用户维度 localStorage 隔离工具。
 *
 * 问题: 购物车/心愿单/浏览历史等 store 之前都用固定 key 存 localStorage,
 *       切换登录用户后, 新用户会读到上一个用户的本地数据。
 * 方案: 每个 key 拼接当前用户 id 作用域(未登录为 guest), 并在登录/登出时广播重载。
 */
import { AUTH_USER_KEY } from '@/auth/session'

export type StorageScope = 'guest' | `u${string}`

/** 从 localStorage 读取当前登录用户 id(与 auth store 写入同一 key), 未登录返回 guest */
export function getStorageScope(): StorageScope {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    if (!raw) return 'guest'
    const parsed = JSON.parse(raw)
    if (parsed && parsed.id != null) return `u${parsed.id}`
    return 'guest'
  } catch {
    return 'guest'
  }
}

/** 根据当前用户作用域生成隔离后的存储 key */
export function scopedKey(base: string): string {
  return `${base}_${getStorageScope()}`
}

// ── 登录/登出时广播, 各 store 订阅后按新作用域重新加载 ──────────────
type Listener = () => void
const listeners = new Set<Listener>()

export function onUserScopeChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function notifyUserScopeChange() {
  listeners.forEach(fn => {
    try { fn() } catch { /* 单个 store 重载失败不应阻断其余 store */ }
  })
}

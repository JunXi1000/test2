/** 与 Checkout.vue 内联使用的邮箱正则保持一致 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

/**
 * 登录标识校验(宽松):后端将 email 当作 username 登录,同时兼容手机号/用户名。
 * 空 → false;含 @ → 按邮箱正则校验;否则 → 至少 3 个字符。
 */
export function isValidLoginId(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  return v.includes('@') ? EMAIL_RE.test(v) : v.length >= 3
}

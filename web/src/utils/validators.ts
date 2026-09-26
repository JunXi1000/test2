/**
 * 邮箱正则的**唯一**定义处。阶段 9 之前它有三份（本文件 + 结算表单内联 + 商家钱包内联），
 * 现已全部收拢到这里 —— 改校验规则时只该改一处。
 *
 * 刻意保持宽松：只要求「非空白 @ 非空白 . 非空白」。收紧它会让一批真实可达的邮箱
 * （含 `+` 标签、多级域名）被拒，而真正的判定应该交给后端。
 */
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

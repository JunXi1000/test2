/**
 * 把 catch 到的未知值折算成一句能直接给用户看的话。
 *
 * 优先级：Error.message > 字符串本身 > 形如 { message } 的对象 > 兜底。
 *
 * 之所以 Error.message 排第一，是因为 `src/api/http.ts` 的两个拦截器**已经**把后端的
 * 具体原因写进去了：
 *   - 业务错误码（HTTP 200 但 code 非 0/200）→ success 分支 `throw new Error(res.msg || res.message)`
 *   - HTTP 错误（如 409）→ error 分支把 `{ code, msg, data }` 里的 data/msg 覆写进 error.message
 * 所以调用点再去读 `e.response.data.msg` 不只是重复，还会**看不到业务错误码那条路径**——
 * 那条路径抛的是普通 Error，根本没有 response。
 * 后端错误体的具体原因常在 `data` 而非 `msg`，这个取舍拦截器已经做过了，这里不要再做一遍。
 */
export function toErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) {
    const msg = e.message?.trim()
    if (msg) return msg
    return fallback
  }

  if (typeof e === 'string') {
    const msg = e.trim()
    return msg || fallback
  }

  // 库边界上的抛出物不保证是 Error 实例，形如 { message } 的对象也认
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const msg = (e as { message?: unknown }).message
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
  }

  return fallback
}

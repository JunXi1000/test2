/**
 * 把 `File` 读成 data URL。失败时 reject，**由调用方决定是提示还是吞掉**。
 *
 * 抽出来的东西只有这些 —— 四处调用点（头像 / 商品封面 / 商家 logo / 评价配图）共用的是
 * 这段 FileReader 的三步走，**不是同一段业务逻辑**：它们的类型与大小限制、失败文案、
 * 以及拿到 data URL 之后干什么（本地预览 vs 上传后端）都不一样，那些刻意留在各自那里。
 *
 * 返回 Promise 而不是回调：四处原先都是回调式，其中一处（评价配图）本来就是 Promise；
 * 统一成 Promise 后调用方可以用 `.catch()` 明确表态，不会出现"没人接的 onerror"。
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('read_error'))
    reader.readAsDataURL(file)
  })
}

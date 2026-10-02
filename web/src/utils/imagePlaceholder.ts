/**
 * 图片兜底占位图（内联 SVG data-URI）。
 *
 * 为什么单独成一个模块：商品图集的失败兜底（原图 → 这张）与详情页别处的
 * `<img @error>` 内联兜底都要用它，而图集已经搬进子组件，父子不再共享作用域。
 *
 * 为什么用 data-URI 而不是静态图片文件：它必须在外链图**全部**失败时仍然可用 ——
 * 再引一次网络请求就可能在同样的网络问题下一起失败。
 * （这条要求当初催生了"再试一次外部图床"的方案，但那会把无关的随机图片当成商品图显示，
 *   已于 2026-10 移除；现在失败直接落到这里。）
 *
 * 配色刻意用中性灰（#e5e7eb / #9ca3af / #6b7280），它在亮暗两种主题下都是"空缺"的观感，
 * 不需要两套。
 */
export const IMAGE_FALLBACK =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="720" height="540" viewBox="0 0 720 540"><rect width="720" height="540" fill="%23e5e7eb"/><g fill="%239ca3af"><circle cx="280" cy="220" r="34"/><path d="M120 390l130-120 95 90 85-70 170 100H120z"/></g><text x="360" y="470" font-family="Arial,sans-serif" font-size="28" fill="%236b7280" text-anchor="middle">Image unavailable</text></svg>'

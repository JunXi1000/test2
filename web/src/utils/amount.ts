/**
 * 契约兜底：把「字段缺失 / null / NaN」折算成 0，避免 `NaN` 传染进金额。
 *
 * ⚠️ 它**只做类型兜底，不做任何业务算术** —— 应付额、小计、减免一律以服务端回包为准
 * （见 `useOrderSummary.ts` 与 `useCartSummary.ts` 的 `total`，两处都是
 * `amount(summary.value.total)`）。
 *
 * 为什么抽成共享工具而不是各写一份：BLK-4（券）与 BLK-E1（积分）都源于
 * 「同一个金额在两处各算一份」，最终页面显示额 ≠ 实际扣款。让两个页面**字面上调用
 * 同一个函数**，比让两份"看起来一样"的副本各自演化要安全得多 —— 副本会漂移，函数不会。
 */
export function amount(n: number | undefined | null): number {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

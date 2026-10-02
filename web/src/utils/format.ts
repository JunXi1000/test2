/**
 * 金额显示。**这里有两个变体，不要合并** —— 它们显示结果不同，合并是用户可见的改变。
 *
 * - `formatPrice`      —— 两位小数（`$899.00`）
 * - `formatPricePlain` —— 不带小数位（`$899`）
 *
 * 为什么是两个而不是一个：这不是"新旧写法"，是**两处排版需求**。结算/购物车/订单那种
 * 表格要对齐，用两位小数；商品卡/店铺页那种紧凑排版用整数更干净。
 *
 * 为什么当初要抽出来：结算页把「Complete the Look」抽成子组件后，父子两边的金额格式必须
 * 一致，而子组件够不着父组件的局部函数。阶段 9 又把它推广成全仓唯一来源 ——
 * 原先 `ProductCard` / `Cart` / `dashboard/Orders` / `StorePage` 各有一份**逐字复制**的
 * 本地函数（两份是这个、两份是 Plain），现已全部换成本模块的对应导出，**显示零变化**。
 */
export function formatPrice(n: number) {
  return toAmount(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * 金额入参归一：`undefined` / `null` / `NaN` / `Infinity` 一律按 0 处理。
 *
 * 为什么需要（`formatPricePlain` 早就为同一目的做了 `Number(price ?? 0)`，这里补齐它）：
 * 结算页消费 `/checkout/summary` 的响应，而后端正在把运费/税移出契约。一旦某个字段真的
 * 没回来，`undefined.toLocaleString()` 与 `NaN.toLocaleString()` 都会把 **"NaN"** 直接
 * 印到资损页面上。宁可显示 `$0.00`，也不要让 NaN 出现在结算页。
 * 对合法数字**零影响**。
 */
function toAmount(n: number | undefined | null): number {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

/**
 * 不带小数位的价格（`$899`），商品详情/推荐位那种紧凑排版用。
 *
 * ⚠️ 与上面的 `formatPrice`（两位小数）**刻意并存，不要去"统一"** —— 两者显示结果不同
 * （`$899` vs `$899.00`），统一是用户可见的改变，该单独提、单独确认。
 * 名字里的 Plain 就是指"不带小数位"，不是"更简单"。
 *
 * 接 `undefined` 是因为调用点常写 `formatPricePlain(product?.price)` —— 商品还没加载时
 * 不该显示 `NaN`。
 */
export function formatPricePlain(price: number | undefined): string {
  return toAmount(price).toLocaleString('en-US')
}

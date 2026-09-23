/**
 * 金额显示：千分位 + 固定两位小数。
 *
 * 为什么单独成一个 util：结算页把「Complete the Look」抽成子组件后，父子两边的金额格式
 * 必须一致，而子组件够不着父组件的局部函数。
 *
 * **刻意没有一并统一仓里别的写法**（`ProductCard` / `Home` / `Compare` / `ProductDetail`
 * 用的是不带小数位的 `toLocaleString('en-US')`，`Cart.vue` 与 `dashboard/Orders.vue`
 * 则各自复制了一份本函数）。统一会把 `$50` 变成 `$50.00` —— 那是用户可见的改变，
 * 不该混在一次结构重构里。要统一请单独提，并先确认小数位是设计意图。
 */
export function formatPrice(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  return Number(price ?? 0).toLocaleString('en-US')
}

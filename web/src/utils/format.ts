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

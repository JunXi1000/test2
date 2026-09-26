#!/usr/bin/env node
/**
 * 提交前用 Vue 自己的编译器把 .vue 的模板逐个编译一遍，编译不过就拒绝提交。
 *
 * 为什么需要它：
 *   prettier 3.9.8 格式化 v-on 内联处理器时，会把 `;` 分隔的多条语句拆成多行并
 *   **丢掉分号**，Vue 编译器只能回退成 `(${exp})` 包裹，于是换行分隔的两条语句
 *   成了非法语法，构建期报 `Unexpected token, expected ","`。
 *
 *   这类改坏 **typecheck 和 eslint 都发现不了**：`vue-tsc` 报 EXIT 0、`eslint`
 *   报 0 error，四条闸门里只有 E2E 会红（dev server 下整页 vite-error-overlay，
 *   凡是要点击的用例全部超时）。2026-09-21 实测过一次：8 文件 / 12 处，
 *   102 条 E2E 里 55 条失败，而当时正准备以"格式化提交"的名义推上去。
 *
 *   本脚本挂在 lint-staged 的 `prettier --write` **之后**，把这道口子堵在提交前。
 *
 * 用法（lint-staged 自动追加暂存文件路径）：
 *   node scripts/check-vue-template.mjs src/pages/Home.vue src/pages/Cart.vue
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')

// 用 web/package.json 解析，避免脚本被从别处调用时找不到依赖
const require = createRequire(resolve(webRoot, 'package.json'))

let parse
let compileTemplate
try {
  ;({ parse, compileTemplate } = require('@vue/compiler-sfc'))
} catch (e) {
  // 依赖缺失时必须**报错退出**，不能静默放行 —— 一个永远通过的闸门比没有闸门更坏
  console.error('[check-vue-template] 无法加载 @vue/compiler-sfc，校验未执行。')
  console.error('[check-vue-template] 请在 web/ 下执行 npm install 后重试。')
  console.error(String(e))
  process.exit(1)
}

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('[check-vue-template] 没有收到任何文件路径，校验未执行。')
  process.exit(1)
}

const problems = []

/** 把编译器错误拼成「第 N 行：<原因>」；拿不到行号时只给原因，不假装知道位置 */
function withLine(error, line) {
  return (line ? `第 ${line} 行：` : '') + (error.message || String(error))
}

for (const file of files) {
  let source
  try {
    source = readFileSync(file, 'utf8')
  } catch (e) {
    problems.push({ file, messages: [`读取失败：${String(e)}`] })
    continue
  }

  // parse() 校验的是整个 SFC，报出的 loc 已经是**文件行号**，直接用
  const { descriptor, errors: parseErrors } = parse(source, { filename: file })
  if (parseErrors.length) {
    problems.push({ file, messages: parseErrors.map((e) => withLine(e, e.loc?.start?.line)) })
    continue
  }
  if (!descriptor.template) continue

  // compileTemplate() 报出的 loc 是**模板内容内**的行号（第 1 行 = <template> 的下一行），
  // 要加上 <template> 自己所在的行才是文件行号
  const templateStartLine = descriptor.template.loc.start.line
  const result = compileTemplate({
    source: descriptor.template.content,
    filename: file,
    id: 'check',
    // 模板里有用 `as` 的 TS 表达式（如 StorePage.vue 的 @change），不带这个会误报
    compilerOptions: { expressionPlugins: ['typescript'] },
  })
  if (result.errors.length) {
    problems.push({
      file,
      messages: result.errors.map((e) =>
        withLine(e, e.loc?.start?.line ? templateStartLine + e.loc.start.line : undefined),
      ),
    })
  }
}

if (!problems.length) {
  console.log(`[check-vue-template] ${files.length} 个 .vue 模板编译通过`)
  process.exit(0)
}

console.error('\n[check-vue-template] 以下 .vue 的模板编译不过，提交已阻止：\n')
for (const p of problems) {
  console.error(`  ${p.file}`)
  for (const m of p.messages) console.error(`    ${m}`)
}
console.error(`
最常见的原因是 prettier 把 v-on 内联处理器里的分号吃掉了：

    @click="a(); b = false"        ← 正确
    @click="
      a()
      b = false
    "                              ← prettier 的输出，非法

改法：写成单个表达式，或包成显式箭头函数 —— 后者 prettier 是幂等的：

    @click="() => { a(); b = false }"

注意包成箭头函数后会丢 TS 收窄（模板里的 ref 取值属可变属性，收窄不跨闭包），
可能需要在闭包内补一层 if (x) 守卫。
`)
process.exit(1)

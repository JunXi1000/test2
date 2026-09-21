/**
 * 生成 ESLint 存量豁免基线（棘轮机制）
 *
 * 跑一次 ESLint，把「当前所有 error」按 规则名 → 文件列表 的形态写进 eslint.baseline.json。
 * 这些豁免只对基线里列出的文件生效，且每文件只豁免它确实违反的规则。
 *
 * 用法：
 *   node scripts/gen-eslint-baseline.mjs          # 生成/覆盖基线（用当前违规状态）
 *   node scripts/gen-eslint-baseline.mjs --dry    # 只看统计，不写文件
 *
 * 重构完某个文件后，请把它从 eslint.baseline.json 对应规则里删掉。
 *
 * ⚠️ 本次 lint 必须先忽略现有基线，否则是个自毁棘轮：基线里的规则被 off 掉后
 *    就不再报 error，生成器会测到「0 个 error」并写回空表，下次 lint 立刻满血复发
 *    （实测 88 个 error）。所以下面第一件事就是设 ESLINT_IGNORE_BASELINE=1。
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { ESLint } from 'eslint'

const DRY = process.argv.includes('--dry')
const BASELINE_PATH = new URL('../eslint.baseline.json', import.meta.url)

// 必须在 new ESLint() 之前设：config 在加载时读这个变量
process.env.ESLINT_IGNORE_BASELINE = '1'

// 用 Node API 而非起子进程：避开 Windows 上 spawn .cmd 的坑，也避开管道吞掉退出码
const eslint = new ESLint()
const results = await eslint.lintFiles(['.'])

/** @type {Record<string, Set<string>>} */
const byRule = {}
let errorCount = 0
let fileCount = 0
let warnCount = 0

for (const file of results) {
  warnCount += file.warningCount
  if (file.errorCount === 0) continue
  fileCount++
  // flat config 的 files 模式相对 cwd 匹配，所以这里也换算成 cwd 相对路径
  const rel = path.relative(process.cwd(), file.filePath).replace(/\\/g, '/')
  for (const msg of file.messages) {
    if (msg.severity !== 2) continue // 只收 error
    errorCount++
    const rule = msg.ruleId ?? 'parsing-error'
    if (!byRule[rule]) byRule[rule] = new Set()
    byRule[rule].add(rel)
  }
}

const baseline = {}
for (const rule of Object.keys(byRule).sort()) {
  baseline[rule] = [...byRule[rule]].sort()
}

console.log(`扫描 ${results.length} 个文件：${fileCount} 个有 error，共 ${errorCount} 处；warn ${warnCount} 处`)
console.log('\n按规则分布（规则 → 需豁免的文件数）：')
for (const [rule, files] of Object.entries(baseline)) {
  console.log(`  ${String(files.length).padStart(3)}  ${rule}`)
}

// 不变式：既然本次测量已关掉基线，那么「测到 error」与「基线非空」必须同真同假。
// 两者背离就说明豁免又被自己吃掉了，此时写盘会把闸门静默改红——宁可直接失败。
if (errorCount > 0 && Object.keys(baseline).length === 0) {
  console.error('\n[FATAL] 测到 error 却没生成任何豁免条目，基线疑似被豁免自身吞掉。')
  console.error('        拒绝写盘。请确认 eslint.config.js 的 ESLINT_IGNORE_BASELINE 分支还在。')
  process.exit(1)
}

if (DRY) {
  console.log('\n--dry 模式，未写入文件')
} else {
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8')
  console.log(`\n已写入 eslint.baseline.json（${Object.keys(baseline).length} 条规则）`)
}

import { existsSync, readFileSync } from 'node:fs'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

/**
 * 存量豁免（棘轮机制）
 *
 * eslint.baseline.json 形如 { "规则名": ["违规文件", ...] }。
 * 只有「基线里列出的文件」会被关掉「它确实违反的那条规则」，其余规则一律照常生效。
 * 重构完一个文件后，从基线中删掉它即可让该规则立即生效——闸门只会越收越紧。
 *
 * 重新生成：npm run lint:baseline
 */
function loadBaselineOverrides() {
  // 重新生成基线时必须先关掉豁免本身，否则这是个自毁的棘轮：
  // 豁免生效 → 那些规则不再报 error → 生成器测到「0 个 error」→ 写回空表 →
  // 下次 npm run lint 时 7 条规则全面复发（实测 88 个 error，闸门直接红）。
  // scripts/gen-eslint-baseline.mjs 会自己设这个变量，人工跑 lint 时不要设。
  if (process.env.ESLINT_IGNORE_BASELINE === '1') return []

  const url = new URL('./eslint.baseline.json', import.meta.url)
  if (!existsSync(url)) return []
  try {
    const parsed = JSON.parse(readFileSync(url, 'utf8'))
    // 按规则分组，每条规则生成一个 files 精确匹配的 override
    return Object.entries(parsed)
      .filter(([, files]) => Array.isArray(files) && files.length > 0)
      .map(([ruleId, files]) => ({
        files,
        rules: { [ruleId]: 'off' },
      }))
  } catch {
    console.warn('[eslint] eslint.baseline.json 解析失败，本次按零豁免运行')
    return []
  }
}

export default [
  // ---------- 忽略 ----------
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'public/**',
      // unplugin-vue-components 自动生成，勿手改也勿检查
      'src/components.d.ts',
    ],
  },

  // ---------- 基础规则 ----------
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  // .vue 里的 <script lang="ts"> 交给 TS 解析器
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },

  // ---------- 增量严格规则 ----------
  {
    files: ['**/*.{ts,vue}'],
    rules: {
      // 规范第 6 条：禁止随意 any；必须用时须写明原因
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },

  // 单词组件名是本项目有意为之，不是违规：
  //   src/pages/**、src/layouts/** —— Cart.vue / Checkout.vue 等页面本就单词
  //   src/components/ui/**        —— shadcn 风格的 Button / Card / Skeleton …
  {
    files: ['src/pages/**/*.vue', 'src/layouts/**/*.vue', 'src/components/**/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },

  // no-undef 是给纯 JS 用的规则：它不认 TS 类型、也不认 unplugin 自动注册的全局组件。
  // .ts/.vue 的未定义标识符由 vue-tsc 兜底（当前 0 错），这里关掉避免误报。
  {
    files: ['**/*.{ts,vue}'],
    rules: { 'no-undef': 'off' },
  },

  // 配置文件与脚本跑在 Node 里，补上 Node 全局（不额外引依赖）
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'writable',
        require: 'readonly',
        exports: 'writable',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
  },

  // ---------- 存量豁免（必须放在最后） ----------
  ...loadBaselineOverrides(),

  // prettier 放最后，关掉所有与格式化冲突的规则
  prettier,
]

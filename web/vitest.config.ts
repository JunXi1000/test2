import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

/**
 * 单测配置。
 *
 * 与 playwright.config.ts 的分工：Playwright 的 testDir 是 ./tests（只收 E2E），
 * 这里只收 src/**\/*.spec.ts（就近单测），两边互不抢文件。
 * 注意：本文件存在时 vitest 不再读 vite.config.ts，所以 alias 需在此重复声明。
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts'],
    // 显式 import vitest API，不注入全局，以免 vue-tsc 需要额外 types
    globals: false,
    restoreMocks: true,
    // 便于定位"测试间互相污染"
    sequence: { shuffle: false },
  },
})

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 4,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    ignoreHTTPSErrors: true,
    // E2E 一律跑在 mock 模式下：localStorage 必须在应用启动前写好，
    // storageState 是 Playwright 唯一能在页面脚本执行前注入 localStorage 的官方入口。
    // 不这么做的话，前端会按 .env 的 VITE_API_BASE_URL=/api 走 Vite 代理打到 :1000 的真实后端。
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:5173',
          localStorage: [{ name: 'RUNTIME_USE_MOCK', value: 'true' }],
        },
      ],
    },
  },
  // 自带 dev server：忘启动时不再是一屏看不懂的失败，而是自动拉起
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})

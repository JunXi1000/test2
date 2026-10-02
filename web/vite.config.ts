import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    Components({
      dts: 'src/components.d.ts',
      // importStyle: false —— 样式改为在 main.ts 里**一次性全量引入**（见那里的长注释）。
      //
      // 起因（实测）：默认的按需样式会把每个组件展开成
      // `element-plus/es/components/<组件>/style/css` 这类深层导入。这些路径在 Vite 启动时
      // **不在依赖预构建清单里**，只能用到哪个才发现哪个；每发现一个新的，Vite 就重跑预构建
      // 并打印 `optimized dependencies changed. reloading` —— 也就是**整页强制刷新**。
      // 实测前端日志里 11 分钟内出现了 **8 次**，症状是「一进新页面就卡很久、请求暴增」：
      // 刷新会重新下载并重新执行全部首屏模块（53 个 / 3.1 MB 未压缩代码），页面状态全丢。
      // 全量引入后这些深层样式模块根本不在图里，重载循环随之消失。
      resolvers: [ElementPlusResolver({ importStyle: false })],
    }),
  ],
  optimizeDeps: {
    // 把「启动时无法自动发现、却会在运行期才被 import」的依赖**显式**列出来。
    //
    // 不列会怎样：Vite 在运行期发现新依赖 → 重新预构建 → `optimized dependencies changed.
    // reloading` → 整页刷新。`element-plus/es` 正是实测日志里第一个被这样发现的
    // （首次打开任意含 el-* 的页面时），提前声明可连这一次重载也省掉。
    // echarts 的四个子路径同理：只有 admin 仪表盘会用到，进入它之前都是「未发现」状态。
    include: [
      'element-plus/es',
      'echarts/core',
      'echarts/charts',
      'echarts/components',
      'echarts/renderers',
      'lucide-vue-next',
      'axios',
      'lodash-es',
      '@vueuse/core',
      'vue-i18n',
    ],
  },
  server: {
    // 绑 IPv4 回环，而不是 host: true。
    //
    // 起因：Vite 默认只绑 IPv6 回环 ::1，于是 http://127.0.0.1:5173 连不上。
    // 早先这里写的是 `host: true`（监听所有网卡），能解决该问题，但代价是 Vite 会把
    // 本机每块网卡的地址都印进启动横幅 —— 本机除了 WLAN，还挂着 Radmin VPN 与 Meta
    // 两个虚拟网卡，于是横幅里冒出三个「Network」链接，其中一个还是 VPN 隧道地址。
    // 显式绑 127.0.0.1 精确解决原问题，且不对外暴露、横幅只剩一条 Local。
    //
    // 要在手机/别的机器上访问，用 `npm run dev:lan`（即 `vite --host`，CLI 会盖过这里的值）。
    // 那样横幅会重新列出全部网卡地址 —— 那正是你要的：得先看见 IP 才能输进手机。
    // 不要在这里绑死 192.168.x.x：绑具体 IP 就不再监听 127.0.0.1，`localhost` 会失效，
    // 而 playwright.config.ts 的 baseURL 正是 http://localhost:5173。
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://localhost:1000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')

          // 不要按文件给「稀有路由」单开 chunk（旧配置的 route-rare-* 已删）。
          // 路由本身全是 () => import()，Rollup 自动就会给每个页面切一个懒 chunk；
          // 手工指定反而会让入口 chunk 多出一条指向它的**静态** import
          // （实测 dist/assets/index-*.js 里同时存在 from"./route-rare-admin-*.js"
          //   与 import("./route-rare-admin-*.js")），于是它被写进 index.html 的
          // modulepreload，用户首屏白下这些永不访问的页面。删掉即自动修复。

          if (!normalizedId.includes('node_modules')) return

          // ── UI 库 ──
          if (normalizedId.includes('/element-plus/')) return 'ui-element-plus'
          if (normalizedId.includes('/lucide-vue-next/')) return 'ui-icons'

          // ── 图表 ──（zrender 是 echarts 的渲染内核，必须同进同出）
          if (normalizedId.includes('/echarts/') || normalizedId.includes('/zrender/')) {
            return 'vendor-echarts'
          }

          // ── 工具库 ──
          if (normalizedId.includes('/axios/')) return 'vendor-axios'
          if (normalizedId.includes('/lodash-es/')) return 'vendor-utils'
          if (
            normalizedId.includes('/@vueuse/core/') ||
            normalizedId.includes('/@vueuse/shared/')
          ) {
            return 'vendor-vueuse'
          }

          // ── 框架与 i18n 单独成块 ──
          // 这些是发版才会变的稳定依赖，独立成 chunk 才能长期命中浏览器缓存；
          // 混进 vendor-misc 会因业务代码任何改动导致整块缓存失效。
          // 注意 @vueuse 必须排在 vue 前面判（虽然 '/@vueuse/' 不含 '/@vue/'，
          // 但顺序写死能防后人改成宽匹配时误伤）。
          if (normalizedId.includes('/vue/') || normalizedId.includes('/@vue/')) {
            return 'vendor-vue'
          }
          if (normalizedId.includes('/vue-router/') || normalizedId.includes('/pinia/')) {
            return 'vendor-vue'
          }
          if (normalizedId.includes('/vue-i18n/') || normalizedId.includes('/@intlify/')) {
            return 'vendor-i18n'
          }

          // Keep remaining third-party deps in one fallback chunk
          return 'vendor-misc'
        },
      },
    },
  },
})

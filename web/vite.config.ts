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
      resolvers: [ElementPlusResolver()],
    }),
  ],
  server: {
    // 绑 IPv4 回环，而不是 host: true。
    //
    // 起因：Vite 默认只绑 IPv6 回环 ::1，于是 http://127.0.0.1:5173 连不上。
    // 早先这里写的是 `host: true`（监听所有网卡），能解决该问题，但代价是 Vite 会把
    // 本机每块网卡的地址都印进启动横幅 —— 本机除了 WLAN，还挂着 Radmin VPN 与 Meta
    // 两个虚拟网卡，于是横幅里冒出三个「Network」链接，其中一个还是 VPN 隧道地址。
    // 显式绑 127.0.0.1 精确解决原问题，且不对外暴露、横幅只剩一条 Local。
    //
    // 若要在手机/别的机器上访问开发服务器，把它改回 `true`（或填具体网卡 IP）。
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

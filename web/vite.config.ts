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
      resolvers: [ElementPlusResolver()]
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')
          // Rare route boundaries: keep low-frequency pages in dedicated lazy chunks.
          if (normalizedId.includes('/src/pages/ForgotPassword.vue')) return 'route-rare-auth'
          if (normalizedId.includes('/src/pages/ThankYou.vue')) return 'route-rare-public'
          if (normalizedId.includes('/src/pages/NotFound.vue')) return 'route-rare-public'
          if (normalizedId.includes('/src/pages/admin/Notifications.vue')) return 'route-rare-admin'

          if (!normalizedId.includes('node_modules')) return

          // UI libraries
          if (normalizedId.includes('/element-plus/')) return 'ui-element-plus'
          if (normalizedId.includes('/lucide-vue-next/')) return 'ui-icons'

          // Chart heavy dependencies
          if (normalizedId.includes('/echarts/')) return 'vendor-echarts'

          // Utilities and common vendors
          if (normalizedId.includes('/axios/')) return 'vendor-axios'
          if (
            normalizedId.includes('/lodash-es/') ||
            normalizedId.includes('/dayjs/')
          ) {
            return 'vendor-utils'
          }
          if (
            normalizedId.includes('/@vueuse/core/') ||
            normalizedId.includes('/@vueuse/shared/')
          ) {
            return 'vendor-vueuse'
          }

          // Keep remaining third-party deps in one fallback chunk
          return 'vendor-misc'
        }
      }
    }
  }
})

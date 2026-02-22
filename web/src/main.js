import {createApp} from 'vue'
import {createPinia} from 'pinia'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
// element-plus图标
import * as ElementPlusIconsVue from "@element-plus/icons-vue"
import TuiPlus from "@wocwin/t-ui-plus"
import "@wocwin/t-ui-plus/lib/style.css"

// 导入自定义主题配色
import "./styles/theme.css"
// 导入UI优化样式
import "./assets/css/ui-optimization.css"

// 新增：导入主题管理（初始化时会从缓存加载主题并应用到文档根节点）
// 中文注释：确保主题管理器在应用启动时生效，支持后续的明暗主题切换
import "./utils/theme.js"
import App from './App.vue'
import router from './router'
const app = createApp(App)
// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}

// import "./styles/common.css";

app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.use(TuiPlus)
app.mount('#app')

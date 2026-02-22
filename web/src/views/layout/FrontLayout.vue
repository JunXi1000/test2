<template>
  <el-container class="bilibili-container">
    <el-header class="bilibili-header">
      <div class="header-content">
        <!-- Logo区域 -->
        <div class="logo-section">
          <div class="logo-wrapper">
            <div class="bilibili-logo">
              <span class="logo-text">kuq</span>
              <span class="logo-text-sub">商城</span>
            </div>
          </div>
        </div>
        
        <!-- 导航菜单区域 -->
        <div class="nav-section">
          <el-menu
              :default-active="useRoute().path"
              mode="horizontal"
              router
              :ellipsis="false"
              @select="handleSelect"
              class="bilibili-menu"
          >
            <el-menu-item index="/index" class="nav-item">
              <el-icon><House /></el-icon>
              <span>首页</span>
            </el-menu-item>
            <el-menu-item index="/shoppingCart" class="nav-item">
              <el-icon><ShoppingCart /></el-icon>
              <span>购物车</span>
            </el-menu-item>
            <el-menu-item index="/productOrder" class="nav-item">
              <el-icon><List /></el-icon>
              <span>订单</span>
            </el-menu-item>

          </el-menu>
        </div>
        
        <!-- 用户区域 -->
        <div class="user-section">
          <!-- 主题切换：放在用户下拉前 -->
          <!-- 中文注释：点击按钮在“明亮/暗色”主题之间切换，使用图标指示当前状态 -->
<!--          <div class="theme-toggle">-->
<!--            <el-tooltip content="切换主题" placement="bottom">-->
<!--              <el-button class="theme-btn" circle @click="toggleTheme">-->
<!--                <el-icon v-if="isDark"><Moon /></el-icon>-->
<!--                <el-icon v-else><Sunny /></el-icon>-->
<!--              </el-button>-->
<!--            </el-tooltip>-->
<!--          </div>-->
          <el-dropdown v-if="isUserLogin" class="user-dropdown">
            <div class="user-info">
              <el-avatar 
                class="user-avatar" 
                :size="32" 
                :src="currentUser.avatarUrl"
              ></el-avatar>
              <span class="username">{{ currentUser.username }}</span>
              <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu class="user-dropdown-menu">
                <el-dropdown-item @click="goToPersonalCenter">
                  <el-icon><User /></el-icon>
                  <span>个人中心</span>
                </el-dropdown-item>
                <el-dropdown-item @click="editCurrentUser">
                  <el-icon><User /></el-icon>
                  <span>个人信息</span>
                </el-dropdown-item>
                <el-dropdown-item @click="editPassword">
                  <el-icon><Lock /></el-icon>
                  <span>修改密码</span>
                </el-dropdown-item>
                <el-dropdown-item @click="balanceInfo">
                  <el-icon><Wallet /></el-icon>
                  <span>余额充值</span>
                </el-dropdown-item>
                <el-dropdown-item divided @click="logout">
                  <el-icon><SwitchButton /></el-icon>
                  <span>退出登录</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </el-header>
    <el-main class="my-main">
      <router-view/>
    </el-main>
    <el-footer class="my-footer">
      <p>版权所有，翻版必究</p>
      <p>KUQ商城</p>
    </el-footer>
    
    <!-- 返回顶部组件 -->
    <BackToTop :visibility-height="300" :duration="500" :right="30" :bottom="50" />
  </el-container>
</template>

<script setup>
import tools from "@/utils/tools.js";
import {ref} from "vue";
import router from "@/router/index.js";
import {ElMessage} from "element-plus";
import {useRoute} from "vue-router";
import BackToTop from "@/components/BackToTop.vue";
import {
  House,
  ShoppingBag,
  ShoppingCart,
  List,
  User,
  ArrowDown,
  Lock,
  Wallet,
  SwitchButton,
  Sunny, // 中文注释：明亮主题图标
  Moon   // 中文注释：暗色主题图标
} from '@element-plus/icons-vue';
import theme from '@/utils/theme.js'

const isUserLogin = ref(tools.isLogin())
const currentUser = ref(tools.getCurrentUser())

if (currentUser.value === null) {
  window.location.href = "/login"
}
if (currentUser.value && currentUser.value.type !== 'USER') {
  router.push({path: "/admin"})
}

function handleSelect(key, keyPath) {
  console.log(key, keyPath);
}

function logout() {
  ElMessage({
    message: '退出登录成功，正在跳转',
    type: 'success'
  });
  localStorage.clear()
  router.push({path: "/login"})
}

function editCurrentUser() {
  router.push({path: "/editCurrentUser"})
}

function editPassword() {
  router.push({path: "/editPassword"})
}
function balanceInfo() {
  router.push({path: "/balanceInfo"})
}

function goToPersonalCenter() {
  router.push({path: "/personalCenter"})
}

// 主题状态（中文注释：根据主题管理器当前配置初始化，true 表示暗色模式）
const isDark = ref(theme.getConfig().mode === 'dark')

// 切换主题（中文注释：按钮点击后在暗色/明亮主题之间切换，并持久化到本地缓存）
function toggleTheme() {
  isDark.value = !isDark.value
  theme.setMode(isDark.value ? 'dark' : 'light')
}
</script>


<style scoped>
/* B站风格容器样式 */
.bilibili-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg-gradient);
}

/* B站风格头部样式 - 优化版 */
.bilibili-header {
  height: 64px;
  background: var(--header-gradient);
  backdrop-filter: blur(20px);
  box-shadow: var(--box-shadow-light), 0 1px 0 rgba(255, 255, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 1000;
  border-bottom: 1px solid var(--border-light);
  transition: all var(--transition-duration) var(--transition-timing);
  animation: slideDown 0.6s ease-out;
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.header-content {
  height: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
}

.header-content::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%);
  transform: translateX(-100%);
  animation: shimmer 3s infinite;
  pointer-events: none;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* Logo区域样式 */
.logo-section {
  flex-shrink: 0;
}

.logo-wrapper {
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: all var(--transition-duration) var(--transition-timing);
  position: relative;
  padding: 8px 12px;
  border-radius: var(--border-radius);
}

.logo-wrapper:hover {
  transform: scale(1.05);
  background: rgba(251, 114, 153, 0.05);
  box-shadow: 0 2px 8px rgba(251, 114, 153, 0.1);
}

.logo-wrapper::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%);
  transform: translateX(-100%);
  transition: transform 0.6s ease;
  border-radius: var(--border-radius);
}

.logo-wrapper:hover::before {
  transform: translateX(100%);
}

.bilibili-logo {
  display: flex;
  align-items: baseline;
  font-weight: bold;
}

.logo-text {
  font-size: 24px;
  color: var(--primary-color);
  font-weight: 700;
  letter-spacing: -0.5px;
}

.logo-text-sub {
  font-size: 16px;
  color: var(--secondary-color);
  font-weight: 600;
  margin-left: 2px;
}

/* 导航菜单样式 */
.nav-section {
  flex: 1;
  display: flex;
  justify-content: center;
  margin: 0 40px;
}

.bilibili-menu {
  border-bottom: none !important;
  background: transparent !important;
  position: relative;
  overflow: visible;
}

.bilibili-menu .el-menu-item {
  height: 48px;
  line-height: 48px;
  margin: 0 8px;
  border-radius: var(--border-radius) !important;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-regular);
  transition: all var(--transition-duration) var(--transition-timing);
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
}

.bilibili-menu .el-menu-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(251, 114, 153, 0.1), rgba(255, 157, 180, 0.1));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform var(--transition-duration) var(--transition-timing);
  border-radius: var(--border-radius);
}

.bilibili-menu .el-menu-item::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 2px;
  background: var(--primary-color);
  transform: translateX(-50%);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.bilibili-menu .el-menu-item:hover {
  background-color: var(--bg-hover) !important;
  color: var(--primary-color) !important;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.15);
}

.bilibili-menu .el-menu-item:hover::before {
  transform: scaleX(1);
}

.bilibili-menu .el-menu-item:hover::after {
  width: 80%;
}

.bilibili-menu .el-menu-item:active {
  transform: translateY(0) scale(0.98);
  transition: transform 0.1s ease;
}

.bilibili-menu .el-menu-item.is-active {
  background: var(--primary-gradient) !important;
  color: var(--text-light) !important;
  font-weight: 600;
  box-shadow: var(--primary-shadow);
  transform: translateY(-1px);
}

.bilibili-menu .el-menu-item.is-active::before {
  transform: scaleX(1);
  background: rgba(255, 255, 255, 0.1);
}

.bilibili-menu .el-menu-item.is-active::after {
  width: 100%;
  background: rgba(255, 255, 255, 0.8);
}

.nav-item .el-icon {
  font-size: 16px;
}

/* 用户区域样式 */
.user-section {
  flex-shrink: 0;
}

.user-dropdown {
  cursor: pointer;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--border-radius-large);
  transition: all var(--transition-duration) var(--transition-timing);
  background: var(--bg-color);
  border: 1px solid var(--border-light);
  position: relative;
  overflow: hidden;
}

.user-info::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(251, 114, 153, 0.05), rgba(255, 157, 180, 0.05));
  opacity: 0;
  transition: opacity var(--transition-duration) var(--transition-timing);
  border-radius: var(--border-radius-large);
}

.user-info:hover {
  background: var(--bg-hover);
  box-shadow: var(--box-shadow-light), 0 0 0 1px rgba(251, 114, 153, 0.1);
  transform: translateY(-2px);
  border-color: rgba(251, 114, 153, 0.2);
}

.user-info:hover::before {
  opacity: 1;
}

.user-avatar {
  border: 2px solid var(--primary-color);
  transition: all var(--transition-duration) var(--transition-timing);
  position: relative;
  overflow: hidden;
}

.user-avatar::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transform: rotate(45deg) translateX(-100%);
  transition: transform 0.6s ease;
}

.user-avatar::after {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, var(--primary-color), var(--primary-light), var(--primary-color));
  opacity: 0;
  transition: opacity var(--transition-duration) var(--transition-timing);
  z-index: -1;
}

.user-info:hover .user-avatar::before {
  transform: rotate(45deg) translateX(100%);
}

.user-info:hover .user-avatar::after {
  opacity: 1;
  animation: rotate 2s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.username {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-icon {
  font-size: 12px;
  color: var(--text-secondary);
  transition: all var(--transition-duration) var(--transition-timing);
  position: relative;
}

.dropdown-icon::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(251, 114, 153, 0.2);
  transform: translate(-50%, -50%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: -1;
}

.user-dropdown:hover .dropdown-icon {
  transform: rotate(180deg) scale(1.2);
  color: var(--primary-color);
}

.user-dropdown:hover .dropdown-icon::after {
  width: 20px;
  height: 20px;
}

/* 下拉菜单样式 - 优化版 */
.user-dropdown-menu {
  border-radius: var(--border-radius-large) !important;
  box-shadow: var(--box-shadow), 0 0 0 1px rgba(0, 0, 0, 0.05) !important;
  border: 1px solid var(--border-light) !important;
  padding: 8px 0;
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.95) !important;
}

.user-dropdown-menu .el-dropdown-item {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  transition: all var(--transition-duration) var(--transition-timing);
  position: relative;
  overflow: hidden;
}

.user-dropdown-menu .el-dropdown-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(251, 114, 153, 0.1), transparent);
  transform: translateX(-100%);
  transition: transform 0.4s ease;
}

.user-dropdown-menu .el-dropdown-item:hover {
  background: var(--primary-bg-light) !important;
  color: var(--primary-color) !important;
  transform: translateX(4px);
}

.user-dropdown-menu .el-dropdown-item:hover::before {
  transform: translateX(100%);
}

.user-dropdown-menu .el-dropdown-item .el-icon {
  transition: all var(--transition-duration) var(--transition-timing);
}

.user-dropdown-menu .el-dropdown-item:hover .el-icon {
  transform: scale(1.1);
  color: var(--primary-color);
}

/* 主内容区样式 */
.my-main {
  flex: 1;
  padding: 24px;
  background: var(--bg-gradient);
  transition: all var(--transition-duration) var(--transition-timing);
  min-height: calc(100vh - 64px - 80px);
  overflow: auto;
}

.my-main::-webkit-scrollbar {
  width: 6px;
}

.my-main::-webkit-scrollbar-track {
  background: var(--bg-lighter);
  border-radius: var(--border-radius-small);
}

.my-main::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: var(--border-radius-small);
  transition: background var(--transition-duration) var(--transition-timing);
}

.my-main::-webkit-scrollbar-thumb:hover {
  background: var(--primary-color);
}

/* 页面切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.4s var(--transition-timing);
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* 底部样式 */
.my-footer {
  font-size: 14px;
  padding: 0;
  color: var(--text-secondary);
  background: var(--bg-color);
  text-align: center;
  border-top: 1px solid var(--border-light);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
}

.my-footer p {
  margin: 6px 0;
  transition: color var(--transition-duration) var(--transition-timing);
}

.my-footer p:hover {
  color: var(--primary-color);
}

/* 响应式调整 - 优化版 */
@media (max-width: 1024px) {
  .header-content {
    padding: 0 16px;
  }
  
  .nav-section {
    margin: 0 20px;
  }
  
  .bilibili-menu .el-menu-item {
    margin: 0 6px;
    padding: 0 10px !important;
  }
  
  .logo-wrapper {
    padding: 6px 10px;
  }
}

@media (max-width: 768px) {
  .bilibili-header {
    height: 56px;
    backdrop-filter: blur(15px);
  }
  
  .header-content {
    padding: 0 12px;
  }
  
  .logo-text {
    font-size: 20px;
  }
  
  .logo-text-sub {
    font-size: 14px;
  }
  
  .nav-section {
    margin: 0 12px;
  }
  
  .bilibili-menu .el-menu-item {
    height: 40px;
    line-height: 40px;
    font-size: 13px;
    margin: 0 4px;
    padding: 0 8px !important;
    border-radius: var(--border-radius-large) !important;
  }
  
  .bilibili-menu .el-menu-item span {
    display: none;
  }
  
  .bilibili-menu .el-menu-item .el-icon {
    font-size: 18px;
  }
  
  .my-main {
    padding: 16px;
    min-height: calc(100vh - 56px - 80px);
  }
  
  .username {
    display: none;
  }
  
  .user-info {
    padding: 6px;
    border-radius: 50%;
  }
  
  .user-info:hover {
    border-radius: var(--border-radius-large);
    transition: border-radius 0.3s ease;
  }
  
  .logo-wrapper {
    padding: 6px 8px;
  }
}

@media (max-width: 480px) {
  .nav-section {
    margin: 0 8px;
  }
  
  .bilibili-menu .el-menu-item {
    margin: 0 2px;
    padding: 0 6px !important;
    height: 36px;
    line-height: 36px;
  }
  
  .bilibili-menu .el-menu-item .el-icon {
    font-size: 16px;
  }
  
  .logo-text {
    font-size: 18px;
  }
  
  .logo-text-sub {
    font-size: 12px;
  }
  
  .user-avatar {
    width: 28px !important;
    height: 28px !important;
  }
  
  .bilibili-header {
    height: 52px;
  }
  
  .my-main {
    min-height: calc(100vh - 52px - 80px);
  }
}
</style>


<style scoped>
.theme-toggle { /* 中文注释：导航栏右侧的主题切换容器，保证与用户信息有间距 */
  margin-right: 12px;
  display: inline-flex;
}
.theme-btn { /* 中文注释：圆形按钮风格与头部保持一致 */
  background: var(--bg-color);
  border: 1px solid var(--border-light);
  box-shadow: var(--box-shadow-light);
  color: var(--text-primary);
}
.theme-btn:hover {
  background: var(--bg-hover);
  color: var(--primary-color);
}
</style>

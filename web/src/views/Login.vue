<template>
  <div class="main-context">
    <!-- 背景装饰元素 -->
    <div class="background-decoration">
      <div class="decoration-circle circle-1"></div>
      <div class="decoration-circle circle-2"></div>
      <div class="decoration-circle circle-3"></div>
    </div>
    
    <!-- 登录卡片 -->
    <el-card class="box-card" shadow="always">
      <el-space direction="vertical" style="width: 100%" size="large">
        <!-- Logo区域 -->
        <div class="logo-section">
          <div class="logo-container">
            <img src="../assets/kuq.png" class="logo-image" alt="Logo">
            <div class="logo-text">
              <p class="brand-subtitle">欢迎登录</p>
            </div>
          </div>
        </div>
        
        <!-- 登录表单 -->
        <el-form 
          :model="formData" 
          label-width="0px" 
          ref="formRef"
          class="login-form"
          :disabled="loading"
        >
          <!-- 用户名输入 -->
          <el-form-item 
            label="" 
            prop="username"
            :rules="[{required:true,message:'请输入用户名',trigger:[ 'blur','change']}]"
            class="form-item"
          >
            <el-input
                :prefix-icon="User"
                placeholder="请输入账号"
                v-model.trim="formData.username"
                clearable
                size="large"
                class="form-input"
                :class="{ 'input-focus': usernameFocused }"
                @focus="usernameFocused = true"
                @blur="usernameFocused = false"
            >
            </el-input>
          </el-form-item>
          
          <!-- 密码输入 -->
          <el-form-item 
            label="" 
            prop="password"
            :rules="[{required:true,message:'请输入密码',trigger:[ 'blur','change']}]"
            class="form-item"
          >
            <el-input
                :prefix-icon="Lock"
                placeholder="请输入密码"
                show-password
                v-model.trim="formData.password"
                clearable
                size="large"
                class="form-input"
                :class="{ 'input-focus': passwordFocused }"
                @focus="passwordFocused = true"
                @blur="passwordFocused = false"
                @keyup.enter="submitForm"
            ></el-input>
          </el-form-item>
          
          <!-- 用户类型选择 -->
          <el-form-item label="" prop="type" class="form-item">
            <el-select 
              v-model="formData.type" 
              placeholder="请选择用户类型" 
              size="large"
              class="form-select"
            >
              <el-option label="管理员" value="ADMIN">
                <div class="option-item">
                  <el-icon><UserFilled /></el-icon>
                  <span>管理员</span>
                </div>
              </el-option>
              <el-option label="普通用户" value="USER">
                <div class="option-item">
                  <el-icon><User /></el-icon>
                  <span>普通用户</span>
                </div>
              </el-option>
              <el-option label="店铺" value="SHOP">
                <div class="option-item">
                  <el-icon><Shop /></el-icon>
                  <span>店铺</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
          
          <!-- 登录按钮和链接 -->
          <el-form-item label="" class="form-item">
            <el-space direction="vertical" alignment="left" style="width: 100%" size="medium">
              <el-button 
                @click="submitForm()" 
                type="primary" 
                size="large"
                class="login-button"
                :loading="loading"
                :disabled="!isFormValid"
              >
                <span v-if="!loading">登 录</span>
                <span v-else>登录中...</span>
              </el-button>
              
              <!-- 快捷链接 -->
              <div class="form-links">
                <router-link :to="{path:'register'}" class="link-item register-link">
                  <el-icon><UserFilled /></el-icon>
                  <span>没有账号？去注册</span>
                </router-link>
                <router-link :to="{path:'retrievePassword'}" class="link-item forgot-link">
                  <el-icon><Key /></el-icon>
                  <span>忘记密码？</span>
                </router-link>
              </div>
            </el-space>
          </el-form-item>
        </el-form>
      </el-space>
    </el-card>
  </div>
</template>
<script setup>
import {ref, computed, watch} from 'vue';
import {ElMessage} from 'element-plus';
import http from "@/utils/http.js";
import {User, Lock, UserFilled, Shop, Key} from "@element-plus/icons-vue";
import router from "@/router/index.js";

// 表单数据
const formData = ref({
  username: '',
  password: '',
  type: 'ADMIN'
});

// 交互状态
const loading = ref(false);
const usernameFocused = ref(false);
const passwordFocused = ref(false);
const formRef = ref(null);

// 表单验证状态
const isFormValid = computed(() => {
  return formData.value.username.trim() !== '' && 
         formData.value.password.trim() !== '' && 
         formData.value.type !== '';
});

// 提交表单
const submitForm = async () => {
  if (!formRef.value) return;
  
  try {
    const valid = await formRef.value.validate();
    if (!valid) return;
    
    loading.value = true;
    
    // 模拟网络延迟，增强用户体验
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const res = await http.post("/common/login", formData.value);
    
    if (!res) {
      loading.value = false;
      return;
    }
    
    ElMessage({
      message: "登录成功，正在跳转",
      type: "success",
      duration: 2000
    });
    
    localStorage.setItem("token", res.data);
    
    const res1 = await http.get("/common/currentUser");
    const currentUser = res1.data;
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    
    // 延迟跳转，让用户看到成功消息
    setTimeout(() => {
      if (currentUser.type === "USER") {
        router.push({path: "/"});
      } else {
        router.push({path: "/admin"});
      }
    }, 1000);
    
  } catch (error) {
    loading.value = false;
    ElMessage({
      message: "登录失败，请检查用户名和密码",
      type: "error",
      duration: 3000
    });
  }
};

// 监听表单数据变化，提供实时反馈
watch(formData, (newVal) => {
  // 可以在这里添加实时验证逻辑
}, { deep: true });
</script>
<style scoped>
/* 主容器样式 */
.main-context {
  height: 100vh;
  background: url("../assets/OIP.webp") no-repeat center center fixed;
  background-size: cover;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
}

/* 背景装饰元素 */
.background-decoration {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.decoration-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  animation: float 6s ease-in-out infinite;
}

.circle-1 {
  width: 100px;
  height: 100px;
  top: 10%;
  left: 10%;
  animation-delay: 0s;
}

.circle-2 {
  width: 150px;
  height: 150px;
  top: 60%;
  right: 15%;
  animation-delay: 2s;
}

.circle-3 {
  width: 80px;
  height: 80px;
  bottom: 20%;
  left: 20%;
  animation-delay: 4s;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
    opacity: 0.7;
  }
  50% {
    transform: translateY(-20px) rotate(180deg);
    opacity: 1;
  }
}

/* 登录卡片样式 */
.box-card {
  width: 400px;
  margin: 0 auto;
  text-align: center;
  position: relative;
  z-index: 2;
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  animation: slideInUp 0.8s ease-out;
}

.box-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Logo区域样式 */
.logo-section {
  margin-bottom: 20px;
}

.logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  padding: 10px 0;
}

.logo-image {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.logo-image:hover {
  transform: scale(1.1) rotate(5deg);
}

.logo-text {
  text-align: left;
}

.brand-name {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-subtitle {
  margin: 5px 0 0 0;
  font-size: 14px;
  color: #666;
  font-weight: 400;
}

/* 表单样式 */
.login-form {
  padding: 0 20px;
}

.form-item {
  margin-bottom: 20px;
}

/* 输入框样式 */
.form-input {
  transition: all 0.3s ease;
  border-radius: 12px;
}

.form-input :deep(.el-input__wrapper) {
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.form-input:hover :deep(.el-input__wrapper) {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.form-input.input-focus :deep(.el-input__wrapper),
.form-input :deep(.el-input__wrapper.is-focus) {
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.1);
  transform: translateY(-2px);
}

/* 选择框样式 */
.form-select {
  width: 100%;
}

.form-select :deep(.el-select__wrapper) {
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.form-select:hover :deep(.el-select__wrapper) {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.form-select :deep(.el-select__wrapper.is-focused) {
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.1);
  transform: translateY(-2px);
}

/* 选项样式 */
.option-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 登录按钮样式 */
.login-button {
  width: 100%;
  height: 50px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.login-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.login-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

.login-button:hover::before {
  left: 100%;
}

.login-button:active {
  transform: translateY(0);
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 链接区域样式 */
.form-links {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 15px;
  padding: 0 5px;
}

.link-item {
  display: flex;
  align-items: center;
  gap: 4px;
  text-decoration: none;
  color: #666;
  font-size: 14px;
  transition: all 0.3s ease;
  padding: 5px 8px;
  border-radius: 6px;
}

.link-item:hover {
  color: #409eff;
  background-color: rgba(64, 158, 255, 0.1);
  transform: translateY(-1px);
}

.register-link {
  color: #67c23a;
}

.register-link:hover {
  color: #67c23a;
  background-color: rgba(103, 194, 58, 0.1);
}

.forgot-link {
  color: #e6a23c;
}

.forgot-link:hover {
  color: #e6a23c;
  background-color: rgba(230, 162, 60, 0.1);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .box-card {
    width: 90%;
    max-width: 350px;
    margin: 20px;
  }
  
  .logo-container {
    flex-direction: column;
    gap: 10px;
  }
  
  .logo-text {
    text-align: center;
  }
  
  .form-links {
    flex-direction: column;
    gap: 10px;
  }
}

/* 加载状态动画 */
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 表单验证错误状态 */
.form-item :deep(.el-form-item__error) {
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}
</style>

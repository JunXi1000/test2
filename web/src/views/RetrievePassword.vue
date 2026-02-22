<template>
  <div class="main-context">
    <!-- 背景装饰元素 -->
    <div class="background-decoration">
      <div class="decoration-circle circle-1"></div>
      <div class="decoration-circle circle-2"></div>
      <div class="decoration-circle circle-3"></div>
    </div>
    
    <el-card class="box-card">
      <!-- Logo区域 -->
      <div class="logo-section">
        <div class="logo-container">
          <img src="../assets/kuq.png" alt="Logo" class="logo-image">
          <div class="logo-text">
            <h2 class="brand-name">找回密码</h2>
            <p class="brand-subtitle">重置您的账户密码</p>
          </div>
        </div>
      </div>
      
      <!-- 找回密码表单 -->
      <el-form 
        :model="formData" 
        label-width="80px" 
        :rules="rules" 
        ref="formRef" 
        class="retrieve-form"
        style="width: 100%"
      >
        <el-form-item label="用户类型" prop="type" class="form-item">
          <el-select 
            v-model="formData.type" 
            placeholder="请选择用户类型"
            size="large"
            class="form-select"
            :class="{ 'input-focus': focusedField === 'type' }"
            @focus="focusedField = 'type'"
            @blur="focusedField = ''"
          >
            <el-option label="管理员" value="ADMIN">
              <div class="option-item">
                <el-icon><UserFilled /></el-icon>
                <span>管理员</span>
              </div>
            </el-option>
            <el-option label="用户" value="USER">
              <div class="option-item">
                <el-icon><User /></el-icon>
                <span>用户</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        
        <el-form-item 
          label="手机号" 
          prop="tel"
          class="form-item"
          :rules="[{required:true,message:'请输入手机号',trigger:[ 'blur','change']}]"
        >
          <el-input
            placeholder="请输入手机号"
            v-model.trim="formData.tel"
            size="large"
            class="form-input"
            :class="{ 'input-focus': focusedField === 'tel' }"
            @focus="focusedField = 'tel'"
            @blur="focusedField = ''"
            clearable
          >
            <template #prefix>
              <el-icon><Phone /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item 
          label="验证码" 
          prop="code"
          class="form-item"
          :rules="[{required:true,message:'请输入验证码',trigger:[ 'blur','change']}]"
        >
          <div class="code-input-group">
            <el-input
              placeholder="请输入验证码"
              v-model.trim="formData.code"
              size="large"
              class="form-input code-input"
              :class="{ 'input-focus': focusedField === 'code' }"
              @focus="focusedField = 'code'"
              @blur="focusedField = ''"
              clearable
            >
              <template #prefix>
                <el-icon><Message /></el-icon>
              </template>
            </el-input>
            <el-button 
              type="primary" 
              size="large"
              class="send-code-btn"
              :disabled="!formData.tel || codeCountdown > 0"
              @click="sendCode"
            >
              {{ codeCountdown > 0 ? `${codeCountdown}s后重发` : '发送验证码' }}
            </el-button>
          </div>
        </el-form-item>
        
        <el-form-item 
          label="新密码" 
          prop="password"
          class="form-item"
          :rules="[{required:true,message:'请输入密码',trigger:[ 'blur','change']}]"
        >
          <el-input
            placeholder="请输入新密码"
            show-password
            v-model.trim="formData.password"
            size="large"
            class="form-input"
            :class="{ 'input-focus': focusedField === 'password' }"
            @focus="focusedField = 'password'"
            @blur="focusedField = ''"
            clearable
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item label="" class="form-item" style="width: 100%">
          <el-space direction="vertical" alignment="left" style="width: 100%">
            <el-button 
              @click="submitForm()" 
              type="primary" 
              size="large"
              class="reset-button"
              :loading="loading"
              :disabled="!isFormValid"
            >
              <span v-if="!loading">重置密码</span>
              <span v-else>重置中...</span>
            </el-button>
            
            <div class="form-links">
              <router-link :to="{path:'login'}" class="link-item back-link">
                <el-icon><ArrowLeft /></el-icon>
                <span>返回登录</span>
              </router-link>
            </div>
          </el-space>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
<script setup>
import {ref, computed} from 'vue';
import {ElMessage} from 'element-plus';
import {User, Lock, Phone, Message, ArrowLeft, UserFilled} from '@element-plus/icons-vue';
import http from "@/utils/http.js";
import router from "@/router/index.js";

// 表单引用和数据
const formRef = ref(null);
const formData = ref({
  type: 'USER',
  tel: '',
  code: '',
  password: ''
});

// 交互状态
const loading = ref(false);
const focusedField = ref('');
const codeCountdown = ref(0);
let countdownTimer = null;

// 表单验证状态
const isFormValid = computed(() => {
  return formData.value.type && 
         formData.value.tel.trim() !== '' && 
         formData.value.code.trim() !== '' && 
         formData.value.password.trim() !== '';
});

// 发送验证码
const sendCode = async () => {
  if (!formData.value.tel) {
    ElMessage({
      message: '请先输入手机号',
      type: 'warning'
    });
    return;
  }
  
  try {
    // 这里应该调用发送验证码的API
    // await http.post('/common/sendCode', { tel: formData.value.tel, type: formData.value.type });
    
    ElMessage({
      message: '验证码已发送，请查收',
      type: 'success'
    });
    
    // 开始倒计时
    codeCountdown.value = 60;
    countdownTimer = setInterval(() => {
      codeCountdown.value--;
      if (codeCountdown.value <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }, 1000);
    
  } catch (error) {
    ElMessage({
      message: '验证码发送失败，请重试',
      type: 'error'
    });
  }
};

// 提交表单
const submitForm = async () => {
  if (!formRef.value) return;
  
  try {
    const valid = await formRef.value.validate();
    if (!valid) return;
    
    loading.value = true;
    
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const res = await http.post("/common/retrievePassword", formData.value);
    
    if (!res) {
      loading.value = false;
      return;
    }
    
    ElMessage({
      message: "密码重置成功，正在跳转到登录页",
      type: "success",
      duration: 2000
    });
    
    // 延迟跳转
    setTimeout(() => {
      router.push({path: "/login"});
    }, 1500);
    
  } catch (error) {
    loading.value = false;
    ElMessage({
      message: "重置失败，请检查信息是否正确",
      type: "error",
      duration: 3000
    });
  }
};

// 组件卸载时清理定时器
import { onUnmounted } from 'vue';
onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
});

</script>

<style scoped>
/* 主容器样式 */
.main-context {
  height: 100vh;
  background: url("../assets/kuq.png.png") no-repeat center center fixed;
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
  width: 120px;
  height: 120px;
  top: 15%;
  left: 15%;
  animation-delay: 0s;
}

.circle-2 {
  width: 180px;
  height: 180px;
  top: 55%;
  right: 10%;
  animation-delay: 2s;
}

.circle-3 {
  width: 90px;
  height: 90px;
  bottom: 25%;
  left: 25%;
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

/* 找回密码卡片样式 */
.box-card {
  width: 450px;
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
  padding: 20px 0;
  border-bottom: 1px solid rgba(230, 162, 60, 0.2);
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
  box-shadow: 0 4px 12px rgba(230, 162, 60, 0.3);
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
  background: linear-gradient(135deg, #e6a23c 0%, #f56c6c 100%);
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
.retrieve-form {
  padding: 0 20px;
}

.form-item {
  margin-bottom: 20px;
  text-align: left;
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
  border-color: #e6a23c;
  box-shadow: 0 0 0 3px rgba(230, 162, 60, 0.1);
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

.form-select.input-focus :deep(.el-select__wrapper),
.form-select :deep(.el-select__wrapper.is-focused) {
  border-color: #e6a23c;
  box-shadow: 0 0 0 3px rgba(230, 162, 60, 0.1);
  transform: translateY(-2px);
}

/* 选项样式 */
.option-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 验证码输入组合 */
.code-input-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.code-input {
  flex: 1;
}

.send-code-btn {
  flex-shrink: 0;
  width: 120px;
  border-radius: 12px;
  background: linear-gradient(135deg, #e6a23c 0%, #f56c6c 100%);
  border: none;
  transition: all 0.3s ease;
  font-weight: 600;
}

.send-code-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(230, 162, 60, 0.4);
}

.send-code-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 重置密码按钮样式 */
.reset-button {
  width: 100%;
  height: 50px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #e6a23c 0%, #f56c6c 100%);
  border: none;
  box-shadow: 0 4px 15px rgba(230, 162, 60, 0.4);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.reset-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.reset-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(230, 162, 60, 0.6);
}

.reset-button:hover::before {
  left: 100%;
}

.reset-button:active {
  transform: translateY(0);
}

.reset-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 链接区域样式 */
.form-links {
  text-align: center;
  margin-top: 15px;
}

.link-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  text-decoration: none;
  color: #666;
  font-size: 14px;
  transition: all 0.3s ease;
  padding: 8px 12px;
  border-radius: 8px;
}

.link-item:hover {
  color: #e6a23c;
  background-color: rgba(230, 162, 60, 0.1);
  transform: translateY(-1px);
}

.back-link {
  color: #909399;
}

.back-link:hover {
  color: #e6a23c;
  background-color: rgba(230, 162, 60, 0.1);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .box-card {
    width: 90%;
    max-width: 400px;
    margin: 20px;
  }
  
  .logo-container {
    flex-direction: column;
    gap: 10px;
  }
  
  .logo-text {
    text-align: center;
  }
  
  .code-input-group {
    flex-direction: column;
    gap: 10px;
  }
  
  .send-code-btn {
    width: 100%;
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

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .box-card {
    background: rgba(30, 30, 30, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .brand-subtitle {
    color: #a8abb2;
  }
  
  .link-item {
    color: #a8abb2;
  }
}
</style>

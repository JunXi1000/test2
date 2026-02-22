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
            <h2 class="brand-name">KUQ</h2>
            <p class="brand-subtitle">用户注册</p>
          </div>
        </div>
      </div>
      
      <!-- 注册表单 -->
      <el-form 
        :model="formData" 
        :rules="rules" 
        ref="formRef" 
        label-width="80px"
        class="register-form"
        style="width: 100%"
      >
        <el-form-item 
          label="头像" 
          prop="avatarUrl"
          class="form-item"
          style="width: 100%"
          :rules="[{required:true,message:'请选择头像',trigger:[ 'blur','change']}]"
        >
          <MyUpLoad 
            type="imageCard" 
            :limit="1" 
            :files="formData.avatarUrl"
            @setFiles="formData.avatarUrl =$event"
            class="upload-component"
          >
          </MyUpLoad>
        </el-form-item>
        
        <el-form-item 
          label="用户类型" 
          prop="type"
          class="form-item"
          :rules="[{required:true,message:'请选择类型',trigger:[ 'blur','change']}]"
        >
          <el-select 
            v-model="formData.type" 
            placeholder="请选择用户类型" 
            class="form-select"
            size="large"
            :class="{ 'input-focus': focusedField === 'type' }"
            @focus="focusedField = 'type'"
            @blur="focusedField = ''"
          >
            <el-option label="用户" value="USER">
              <div class="option-item">
                <el-icon><UserFilled /></el-icon>
                <span>用户</span>
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

        <el-form-item 
          label="用户名" 
          prop="username"
          class="form-item"
          :rules="[{required:true,message:'请输入用户名',trigger:[ 'blur','change']}]"
        >
          <el-input
            placeholder="请输入用户名"
            v-model.trim="formData.username"
            size="large"
            class="form-input"
            :class="{ 'input-focus': focusedField === 'username' }"
            @focus="focusedField = 'username'"
            @blur="focusedField = ''"
            clearable
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item 
          label="密码" 
          prop="password"
          class="form-item"
          :rules="[{required:true,message:'请输入密码',trigger:[ 'blur','change']}]"
        >
          <el-input
            placeholder="请输入密码"
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

        <transition name="slide-fade">
          <el-form-item 
            label="店铺名称" 
            prop="name"
            class="form-item"
            style="width: 100%"
            v-if="formData.type === 'SHOP'"
            :rules="[{required:true,message:' 请输入店铺名称 ',trigger:[ 'blur','change']}]"
          >
            <el-input
              placeholder="请输入店铺名称"
              v-model.trim="formData.name"
              size="large"
              class="form-input"
              :class="{ 'input-focus': focusedField === 'name' }"
              @focus="focusedField = 'name'"
              @blur="focusedField = ''"
              clearable
            >
              <template #prefix>
                <el-icon><Shop /></el-icon>
              </template>
            </el-input>
          </el-form-item>
        </transition>
        
        <transition name="slide-fade">
          <el-form-item 
            label="店铺资质" 
            prop="aptitudeImgs"
            class="form-item"
            style="width: 100%"
            v-if="formData.type === 'SHOP'"
            :rules="[{required:true,message:' 请上传店铺资质 ',trigger:[ 'blur','change']}]"
          >
            <MyUpLoad 
              type="imageCard" 
              :limit="5" 
              :files="formData.aptitudeImgs"
              @setFiles="formData.aptitudeImgs = $event"
              class="upload-component"
            >
            </MyUpLoad>
          </el-form-item>
        </transition>

        <el-form-item 
          label="昵称" 
          prop="nickname"
          class="form-item"
          :rules="[{required:true,message:'请输入昵称',trigger:[ 'blur','change']}]"
        >
          <el-input
            placeholder="请输入昵称"
            v-model.trim="formData.nickname"
            size="large"
            class="form-input"
            :class="{ 'input-focus': focusedField === 'nickname' }"
            @focus="focusedField = 'nickname'"
            @blur="focusedField = ''"
            clearable
          >
            <template #prefix>
              <el-icon><Avatar /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item label="" class="form-item" style="width: 100%">
          <el-space direction="vertical" alignment="left" style="width: 100%">
            <el-button 
              @click="submitForm()" 
              type="primary" 
              class="register-button"
              :loading="loading"
              :disabled="!isFormValid"
            >
              <span v-if="!loading">立即注册</span>
              <span v-else>注册中...</span>
            </el-button>
            <div class="form-links">
              <router-link :to="{path:'login'}" class="link-item login-link">
                <el-icon><Key /></el-icon>
                <span>已有账号？去登录</span>
              </router-link>
            </div>
          </el-space>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
<script setup>
import {ref, computed, watch} from 'vue';
import {ElMessage} from 'element-plus';
import {User, Lock, Shop, Avatar, Key, UserFilled} from '@element-plus/icons-vue';
import http from "@/utils/http.js";
import MyUpLoad from "@/components/MyUpload.vue";
import router from "@/router/index.js";

const formRef = ref(null);
const loading = ref(false);
const focusedField = ref('');

const formData = ref({
  type: 'USER',
  username: '',
  nickname: '',
  avatarUrl: '',
  password: ''
});

const rules = ref({
  username: [
    {required: true, message: '请输入用户名称', trigger: 'blur'},
  ],
  password: [
    {required: true, message: '请输入密码', trigger: 'blur'},
  ],
});

// 表单验证状态
const isFormValid = computed(() => {
  return formData.value.username && 
         formData.value.password && 
         formData.value.nickname && 
         formData.value.avatarUrl &&
         (formData.value.type !== 'SHOP' || (formData.value.name && formData.value.aptitudeImgs));
});

// 监听用户类型变化，清空相关字段
watch(() => formData.value.type, (newType) => {
  if (newType !== 'SHOP') {
    formData.value.name = '';
    formData.value.aptitudeImgs = '';
  }
});

const submitForm = () => {
  loading.value = true;
  formRef.value.validate((valid) => {
    if (!valid) {
      loading.value = false;
      return
    }
    http.put("/common/register", formData.value).then(res => {
      if (!res) {
        loading.value = false;
        return
      }
      ElMessage({
        message: "注册成功，正在跳转",
        type: "success"
      });
      setTimeout(() => {
        router.push({path: "/login"})
      }, 1500);
    }).catch(() => {
      loading.value = false;
    });
  });
}

</script>

<style scoped>
.main-context {
  height: 100vh;
  background: url("../assets/login.png") no-repeat center center fixed;
  background-size: cover;
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  position: relative;
  overflow: hidden;
}

/* 背景装饰 */
.background-decoration {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

.decoration-circle {
  position: absolute;
  border-radius: 50%;
  background: linear-gradient(45deg, rgba(64, 158, 255, 0.1), rgba(64, 158, 255, 0.05));
  animation: float 6s ease-in-out infinite;
}

.circle-1 {
  width: 200px;
  height: 200px;
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
  width: 100px;
  height: 100px;
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

.box-card {
  width: 400px;
  max-height: 800px;
  margin: 0 auto;
  text-align: center;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  z-index: 1;
  overflow: auto;
  transition: all 0.3s ease;
}

.box-card::-webkit-scrollbar {
  width: 0;  /* 将滚动条宽度设为0，实现隐藏效果 */
}

.box-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
}

/* Logo区域 */
.logo-section {
  padding: 20px 0;
  border-bottom: 1px solid rgba(64, 158, 255, 0.1);
  margin-bottom: 20px;
}

.logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
}

.logo-image {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
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
  background: linear-gradient(135deg, #409eff, #67c23a);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-subtitle {
  margin: 5px 0 0 0;
  font-size: 14px;
  color: #909399;
  font-weight: 400;
}

/* 表单样式 */
.register-form {
  padding: 0 20px;
}

.form-item {
  margin-bottom: 20px;
  text-align: left;
}

.form-input {
  width: 100%;
  transition: all 0.3s ease;
  border-radius: 12px;
}

.form-input.input-focus {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(64, 158, 255, 0.15);
}

.form-select {
  width: 100%;
  transition: all 0.3s ease;
}

.form-select.input-focus {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(64, 158, 255, 0.15);
}

.option-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.upload-component {
  width: 100%;
  transition: all 0.3s ease;
}

.upload-component:hover {
  transform: translateY(-2px);
}

/* 按钮样式 */
.register-button {
  width: 100%;
  height: 50px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  background: linear-gradient(135deg, #409eff, #67c23a);
  border: none;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.register-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(64, 158, 255, 0.3);
}

.register-button:active {
  transform: translateY(0);
}

.register-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 链接样式 */
.form-links {
  text-align: center;
  margin-top: 15px;
}

.link-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #409eff;
  text-decoration: none;
  font-size: 14px;
  transition: all 0.3s ease;
  padding: 8px 12px;
  border-radius: 8px;
}

.link-item:hover {
  color: #67c23a;
  background: rgba(64, 158, 255, 0.1);
  transform: translateY(-1px);
}

/* 动画效果 */
.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  transform: translateX(-20px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .box-card {
    width: 90%;
    margin: 20px;
  }
  
  .logo-container {
    flex-direction: column;
    gap: 10px;
  }
  
  .logo-text {
    text-align: center;
  }
  
  .brand-name {
    font-size: 24px;
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
}
</style>

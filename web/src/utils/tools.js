import router from "../router/index.js"
import { ElMessage } from "element-plus";
import http from "@/utils/http.js";

const tools = {
  // 用户认证相关
  isLogin() {
    return localStorage.getItem("currentUser") !== null;
  },
  getCurrentUser() {
    return JSON.parse(localStorage.getItem("currentUser"));
  },
  getToken() {
    return localStorage.getItem("token");
  },
  setUserInfo(userInfo) {
    localStorage.setItem("currentUser", JSON.stringify(userInfo));
  },
  clearUserInfo() {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("token");
  },

  // 日期格式化
  formatDateToYYYYMMDD(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  },

  // 表单验证规则
  rules: {
    required: (message = '该字段不能为空') => ({
      required: true,
      message,
      trigger: ['blur', 'change']
    }),
    email: {
      type: 'email',
      message: '请输入正确的邮箱地址',
      trigger: ['blur', 'change']
    },
    phone: {
      pattern: /^1[3-9]\d{9}$/,
      message: '请输入正确的手机号码',
      trigger: ['blur', 'change']
    },
    password: {
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/,
      message: '密码必须包含大小写字母和数字，且长度不少于8位',
      trigger: ['blur', 'change']
    },
    url: {
      type: 'url',
      message: '请输入正确的URL地址',
      trigger: ['blur', 'change']
    }
  },

  // 防抖函数
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // 节流函数
  throttle(func, limit = 300) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  // 金额格式化
  formatPrice(price) {
    if (!price) return '0.00';
    return Number(price).toFixed(2);
  },

  // 文件大小格式化
  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  },

  // 深拷贝
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    const copy = Array.isArray(obj) ? [] : {};
    Object.keys(obj).forEach(key => {
      copy[key] = this.deepClone(obj[key]);
    });
    return copy;
  },

  // 随机字符串生成
  randomString(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // 检查权限
  hasPermission(permission) {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return false;
    // 这里可以根据实际需求实现权限检查逻辑
    return true;
  },

  // 错误提示
  showError(message) {
    ElMessage({
      message,
      type: 'error',
      duration: 3000,
      showClose: true
    });
  },

  // 成功提示
  showSuccess(message) {
    ElMessage({
      message,
      type: 'success',
      duration: 3000
    });
  },

  // 确认提示
  confirm(message, title = '提示') {
    return ElMessageBox.confirm(message, title, {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
  }
};

export default tools;

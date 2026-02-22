import axios from "axios";
import router from "../router";
import { ElMessage, ElLoading } from "element-plus";

// 设置 Axios 的默认基础 URL
axios.defaults.baseURL = import.meta.env.VITE_APP_API_URL;

// 创建 Axios 实例
const http = axios.create({
  timeout: 15000,  // 增加超时时间到15秒
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求计数器
let requestCount = 0;
let loadingInstance = null;

// 显示加载动画
const showLoading = () => {
  if (requestCount === 0) {
    loadingInstance = ElLoading.service({
      text: '加载中...',
      background: 'rgba(0, 0, 0, 0.7)',
      spinner: 'el-icon-loading'
    });
  }
  requestCount++;
};

// 隐藏加载动画
const hideLoading = () => {
  requestCount--;
  if (requestCount === 0 && loadingInstance) {
    loadingInstance.close();
    loadingInstance = null;
  }
};

// 请求重试配置
const retryDelay = 1000; // 重试延迟时间（毫秒）
const maxRetries = 2;    // 最大重试次数

// 请求拦截器
http.interceptors.request.use(
  config => {
    // 显示加载动画
    if (!config.hideLoading) {
      showLoading();
    }

    // 添加token
    const token = localStorage.getItem("token");
    if (token) {
      config.headers["token"] = token;
    }

    // 添加时间戳防止缓存
    if (config.method === 'get') {
      config.params = { ...config.params, _t: Date.now() };
    }

    return config;
  },
  error => {
    hideLoading();
    ElMessage.error('请求配置错误');
    return Promise.reject(error);
  }
);

// 响应拦截器
http.interceptors.response.use(
  response => {
    hideLoading();
    // 处理业务状态码
    const res = response.data;
    if (res.code && res.code !== 200) {
      ElMessage({
        message: res.msg || '操作失败',
        type: 'error',
        duration: 3000
      });
      return Promise.reject(res);
    }
    return res;
  },
  async error => {
    hideLoading();

    // 处理请求重试
    const config = error.config;
    if (!config || !config.retryCount) {
      config.retryCount = 0;
    }

    if (config.retryCount < maxRetries) {
      config.retryCount++;
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return http(config);
    }

    // 错误处理
    let errorMessage = '请求失败';
    if (error.response) {
      switch (error.response.status) {
        case 401:
          errorMessage = '请先登录';
          localStorage.removeItem("token");
          router.push("/login");
          break;
        case 403:
          errorMessage = '没有权限';
          break;
        case 404:
          errorMessage = '请求的资源不存在';
          break;
        case 408:
          errorMessage = '请求超时';
          break;
        case 409:
          errorMessage = error.response.data.data || '数据冲突';
          break;
        case 500:
          errorMessage = '服务器内部错误';
          break;
        case 502:
          errorMessage = '网关错误';
          break;
        case 503:
          errorMessage = '服务不可用';
          break;
        case 504:
          errorMessage = '网关超时';
          break;
        default:
          errorMessage = `未知错误 (${error.response.status})`;
      }
    } else if (error.request) {
      errorMessage = '网络异常，请检查网络连接';
    } else {
      errorMessage = error.message;
    }

    ElMessage({
      message: errorMessage,
      type: 'error',
      duration: 5000,
      showClose: true
    });

    return Promise.reject(error);
  }
);

// 开发环境打印环境变量
if (import.meta.env.DEV) {
  console.log("环境:", import.meta.env.MODE);
  console.log("API地址:", import.meta.env.VITE_APP_API_URL);
}

export default http;


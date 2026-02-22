import axios from 'axios';
import message from './message';
import tools from './tools';
import router from '../router';

// 创建axios实例
const request = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求队列和加载计数器
let loadingInstance = null;
let requestCount = 0;

// 显示全局加载
const showLoading = () => {
  if (requestCount === 0) {
    loadingInstance = message.loading();
  }
  requestCount++;
};

// 隐藏全局加载
const hideLoading = () => {
  requestCount--;
  if (requestCount === 0 && loadingInstance) {
    loadingInstance.close();
    loadingInstance = null;
  }
};

// 请求重试配置
const retryConfig = {
  retryCount: 2,
  retryDelay: 1000,
  currentRetry: 0
};

// 请求拦截器
request.interceptors.request.use(
  config => {
    // 添加token
    const token = tools.getToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // 添加时间戳防止缓存
    if (config.method === 'get') {
      config.params = { ...config.params, _t: Date.now() };
    }

    // 显示加载动画
    if (!config.hideLoading) {
      showLoading();
    }

    return config;
  },
  error => {
    hideLoading();
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  response => {
    hideLoading();
    const res = response.data;

    // 处理业务状态码
    if (res.code !== 200) {
      // 处理特定错误码
      switch (res.code) {
        case 401: // 未授权
          tools.clearUserInfo();
          router.push('/login');
          message.error('登录已过期，请重新登录');
          break;
        case 403: // 权限不足
          message.error('权限不足');
          break;
        case 404: // 资源不存在
          message.error('请求的资源不存在');
          break;
        case 500: // 服务器错误
          message.error('服务器错误，请稍后重试');
          break;
        default:
          message.error(res.message || '操作失败');
      }
      return Promise.reject(res);
    }

    return res;
  },
  error => {
    hideLoading();

    // 处理请求超时
    if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
      // 超时重试
      if (retryConfig.currentRetry < retryConfig.retryCount) {
        retryConfig.currentRetry++;
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(request(error.config));
          }, retryConfig.retryDelay);
        });
      }
      message.error('请求超时，请检查网络连接');
      return Promise.reject(error);
    }

    // 处理网络错误
    if (!error.response) {
      message.error('网络连接失败，请检查网络');
      return Promise.reject(error);
    }

    // 处理HTTP状态码
    switch (error.response.status) {
      case 401:
        tools.clearUserInfo();
        router.push('/login');
        message.error('登录已过期，请重新登录');
        break;
      case 403:
        message.error('权限不足');
        break;
      case 404:
        message.error('请求的资源不存在');
        break;
      case 408:
        message.error('请求超时，请稍后重试');
        break;
      case 500:
        message.error('服务器错误，请稍后重试');
        break;
      case 502:
        message.error('网关错误');
        break;
      case 503:
        message.error('服务不可用');
        break;
      case 504:
        message.error('网关超时');
        break;
      default:
        message.error('操作失败，请稍后重试');
    }

    return Promise.reject(error);
  }
);

// 请求方法封装
const http = {
  get(url, params, config = {}) {
    return request({
      method: 'get',
      url,
      params,
      ...config
    });
  },

  post(url, data, config = {}) {
    return request({
      method: 'post',
      url,
      data,
      ...config
    });
  },

  put(url, data, config = {}) {
    return request({
      method: 'put',
      url,
      data,
      ...config
    });
  },

  delete(url, data, config = {}) {
    return request({
      method: 'delete',
      url,
      data,
      ...config
    });
  },

  // 上传文件
  upload(url, file, config = {}) {
    const formData = new FormData();
    formData.append('file', file);

    return request({
      method: 'post',
      url,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      ...config
    });
  },

  // 下载文件
  download(url, params, config = {}) {
    return request({
      method: 'get',
      url,
      params,
      responseType: 'blob',
      ...config
    });
  }
};

export default http;
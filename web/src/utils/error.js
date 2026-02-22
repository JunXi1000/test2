import logger from './logger';

// 错误处理工具类
const error = {
  // 错误类型
  types: {
    NETWORK: 'NETWORK_ERROR',
    API: 'API_ERROR',
    VALIDATION: 'VALIDATION_ERROR',
    AUTH: 'AUTH_ERROR',
    BUSINESS: 'BUSINESS_ERROR',
    SYSTEM: 'SYSTEM_ERROR'
  },

  // 错误处理器
  handlers: {
    // 网络错误处理
    [error.types.NETWORK](error) {
      logger.error('Network Error:', error);
      return {
        type: error.types.NETWORK,
        message: '网络连接异常，请检查网络设置',
        details: error.message
      };
    },

    // API错误处理
    [error.types.API](error) {
      logger.error('API Error:', error);
      const status = error.response?.status;
      let message = '服务请求失败';

      switch (status) {
        case 400:
          message = '请求参数错误';
          break;
        case 401:
          message = '用户未授权';
          break;
        case 403:
          message = '访问被禁止';
          break;
        case 404:
          message = '请求资源不存在';
          break;
        case 500:
          message = '服务器内部错误';
          break;
        default:
          message = `请求失败 (${status})`;
      }

      return {
        type: error.types.API,
        message,
        status,
        details: error.response?.data
      };
    },

    // 表单验证错误处理
    [error.types.VALIDATION](error) {
      logger.error('Validation Error:', error);
      return {
        type: error.types.VALIDATION,
        message: '输入数据验证失败',
        fields: error.fields || {},
        details: error.message
      };
    },

    // 认证错误处理
    [error.types.AUTH](error) {
      logger.error('Auth Error:', error);
      return {
        type: error.types.AUTH,
        message: '用户认证失败',
        details: error.message
      };
    },

    // 业务错误处理
    [error.types.BUSINESS](error) {
      logger.error('Business Error:', error);
      return {
        type: error.types.BUSINESS,
        message: error.message || '业务处理失败',
        code: error.code,
        details: error.details
      };
    },

    // 系统错误处理
    [error.types.SYSTEM](error) {
      logger.error('System Error:', error);
      return {
        type: error.types.SYSTEM,
        message: '系统内部错误',
        details: error.message
      };
    }
  },

  // 错误处理方法
  handle(error, type = error.types.SYSTEM) {
    const handler = this.handlers[type];
    if (handler) {
      return handler(error);
    }
    return this.handlers[error.types.SYSTEM](error);
  },

  // 创建自定义错误
  create(message, type = error.types.BUSINESS, details = {}) {
    return {
      type,
      message,
      ...details,
      timestamp: new Date().toISOString()
    };
  },

  // 错误重试机制
  retry(fn, options = {}) {
    const {
      maxAttempts = 3,
      delay = 1000,
      backoff = 2,
      onRetry = null
    } = options;

    return new Promise((resolve, reject) => {
      let attempts = 0;

      const attempt = async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          attempts++;

          if (onRetry) {
            onRetry(error, attempts);
          }

          if (attempts < maxAttempts) {
            const nextDelay = delay * Math.pow(backoff, attempts - 1);
            setTimeout(attempt, nextDelay);
          } else {
            reject(error);
          }
        }
      };

      attempt();
    });
  },

  // 错误边界处理
  boundary: {
    // 包装组件错误处理
    wrap(component) {
      return {
        ...component,
        errorCaptured(err, vm, info) {
          logger.error('Component Error:', {
            error: err,
            component: vm.$options.name,
            info
          });
          return false; // 阻止错误继续传播
        }
      };
    },

    // 全局错误处理
    setup() {
      // 未捕获的Promise错误
      window.addEventListener('unhandledrejection', (event) => {
        logger.error('Unhandled Promise Rejection:', event.reason);
        event.preventDefault();
      });

      // 未捕获的JS错误
      window.addEventListener('error', (event) => {
        logger.error('Uncaught Error:', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
        event.preventDefault();
      });
    }
  },

  // 错误恢复机制
  recovery: {
    // 保存应用状态
    saveState(key, state) {
      try {
        localStorage.setItem(
          `error_recovery_${key}`,
          JSON.stringify({
            state,
            timestamp: Date.now()
          })
        );
      } catch (error) {
        logger.error('Save recovery state failed:', error);
      }
    },

    // 恢复应用状态
    restoreState(key, maxAge = 3600000) { // 默认1小时过期
      try {
        const saved = localStorage.getItem(`error_recovery_${key}`);
        if (!saved) return null;

        const { state, timestamp } = JSON.parse(saved);
        const age = Date.now() - timestamp;

        if (age > maxAge) {
          localStorage.removeItem(`error_recovery_${key}`);
          return null;
        }

        return state;
      } catch (error) {
        logger.error('Restore recovery state failed:', error);
        return null;
      }
    },

    // 清理恢复状态
    clearState(key) {
      localStorage.removeItem(`error_recovery_${key}`);
    }
  }
};

export default error;
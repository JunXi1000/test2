import message from './message';
import bus, { Events } from './eventBus';

// 日志级别
const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

// 日志配置
const config = {
  // 是否开启日志
  enabled: true,
  // 最低日志级别
  level: LogLevel.DEBUG,
  // 是否显示时间戳
  showTimestamp: true,
  // 是否显示日志级别
  showLevel: true,
  // 是否在控制台输出
  console: true,
  // 是否发送到服务器
  remote: false,
  // 日志服务器地址
  remoteUrl: ''
};

// 获取当前时间戳
const getTimestamp = () => {
  const now = new Date();
  return now.toISOString();
};

// 格式化日志信息
const formatLog = (level, message, data) => {
  const parts = [];

  if (config.showTimestamp) {
    parts.push(`[${getTimestamp()}]`);
  }

  if (config.showLevel) {
    parts.push(`[${level.toUpperCase()}]`);
  }

  parts.push(message);

  if (data !== undefined) {
    if (data instanceof Error) {
      parts.push('\n', data.stack || data.message);
    } else if (typeof data === 'object') {
      try {
        parts.push('\n', JSON.stringify(data, null, 2));
      } catch (e) {
        parts.push('\n', data.toString());
      }
    } else {
      parts.push('\n', String(data));
    }
  }

  return parts.join(' ');
};

// 发送日志到服务器
const sendToServer = async (level, message, data) => {
  if (!config.remoteUrl) return;

  try {
    await fetch(config.remoteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        level,
        message,
        data,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      })
    });
  } catch (error) {
    console.error('Failed to send log to server:', error);
  }
};

// 错误处理
const handleError = (error, source = '') => {
  // 记录错误日志
  logger.error(error);

  // 显示错误提示
  if (error.response) {
    // API错误
    const status = error.response.status;
    const message = error.response.data?.message || '请求失败';
    bus.emit(Events.API_ERROR, { status, message, error });
  } else if (error.request) {
    // 网络错误
    bus.emit(Events.NETWORK_ERROR, error);
    message.error('网络连接失败，请检查网络设置');
  } else {
    // 其他错误
    bus.emit(Events.SYSTEM_ERROR, error);
    message.error('系统错误，请稍后重试');
  }

  // 如果是开发环境，在控制台输出详细错误信息
  if (process.env.NODE_ENV === 'development') {
    console.group(`Error in ${source}`);
    console.error(error);
    if (error.response) {
      console.log('Response:', error.response);
    }
    console.groupEnd();
  }
};

// 全局错误处理
const setupGlobalErrorHandler = () => {
  // 处理未捕获的Promise错误
  window.addEventListener('unhandledrejection', (event) => {
    handleError(event.reason, 'Unhandled Promise Rejection');
  });

  // 处理未捕获的JS错误
  window.addEventListener('error', (event) => {
    handleError(event.error, 'Uncaught Error');
  });
};

// 日志记录器
const logger = {
  // 配置日志
  config(options) {
    Object.assign(config, options);
  },

  // 调试日志
  debug(message, data) {
    if (!config.enabled || config.level !== LogLevel.DEBUG) return;

    const formattedMessage = formatLog(LogLevel.DEBUG, message, data);

    if (config.console) {
      console.debug(formattedMessage);
    }

    if (config.remote) {
      sendToServer(LogLevel.DEBUG, message, data);
    }
  },

  // 信息日志
  info(message, data) {
    if (!config.enabled) return;

    const formattedMessage = formatLog(LogLevel.INFO, message, data);

    if (config.console) {
      console.info(formattedMessage);
    }

    if (config.remote) {
      sendToServer(LogLevel.INFO, message, data);
    }
  },

  // 警告日志
  warn(message, data) {
    if (!config.enabled) return;

    const formattedMessage = formatLog(LogLevel.WARN, message, data);

    if (config.console) {
      console.warn(formattedMessage);
    }

    if (config.remote) {
      sendToServer(LogLevel.WARN, message, data);
    }
  },

  // 错误日志
  error(message, data) {
    if (!config.enabled) return;

    const formattedMessage = formatLog(LogLevel.ERROR, message, data);

    if (config.console) {
      console.error(formattedMessage);
    }

    if (config.remote) {
      sendToServer(LogLevel.ERROR, message, data);
    }
  },

  // 处理错误
  handleError,

  // 设置全局错误处理
  setupGlobalErrorHandler
};

export { logger as default, LogLevel };
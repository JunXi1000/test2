import { ElMessage, ElMessageBox, ElNotification } from 'element-plus';

// 消息提示工具类
const message = {
  // 成功提示
  success(message, duration = 3000) {
    ElMessage({
      type: 'success',
      message,
      duration,
      showClose: true
    });
  },

  // 错误提示
  error(message, duration = 3000) {
    ElMessage({
      type: 'error',
      message,
      duration,
      showClose: true
    });
  },

  // 警告提示
  warning(message, duration = 3000) {
    ElMessage({
      type: 'warning',
      message,
      duration,
      showClose: true
    });
  },

  // 信息提示
  info(message, duration = 3000) {
    ElMessage({
      type: 'info',
      message,
      duration,
      showClose: true
    });
  },

  // 确认对话框
  confirm(message, title = '提示', options = {}) {
    return ElMessageBox.confirm(
      message,
      title,
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        ...options
      }
    );
  },

  // 提示对话框
  alert(message, title = '提示', options = {}) {
    return ElMessageBox.alert(
      message,
      title,
      {
        confirmButtonText: '确定',
        type: 'info',
        ...options
      }
    );
  },

  // 输入对话框
  prompt(message, title = '提示', options = {}) {
    return ElMessageBox.prompt(
      message,
      title,
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: options.pattern,
        inputErrorMessage: options.errorMessage || '输入格式不正确',
        ...options
      }
    );
  },

  // 通知提示
  notify: {
    // 成功通知
    success(title, message, duration = 4500) {
      ElNotification({
        title,
        message,
        type: 'success',
        duration,
        position: 'top-right'
      });
    },

    // 错误通知
    error(title, message, duration = 4500) {
      ElNotification({
        title,
        message,
        type: 'error',
        duration,
        position: 'top-right'
      });
    },

    // 警告通知
    warning(title, message, duration = 4500) {
      ElNotification({
        title,
        message,
        type: 'warning',
        duration,
        position: 'top-right'
      });
    },

    // 信息通知
    info(title, message, duration = 4500) {
      ElNotification({
        title,
        message,
        type: 'info',
        duration,
        position: 'top-right'
      });
    }
  },

  // 加载中提示
  loading(message = '加载中...') {
    const loading = ElLoading.service({
      lock: true,
      text: message,
      background: 'rgba(0, 0, 0, 0.7)'
    });
    return loading;
  }
};

export default message;
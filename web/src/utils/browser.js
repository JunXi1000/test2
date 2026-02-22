import logger from './logger';

// 浏览器工具类
const browser = {
  // 获取浏览器信息
  info: {
    // 获取浏览器名称和版本
    get browser() {
      const ua = navigator.userAgent;
      let browser = 'unknown';
      let version = 'unknown';

      // Chrome
      if (/Chrome\/([\d.]+)/.test(ua)) {
        browser = 'Chrome';
        version = RegExp.$1;
      }
      // Firefox
      else if (/Firefox\/([\d.]+)/.test(ua)) {
        browser = 'Firefox';
        version = RegExp.$1;
      }
      // Safari
      else if (/Safari\/([\d.]+)/.test(ua)) {
        browser = 'Safari';
        version = RegExp.$1;
      }
      // Edge
      else if (/Edg\/([\d.]+)/.test(ua)) {
        browser = 'Edge';
        version = RegExp.$1;
      }
      // IE
      else if (/MSIE ([\d.]+)/.test(ua)) {
        browser = 'IE';
        version = RegExp.$1;
      }

      return { name: browser, version };
    },

    // 获取操作系统信息
    get os() {
      const ua = navigator.userAgent;
      let os = 'unknown';
      let version = 'unknown';

      // Windows
      if (/Windows NT ([\d.]+)/.test(ua)) {
        os = 'Windows';
        version = RegExp.$1;
      }
      // macOS
      else if (/Mac OS X ([\d._]+)/.test(ua)) {
        os = 'macOS';
        version = RegExp.$1.replace(/_/g, '.');
      }
      // iOS
      else if (/iPhone OS ([\d._]+)/.test(ua)) {
        os = 'iOS';
        version = RegExp.$1.replace(/_/g, '.');
      }
      // Android
      else if (/Android ([\d.]+)/.test(ua)) {
        os = 'Android';
        version = RegExp.$1;
      }
      // Linux
      else if (/Linux/.test(ua)) {
        os = 'Linux';
      }

      return { name: os, version };
    },

    // 获取设备类型
    get device() {
      const ua = navigator.userAgent;
      
      if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) {
        return 'mobile';
      }
      if (/Tablet|iPad/i.test(ua)) {
        return 'tablet';
      }
      return 'desktop';
    },

    // 获取屏幕信息
    get screen() {
      return {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        colorDepth: window.screen.colorDepth,
        orientation: window.screen.orientation?.type || 'unknown'
      };
    },

    // 获取网络状态
    get network() {
      return {
        online: navigator.onLine,
        type: navigator.connection?.type || 'unknown',
        effectiveType: navigator.connection?.effectiveType || 'unknown'
      };
    }
  },

  // 剪贴板操作
  clipboard: {
    // 复制文本到剪贴板
    async copy(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        logger.error('Copy to clipboard failed:', error);
        return false;
      }
    },

    // 从剪贴板读取文本
    async paste() {
      try {
        return await navigator.clipboard.readText();
      } catch (error) {
        logger.error('Paste from clipboard failed:', error);
        return '';
      }
    }
  },

  // 全屏操作
  fullscreen: {
    // 进入全屏
    enter(element = document.documentElement) {
      try {
        if (element.requestFullscreen) {
          element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
          element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
          element.msRequestFullscreen();
        }
      } catch (error) {
        logger.error('Enter fullscreen failed:', error);
      }
    },

    // 退出全屏
    exit() {
      try {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      } catch (error) {
        logger.error('Exit fullscreen failed:', error);
      }
    },

    // 是否处于全屏状态
    get isFullscreen() {
      return !!(document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement);
    }
  },

  // 浏览器存储检测
  storage: {
    // 检查 localStorage 是否可用
    get isLocalStorageAvailable() {
      try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
      } catch (error) {
        return false;
      }
    },

    // 检查 sessionStorage 是否可用
    get isSessionStorageAvailable() {
      try {
        const test = '__storage_test__';
        sessionStorage.setItem(test, test);
        sessionStorage.removeItem(test);
        return true;
      } catch (error) {
        return false;
      }
    },

    // 获取存储空间使用情况
    async getUsage() {
      try {
        if (navigator.storage && navigator.storage.estimate) {
          const { usage, quota } = await navigator.storage.estimate();
          return {
            usage: Math.round(usage / 1024 / 1024), // MB
            quota: Math.round(quota / 1024 / 1024), // MB
            percentage: Math.round((usage / quota) * 100)
          };
        }
        return null;
      } catch (error) {
        logger.error('Get storage usage failed:', error);
        return null;
      }
    }
  },

  // 浏览器功能检测
  support: {
    // WebGL 支持
    get webgl() {
      try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && 
          (canvas.getContext('webgl') || 
           canvas.getContext('experimental-webgl')));
      } catch (error) {
        return false;
      }
    },

    // WebRTC 支持
    get webrtc() {
      return !!(navigator.mediaDevices && 
        navigator.mediaDevices.getUserMedia);
    },

    // Web Workers 支持
    get webworker() {
      return !!window.Worker;
    },

    // Service Workers 支持
    get serviceworker() {
      return 'serviceWorker' in navigator;
    },

    // WebSocket 支持
    get websocket() {
      return 'WebSocket' in window;
    },

    // 触摸屏支持
    get touch() {
      return 'ontouchstart' in window || 
        navigator.maxTouchPoints > 0;
    }
  },

  // 页面可见性
  visibility: {
    // 获取页面可见性状态
    get state() {
      return document.visibilityState;
    },

    // 监听页面可见性变化
    onChange(callback) {
      document.addEventListener('visibilitychange', () => {
        callback(document.visibilityState);
      });
    }
  },

  // 电池状态
  battery: {
    // 获取电池信息
    async getStatus() {
      try {
        if ('getBattery' in navigator) {
          const battery = await navigator.getBattery();
          return {
            charging: battery.charging,
            level: battery.level * 100,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime
          };
        }
        return null;
      } catch (error) {
        logger.error('Get battery status failed:', error);
        return null;
      }
    },

    // 监听电池状态变化
    async onChange(callback) {
      try {
        if ('getBattery' in navigator) {
          const battery = await navigator.getBattery();
          ['chargingchange', 'levelchange', 'chargingtimechange', 'dischargingtimechange']
            .forEach(event => {
              battery.addEventListener(event, () => {
                callback({
                  charging: battery.charging,
                  level: battery.level * 100,
                  chargingTime: battery.chargingTime,
                  dischargingTime: battery.dischargingTime
                });
              });
            });
        }
      } catch (error) {
        logger.error('Battery status monitoring failed:', error);
      }
    }
  }
};

export default browser;
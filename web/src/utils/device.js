import logger from './logger';

// 设备检测工具类
const device = {
  // 设备类型检测
  type: {
    // 是否为移动设备
    isMobile() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    // 是否为平板设备
    isTablet() {
      return /(iPad|Android(?!.*Mobile)|Tablet)/i.test(navigator.userAgent);
    },

    // 是否为桌面设备
    isDesktop() {
      return !this.isMobile() && !this.isTablet();
    },

    // 是否为iOS设备
    isIOS() {
      return /iPad|iPhone|iPod/.test(navigator.userAgent);
    },

    // 是否为Android设备
    isAndroid() {
      return /Android/.test(navigator.userAgent);
    },

    // 是否为微信环境
    isWechat() {
      return /MicroMessenger/i.test(navigator.userAgent);
    },

    // 是否为支付宝环境
    isAlipay() {
      return /AlipayClient/i.test(navigator.userAgent);
    }
  },

  // 浏览器检测
  browser: {
    // 获取浏览器信息
    info() {
      const ua = navigator.userAgent;
      let browserName = 'unknown';
      let browserVersion = 'unknown';

      // Chrome
      if (/Chrome\/([\d.]+)/.test(ua)) {
        browserName = 'Chrome';
        browserVersion = RegExp.$1;
      }
      // Firefox
      else if (/Firefox\/([\d.]+)/.test(ua)) {
        browserName = 'Firefox';
        browserVersion = RegExp.$1;
      }
      // Safari
      else if (/Safari\/([\d.]+)/.test(ua)) {
        browserName = 'Safari';
        browserVersion = RegExp.$1;
      }
      // Edge
      else if (/Edg\/([\d.]+)/.test(ua)) {
        browserName = 'Edge';
        browserVersion = RegExp.$1;
      }
      // IE
      else if (/MSIE ([\d.]+)/.test(ua)) {
        browserName = 'IE';
        browserVersion = RegExp.$1;
      }

      return { name: browserName, version: browserVersion };
    },

    // 是否支持特定CSS属性
    supportsCss(property, value) {
      const element = document.createElement('div');
      const prefixes = ['', '-webkit-', '-moz-', '-ms-', '-o-'];

      for (let prefix of prefixes) {
        const prefixedProperty = prefix + property;
        element.style[prefixedProperty] = value;
        if (element.style[prefixedProperty]) {
          return true;
        }
      }

      return false;
    },

    // 是否支持WebGL
    supportsWebGL() {
      try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && 
          (canvas.getContext('webgl') || 
           canvas.getContext('experimental-webgl')));
      } catch (e) {
        return false;
      }
    },

    // 是否支持触摸事件
    supportsTouch() {
      return 'ontouchstart' in window || 
        navigator.maxTouchPoints > 0;
    }
  },

  // 屏幕检测
  screen: {
    // 获取屏幕信息
    info() {
      return {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        colorDepth: window.screen.colorDepth,
        orientation: window.screen.orientation?.type || 'unknown',
        pixelRatio: window.devicePixelRatio || 1
      };
    },

    // 是否为视网膜屏幕
    isRetina() {
      return window.devicePixelRatio >= 2;
    },

    // 是否为横屏
    isLandscape() {
      return window.screen.orientation?.type.includes('landscape') || 
        window.innerWidth > window.innerHeight;
    },

    // 是否为竖屏
    isPortrait() {
      return window.screen.orientation?.type.includes('portrait') || 
        window.innerWidth <= window.innerHeight;
    }
  },

  // 网络检测
  network: {
    // 获取网络信息
    info() {
      const connection = navigator.connection || 
        navigator.mozConnection || 
        navigator.webkitConnection;

      if (!connection) {
        return {
          online: navigator.onLine,
          type: 'unknown',
          effectiveType: 'unknown',
          downlink: 'unknown',
          rtt: 'unknown'
        };
      }

      return {
        online: navigator.onLine,
        type: connection.type || 'unknown',
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 'unknown',
        rtt: connection.rtt || 'unknown'
      };
    },

    // 监听网络状态变化
    onChange(callback) {
      window.addEventListener('online', () => {
        callback({ online: true });
      });

      window.addEventListener('offline', () => {
        callback({ online: false });
      });

      const connection = navigator.connection || 
        navigator.mozConnection || 
        navigator.webkitConnection;

      if (connection) {
        connection.addEventListener('change', () => {
          callback(this.info());
        });
      }
    }
  },

  // 硬件检测
  hardware: {
    // 获取CPU核心数
    getCPUCores() {
      return navigator.hardwareConcurrency || 'unknown';
    },

    // 获取内存信息
    async getMemoryInfo() {
      try {
        if (performance.memory) {
          return {
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
          };
        }
        return 'unknown';
      } catch (error) {
        logger.error('Get memory info failed:', error);
        return 'unknown';
      }
    },

    // 获取电池信息
    async getBatteryInfo() {
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
        return 'unknown';
      } catch (error) {
        logger.error('Get battery info failed:', error);
        return 'unknown';
      }
    }
  },

  // 功能检测
  feature: {
    // 检查是否支持特定API
    supports(feature) {
      try {
        switch (feature.toLowerCase()) {
          case 'geolocation':
            return 'geolocation' in navigator;
          case 'notifications':
            return 'Notification' in window;
          case 'push':
            return 'PushManager' in window;
          case 'bluetooth':
            return 'bluetooth' in navigator;
          case 'vibration':
            return 'vibrate' in navigator;
          case 'share':
            return 'share' in navigator;
          case 'clipboard':
            return 'clipboard' in navigator;
          case 'payment':
            return 'PaymentRequest' in window;
          case 'credentials':
            return 'credentials' in navigator;
          case 'storage':
            return 'storage' in navigator;
          default:
            return false;
        }
      } catch (error) {
        logger.error(`Feature detection failed for ${feature}:`, error);
        return false;
      }
    },

    // 检查是否支持PWA
    supportsPWA() {
      return [
        'serviceWorker' in navigator,
        'PushManager' in window,
        window.isSecureContext,
        'BeforeInstallPromptEvent' in window
      ].every(Boolean);
    },

    // 检查是否支持WebAssembly
    supportsWebAssembly() {
      try {
        return typeof WebAssembly === 'object' && 
          typeof WebAssembly.instantiate === 'function';
      } catch {
        return false;
      }
    }
  }
};

export default device;
import logger from './logger';
import bus, { Events } from './eventBus';

// 性能监控工具类
const performance = {
  // 性能指标
  metrics: {
    // 获取页面加载性能指标
    getPageLoadMetrics() {
      try {
        const timing = window.performance.timing;
        const navigationStart = timing.navigationStart;

        return {
          // DNS解析时间
          dnsTime: timing.domainLookupEnd - timing.domainLookupStart,
          // TCP连接时间
          tcpTime: timing.connectEnd - timing.connectStart,
          // 首字节时间
          ttfb: timing.responseStart - timing.navigationStart,
          // DOM解析时间
          domParseTime: timing.domComplete - timing.domInteractive,
          // DOM加载完成时间
          domReadyTime: timing.domContentLoadedEventEnd - navigationStart,
          // 页面完全加载时间
          loadTime: timing.loadEventEnd - navigationStart,
          // 白屏时间
          blankTime: timing.domInteractive - navigationStart,
          // 资源加载时间
          resourceTime: timing.loadEventEnd - timing.domContentLoadedEventEnd
        };
      } catch (error) {
        logger.error('Get page load metrics failed:', error);
        return null;
      }
    },

    // 获取资源加载性能指标
    getResourceMetrics() {
      try {
        const resources = window.performance.getEntriesByType('resource');
        return resources.map(resource => ({
          name: resource.name,
          type: resource.initiatorType,
          duration: resource.duration,
          size: resource.transferSize,
          startTime: resource.startTime
        }));
      } catch (error) {
        logger.error('Get resource metrics failed:', error);
        return [];
      }
    },

    // 获取首次渲染性能指标
    getFCPMetrics() {
      return new Promise(resolve => {
        try {
          const observer = new PerformanceObserver(list => {
            const entries = list.getEntries();
            const firstEntry = entries[0];
            observer.disconnect();
            resolve({
              fcp: firstEntry.startTime,
              fcpElement: firstEntry.element
            });
          });
          observer.observe({ entryTypes: ['element'] });
        } catch (error) {
          logger.error('Get FCP metrics failed:', error);
          resolve(null);
        }
      });
    },

    // 获取最大内容渲染时间
    getLCPMetrics() {
      return new Promise(resolve => {
        try {
          const observer = new PerformanceObserver(list => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            observer.disconnect();
            resolve({
              lcp: lastEntry.startTime,
              lcpElement: lastEntry.element
            });
          });
          observer.observe({ entryTypes: ['largest-contentful-paint'] });
        } catch (error) {
          logger.error('Get LCP metrics failed:', error);
          resolve(null);
        }
      });
    },

    // 获取首次输入延迟
    getFIDMetrics() {
      return new Promise(resolve => {
        try {
          const observer = new PerformanceObserver(list => {
            const entries = list.getEntries();
            const firstEntry = entries[0];
            observer.disconnect();
            resolve({
              fid: firstEntry.processingStart - firstEntry.startTime,
              fidElement: firstEntry.target
            });
          });
          observer.observe({ entryTypes: ['first-input'] });
        } catch (error) {
          logger.error('Get FID metrics failed:', error);
          resolve(null);
        }
      });
    }
  },

  // 性能优化
  optimization: {
    // 图片懒加载
    setupLazyLoading(selector = 'img[data-src]') {
      try {
        const observer = new IntersectionObserver(
          (entries, observer) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
              }
            });
          },
          { rootMargin: '50px 0px' }
        );

        document.querySelectorAll(selector).forEach(img => {
          observer.observe(img);
        });
      } catch (error) {
        logger.error('Setup lazy loading failed:', error);
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
          setTimeout(() => {
            inThrottle = false;
          }, limit);
        }
      };
    },

    // 资源预加载
    preloadResources(resources) {
      try {
        resources.forEach(resource => {
          if (resource.type === 'image') {
            const img = new Image();
            img.src = resource.url;
          } else if (resource.type === 'script') {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'script';
            link.href = resource.url;
            document.head.appendChild(link);
          } else if (resource.type === 'style') {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'style';
            link.href = resource.url;
            document.head.appendChild(link);
          }
        });
      } catch (error) {
        logger.error('Preload resources failed:', error);
      }
    }
  },

  // 性能监控
  monitoring: {
    // 监控页面性能
    async monitorPagePerformance() {
      try {
        // 基本性能指标
        const basicMetrics = this.metrics.getPageLoadMetrics();

        // 资源加载性能
        const resourceMetrics = this.metrics.getResourceMetrics();

        // 首次内容绘制
        const fcpMetrics = await this.metrics.getFCPMetrics();

        // 最大内容绘制
        const lcpMetrics = await this.metrics.getLCPMetrics();

        // 首次输入延迟
        const fidMetrics = await this.metrics.getFIDMetrics();

        // 发送性能数据
        bus.emit(Events.PERFORMANCE_METRICS, {
          basic: basicMetrics,
          resources: resourceMetrics,
          fcp: fcpMetrics,
          lcp: lcpMetrics,
          fid: fidMetrics,
          timestamp: Date.now()
        });
      } catch (error) {
        logger.error('Monitor page performance failed:', error);
      }
    },

    // 监控内存使用
    monitorMemoryUsage() {
      try {
        if (window.performance && window.performance.memory) {
          const memory = window.performance.memory;
          return {
            totalJSHeapSize: memory.totalJSHeapSize,
            usedJSHeapSize: memory.usedJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit
          };
        }
        return null;
      } catch (error) {
        logger.error('Monitor memory usage failed:', error);
        return null;
      }
    },

    // 监控长任务
    monitorLongTasks() {
      try {
        const observer = new PerformanceObserver(list => {
          list.getEntries().forEach(entry => {
            if (entry.duration > 50) { // 超过50ms的任务视为长任务
              bus.emit(Events.LONG_TASK_DETECTED, {
                duration: entry.duration,
                startTime: entry.startTime,
                name: entry.name
              });
            }
          });
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        logger.error('Monitor long tasks failed:', error);
      }
    }
  }
};

export default performance;
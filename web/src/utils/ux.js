import logger from './logger';
import device from './device';

// 用户体验优化工具类
const ux = {
  // 页面加载优化
  loading: {
    // 预加载资源
    preload(resources = []) {
      try {
        resources.forEach(resource => {
          if (typeof resource !== 'string') return;

          if (resource.endsWith('.js')) {
            const script = document.createElement('link');
            script.rel = 'preload';
            script.as = 'script';
            script.href = resource;
            document.head.appendChild(script);
          } else if (resource.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            const img = new Image();
            img.src = resource;
          } else if (resource.match(/\.(css)$/i)) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'style';
            link.href = resource;
            document.head.appendChild(link);
          }
        });
      } catch (error) {
        logger.error('Preload resources failed:', error);
      }
    },

    // 延迟加载组件
    lazyLoad(callback, options = {}) {
      const {
        threshold = 0.5,
        rootMargin = '0px'
      } = options;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              callback(entry.target);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold, rootMargin }
      );

      return {
        observe: (element) => observer.observe(element),
        unobserve: (element) => observer.unobserve(element),
        disconnect: () => observer.disconnect()
      };
    }
  },

  // 表单优化
  form: {
    // 自动保存表单数据
    autoSave(formElement, options = {}) {
      const {
        storageKey = 'form_autosave',
        debounceTime = 1000,
        exclude = []
      } = options;

      let timeout;

      const saveFormData = () => {
        const formData = {};
        const elements = formElement.elements;

        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          if (
            !exclude.includes(element.name) &&
            element.name &&
            !element.disabled
          ) {
            if (element.type === 'checkbox' || element.type === 'radio') {
              formData[element.name] = element.checked;
            } else {
              formData[element.name] = element.value;
            }
          }
        }

        localStorage.setItem(storageKey, JSON.stringify(formData));
      };

      const restoreFormData = () => {
        try {
          const savedData = JSON.parse(localStorage.getItem(storageKey));
          if (!savedData) return;

          Object.keys(savedData).forEach(key => {
            const element = formElement.elements[key];
            if (element && !exclude.includes(key)) {
              if (element.type === 'checkbox' || element.type === 'radio') {
                element.checked = savedData[key];
              } else {
                element.value = savedData[key];
              }
            }
          });
        } catch (error) {
          logger.error('Restore form data failed:', error);
        }
      };

      const handleInput = () => {
        clearTimeout(timeout);
        timeout = setTimeout(saveFormData, debounceTime);
      };

      formElement.addEventListener('input', handleInput);
      restoreFormData();

      return {
        save: saveFormData,
        restore: restoreFormData,
        clear: () => localStorage.removeItem(storageKey),
        destroy: () => {
          formElement.removeEventListener('input', handleInput);
          clearTimeout(timeout);
        }
      };
    },

    // 表单验证反馈
    validationFeedback(element, options = {}) {
      const {
        successClass = 'is-valid',
        errorClass = 'is-invalid',
        parentSelector = '.form-group',
        feedbackSelector = '.feedback'
      } = options;

      const showFeedback = (isValid, message = '') => {
        const parent = element.closest(parentSelector);
        if (!parent) return;

        const feedback = parent.querySelector(feedbackSelector);

        element.classList.remove(successClass, errorClass);
        element.classList.add(isValid ? successClass : errorClass);

        if (feedback) {
          feedback.textContent = message;
          feedback.style.color = isValid ? 'green' : 'red';
        }
      };

      return {
        success: (message) => showFeedback(true, message),
        error: (message) => showFeedback(false, message),
        clear: () => {
          element.classList.remove(successClass, errorClass);
          const parent = element.closest(parentSelector);
          if (parent) {
            const feedback = parent.querySelector(feedbackSelector);
            if (feedback) {
              feedback.textContent = '';
            }
          }
        }
      };
    }
  },

  // 响应式优化
  responsive: {
    // 添加响应式图片支持
    image(element, sources = [], options = {}) {
      const {
        sizes = '100vw',
        lazy = true
      } = options;

      if (!element || !sources.length) return;

      // 创建picture元素
      const picture = document.createElement('picture');

      // 添加不同尺寸的源
      sources.forEach(source => {
        if (source.srcset) {
          const sourceElement = document.createElement('source');
          sourceElement.srcset = source.srcset;
          if (source.media) sourceElement.media = source.media;
          if (source.type) sourceElement.type = source.type;
          picture.appendChild(sourceElement);
        }
      });

      // 设置img元素
      const img = document.createElement('img');
      img.src = sources[sources.length - 1].srcset; // 降级图片
      img.sizes = sizes;
      if (lazy) img.loading = 'lazy';

      picture.appendChild(img);
      element.appendChild(picture);

      return img;
    },

    // 添加响应式字体支持
    font(element, options = {}) {
      const {
        minSize = 14,
        maxSize = 24,
        minWidth = 320,
        maxWidth = 1200
      } = options;

      const calculateSize = () => {
        const width = window.innerWidth;
        if (width <= minWidth) return minSize;
        if (width >= maxWidth) return maxSize;

        const ratio = (width - minWidth) / (maxWidth - minWidth);
        return minSize + (maxSize - minSize) * ratio;
      };

      const updateFontSize = () => {
        element.style.fontSize = `${calculateSize()}px`;
      };

      window.addEventListener('resize', updateFontSize);
      updateFontSize();

      return () => {
        window.removeEventListener('resize', updateFontSize);
      };
    }
  },

  // 性能优化
  performance: {
    // 防抖函数
    debounce(func, wait = 300) {
      let timeout;
      return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    },

    // 节流函数
    throttle(func, wait = 300) {
      let timeout;
      let previous = 0;

      return function (...args) {
        const now = Date.now();
        const remaining = wait - (now - previous);

        if (remaining <= 0) {
          clearTimeout(timeout);
          previous = now;
          func.apply(this, args);
        } else {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            previous = Date.now();
            func.apply(this, args);
          }, remaining);
        }
      };
    },

    // 资源加载监控
    monitor() {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'resource') {
              logger.info('Resource loaded:', {
                name: entry.name,
                type: entry.initiatorType,
                duration: entry.duration,
                size: entry.transferSize
              });
            }
          });
        });

        observer.observe({ entryTypes: ['resource'] });

        return () => observer.disconnect();
      } catch (error) {
        logger.error('Performance monitoring failed:', error);
        return () => {};
      }
    }
  },

  // 辅助功能优化
  accessibility: {
    // 添加键盘导航支持
    keyboard(element, handlers = {}) {
      const handleKeyDown = (e) => {
        const { key, ctrlKey, shiftKey } = e;
        const handler = handlers[key];

        if (handler) {
          handler(e, { ctrlKey, shiftKey });
        }
      };

      element.addEventListener('keydown', handleKeyDown);

      return () => {
        element.removeEventListener('keydown', handleKeyDown);
      };
    },

    // 添加焦点管理
    focus(element, options = {}) {
      const {
        focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        trapFocus = true
      } = options;

      const focusableElements = element.querySelectorAll(focusableSelector);
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      const handleKeyDown = (e) => {
        if (!trapFocus || e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      };

      element.addEventListener('keydown', handleKeyDown);

      return {
        focus: () => firstFocusable?.focus(),
        destroy: () => element.removeEventListener('keydown', handleKeyDown)
      };
    }
  }
};

export default ux;
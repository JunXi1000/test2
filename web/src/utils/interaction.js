import message from './message';
import animation from './animation';
import logger from './logger';
import bus, { Events } from './eventBus';

// 用户交互工具类
const interaction = {
  // 表单交互
  form: {
    // 防抖提交
    debounceSubmit(callback, wait = 1000) {
      let timeout;
      return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => callback.apply(this, args), wait);
      };
    },

    // 节流提交
    throttleSubmit(callback, limit = 1000) {
      let waiting = false;
      return function (...args) {
        if (!waiting) {
          callback.apply(this, args);
          waiting = true;
          setTimeout(() => {
            waiting = false;
          }, limit);
        }
      };
    },

    // 表单验证反馈
    showValidationFeedback(element, isValid, message) {
      const feedback = document.createElement('div');
      feedback.className = `validation-feedback ${isValid ? 'valid' : 'invalid'}`;
      feedback.textContent = message;

      // 移除已有的反馈
      const existingFeedback = element.parentNode.querySelector('.validation-feedback');
      if (existingFeedback) {
        existingFeedback.remove();
      }

      // 添加新反馈
      element.parentNode.appendChild(feedback);

      // 添加视觉反馈
      element.classList.remove('valid', 'invalid');
      element.classList.add(isValid ? 'valid' : 'invalid');

      // 自动移除
      setTimeout(() => {
        feedback.remove();
        element.classList.remove('valid', 'invalid');
      }, 3000);
    }
  },

  // 加载状态
  loading: {
    show(element, options = {}) {
      const {
        text = '加载中...',
        spinner = true,
        overlay = true,
        background = 'rgba(255, 255, 255, 0.8)'
      } = options;

      // 创建加载器
      const loader = document.createElement('div');
      loader.className = 'custom-loader';
      loader.innerHTML = `
        ${spinner ? '<div class="spinner"></div>' : ''}
        ${text ? `<div class="loading-text">${text}</div>` : ''}
      `;

      // 创建遮罩
      if (overlay) {
        const overlayElement = document.createElement('div');
        overlayElement.className = 'loading-overlay';
        overlayElement.style.background = background;
        overlayElement.appendChild(loader);
        element.appendChild(overlayElement);

        // 淡入动画
        animation.transition.fadeIn(overlayElement, 300);
      } else {
        element.appendChild(loader);
        animation.transition.fadeIn(loader, 300);
      }
    },

    hide(element) {
      const overlay = element.querySelector('.loading-overlay');
      const loader = element.querySelector('.custom-loader');

      if (overlay) {
        animation.transition.fadeOut(overlay, 300, () => {
          overlay.remove();
        });
      } else if (loader) {
        animation.transition.fadeOut(loader, 300, () => {
          loader.remove();
        });
      }
    }
  },

  // 反馈提示
  feedback: {
    // 成功反馈
    success(element, text = '操作成功') {
      this.showFeedback(element, 'success', text);
    },

    // 错误反馈
    error(element, text = '操作失败') {
      this.showFeedback(element, 'error', text);
    },

    // 警告反馈
    warning(element, text = '警告提示') {
      this.showFeedback(element, 'warning', text);
    },

    // 显示反馈
    showFeedback(element, type, text) {
      const feedback = document.createElement('div');
      feedback.className = `feedback-message ${type}`;
      feedback.textContent = text;

      // 定位反馈消息
      const rect = element.getBoundingClientRect();
      feedback.style.position = 'fixed';
      feedback.style.top = `${rect.bottom + 8}px`;
      feedback.style.left = `${rect.left}px`;

      document.body.appendChild(feedback);

      // 显示动画
      animation.transition.fadeIn(feedback, 300);

      // 自动移除
      setTimeout(() => {
        animation.transition.fadeOut(feedback, 300, () => {
          feedback.remove();
        });
      }, 3000);
    }
  },

  // 滚动交互
  scroll: {
    // 无限滚动
    infiniteScroll(element, callback, options = {}) {
      const {
        threshold = 100,
        debounce = 200
      } = options;

      let timeout;
      let loading = false;

      const handler = async () => {
        const { scrollTop, scrollHeight, clientHeight } = element;
        const remainingScroll = scrollHeight - scrollTop - clientHeight;

        if (remainingScroll <= threshold && !loading) {
          loading = true;
          interaction.loading.show(element, { overlay: false });

          try {
            await callback();
          } catch (error) {
            logger.error('Infinite scroll callback failed:', error);
          }

          loading = false;
          interaction.loading.hide(element);
        }
      };

      const debouncedHandler = () => {
        clearTimeout(timeout);
        timeout = setTimeout(handler, debounce);
      };

      element.addEventListener('scroll', debouncedHandler);

      // 返回清理函数
      return () => {
        element.removeEventListener('scroll', debouncedHandler);
      };
    },

    // 平滑滚动
    smoothScroll(element, options = {}) {
      const {
        offset = 0,
        duration = 500,
        easing = 'easeInOut'
      } = options;

      animation.scroll.to({
        target: element,
        offset,
        duration,
        easing
      });
    }
  },

  // 拖拽交互
  drag: {
    // 使元素可拖拽
    makeDraggable(element, options = {}) {
      const {
        handle = element,
        bounds = 'parent',
        onDragStart,
        onDrag,
        onDragEnd
      } = options;

      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let elementX = 0;
      let elementY = 0;

      const onMouseDown = (e) => {
        isDragging = true;
        startX = e.clientX - elementX;
        startY = e.clientY - elementY;

        onDragStart?.({ x: elementX, y: elementY });

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };

      const onMouseMove = (e) => {
        if (!isDragging) return;

        const newX = e.clientX - startX;
        const newY = e.clientY - startY;

        // 边界检查
        if (bounds === 'parent') {
          const parent = element.parentElement;
          const parentRect = parent.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();

          elementX = Math.max(0, Math.min(newX, parentRect.width - elementRect.width));
          elementY = Math.max(0, Math.min(newY, parentRect.height - elementRect.height));
        } else if (bounds === 'window') {
          const elementRect = element.getBoundingClientRect();
          elementX = Math.max(0, Math.min(newX, window.innerWidth - elementRect.width));
          elementY = Math.max(0, Math.min(newY, window.innerHeight - elementRect.height));
        } else {
          elementX = newX;
          elementY = newY;
        }

        element.style.transform = `translate(${elementX}px, ${elementY}px)`;
        onDrag?.({ x: elementX, y: elementY });
      };

      const onMouseUp = () => {
        isDragging = false;
        onDragEnd?.({ x: elementX, y: elementY });

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      handle.addEventListener('mousedown', onMouseDown);

      // 返回清理函数
      return () => {
        handle.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
    }
  },

  // 手势交互
  gesture: {
    // 添加手势支持
    addGestureSupport(element, handlers = {}) {
      let startX = 0;
      let startY = 0;
      let lastX = 0;
      let lastY = 0;
      let isGesturing = false;

      const onTouchStart = (e) => {
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        lastX = startX;
        lastY = startY;
        isGesturing = true;

        handlers.onGestureStart?.({ x: startX, y: startY });
      };

      const onTouchMove = (e) => {
        if (!isGesturing) return;

        const touch = e.touches[0];
        const currentX = touch.clientX;
        const currentY = touch.clientY;

        const deltaX = currentX - lastX;
        const deltaY = currentY - lastY;

        // 检测手势类型
        const absX = Math.abs(currentX - startX);
        const absY = Math.abs(currentY - startY);

        if (absX > absY && absX > 30) {
          // 水平滑动
          if (deltaX > 0) {
            handlers.onSwipeRight?.({ delta: deltaX });
          } else {
            handlers.onSwipeLeft?.({ delta: -deltaX });
          }
        } else if (absY > absX && absY > 30) {
          // 垂直滑动
          if (deltaY > 0) {
            handlers.onSwipeDown?.({ delta: deltaY });
          } else {
            handlers.onSwipeUp?.({ delta: -deltaY });
          }
        }

        handlers.onGestureMove?.({
          x: currentX,
          y: currentY,
          deltaX,
          deltaY
        });

        lastX = currentX;
        lastY = currentY;
      };

      const onTouchEnd = (e) => {
        if (!isGesturing) return;

        const endX = lastX;
        const endY = lastY;
        const totalX = endX - startX;
        const totalY = endY - startY;

        handlers.onGestureEnd?.({
          startX,
          startY,
          endX,
          endY,
          totalX,
          totalY
        });

        isGesturing = false;
      };

      element.addEventListener('touchstart', onTouchStart);
      element.addEventListener('touchmove', onTouchMove);
      element.addEventListener('touchend', onTouchEnd);

      // 返回清理函数
      return () => {
        element.removeEventListener('touchstart', onTouchStart);
        element.removeEventListener('touchmove', onTouchMove);
        element.removeEventListener('touchend', onTouchEnd);
      };
    }
  }
};

export default interaction;
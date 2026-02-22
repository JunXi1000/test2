import logger from './logger';
import device from './device';

// UI交互优化工具类
const ui = {
  // 滚动优化
  scroll: {
    // 平滑滚动到指定元素
    async toElement(element, options = {}) {
      try {
        const {
          offset = 0,
          behavior = 'smooth',
          duration = 500
        } = options;

        if (!element) return;

        // 如果浏览器支持原生平滑滚动
        if ('scrollBehavior' in document.documentElement.style) {
          element.scrollIntoView({
            behavior,
            block: 'start'
          });
          return;
        }

        // 自定义平滑滚动实现
        const start = window.pageYOffset;
        const end = element.getBoundingClientRect().top + window.pageYOffset - offset;
        const startTime = performance.now();

        const animate = (currentTime) => {
          const timeElapsed = currentTime - startTime;
          const progress = Math.min(timeElapsed / duration, 1);

          window.scrollTo(0, start + (end - start) * progress);

          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };

        requestAnimationFrame(animate);
      } catch (error) {
        logger.error('Scroll to element failed:', error);
      }
    },

    // 无限滚动
    infinite(callback, options = {}) {
      const {
        threshold = 100,
        debounceTime = 100
      } = options;

      let timeout;
      let isLoading = false;

      const handler = async () => {
        if (isLoading) return;

        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY;
        const clientHeight = window.innerHeight;

        if (scrollHeight - scrollTop - clientHeight <= threshold) {
          isLoading = true;
          try {
            await callback();
          } catch (error) {
            logger.error('Infinite scroll callback failed:', error);
          }
          isLoading = false;
        }
      };

      const debouncedHandler = () => {
        clearTimeout(timeout);
        timeout = setTimeout(handler, debounceTime);
      };

      window.addEventListener('scroll', debouncedHandler);

      return () => {
        window.removeEventListener('scroll', debouncedHandler);
      };
    }
  },

  // 手势操作
  gesture: {
    // 添加滑动手势支持
    swipe(element, handlers = {}, options = {}) {
      if (!device.type.isMobile() && !device.browser.supportsTouch()) return;

      const {
        threshold = 50,
        timeout = 300
      } = options;

      let startX, startY, startTime;

      element.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTime = Date.now();
      });

      element.addEventListener('touchend', (e) => {
        if (!startX || !startY) return;

        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = endX - startX;
        const diffY = endY - startY;
        const duration = Date.now() - startTime;

        if (duration > timeout) return;

        const isHorizontal = Math.abs(diffX) > Math.abs(diffY);

        if (isHorizontal && Math.abs(diffX) > threshold) {
          if (diffX > 0 && handlers.right) {
            handlers.right(e);
          } else if (diffX < 0 && handlers.left) {
            handlers.left(e);
          }
        } else if (!isHorizontal && Math.abs(diffY) > threshold) {
          if (diffY > 0 && handlers.down) {
            handlers.down(e);
          } else if (diffY < 0 && handlers.up) {
            handlers.up(e);
          }
        }
      });
    },

    // 添加缩放手势支持
    pinch(element, handlers = {}, options = {}) {
      if (!device.type.isMobile() && !device.browser.supportsTouch()) return;

      const {
        threshold = 0.1
      } = options;

      let startDistance;

      element.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 2) return;

        startDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      });

      element.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 2 || !startDistance) return;

        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );

        const scale = currentDistance / startDistance;

        if (Math.abs(1 - scale) > threshold) {
          if (scale > 1 && handlers.zoomIn) {
            handlers.zoomIn(e, scale);
          } else if (scale < 1 && handlers.zoomOut) {
            handlers.zoomOut(e, scale);
          }
        }
      });
    }
  },

  // 拖拽操作
  drag: {
    // 使元素可拖拽
    enable(element, options = {}) {
      const {
        boundary,
        onDragStart,
        onDrag,
        onDragEnd
      } = options;

      let isDragging = false;
      let startX, startY, startLeft, startTop;

      element.style.position = 'absolute';
      element.style.cursor = 'move';

      const handleStart = (e) => {
        const touch = e.type === 'touchstart' ? e.touches[0] : e;
        isDragging = true;
        startX = touch.clientX;
        startY = touch.clientY;
        startLeft = element.offsetLeft;
        startTop = element.offsetTop;

        if (onDragStart) onDragStart(e);
      };

      const handleMove = (e) => {
        if (!isDragging) return;

        const touch = e.type === 'touchmove' ? e.touches[0] : e;
        const diffX = touch.clientX - startX;
        const diffY = touch.clientY - startY;

        let newLeft = startLeft + diffX;
        let newTop = startTop + diffY;

        // 边界检查
        if (boundary) {
          const rect = element.getBoundingClientRect();
          if (newLeft < 0) newLeft = 0;
          if (newTop < 0) newTop = 0;
          if (newLeft + rect.width > boundary.offsetWidth) {
            newLeft = boundary.offsetWidth - rect.width;
          }
          if (newTop + rect.height > boundary.offsetHeight) {
            newTop = boundary.offsetHeight - rect.height;
          }
        }

        element.style.left = `${newLeft}px`;
        element.style.top = `${newTop}px`;

        if (onDrag) onDrag(e, { left: newLeft, top: newTop });
      };

      const handleEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;

        if (onDragEnd) onDragEnd(e);
      };

      // 添加鼠标事件监听
      element.addEventListener('mousedown', handleStart);
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);

      // 添加触摸事件监听
      element.addEventListener('touchstart', handleStart);
      document.addEventListener('touchmove', handleMove);
      document.addEventListener('touchend', handleEnd);

      // 返回清理函数
      return () => {
        element.removeEventListener('mousedown', handleStart);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        element.removeEventListener('touchstart', handleStart);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
      };
    }
  },

  // 反馈效果
  feedback: {
    // 添加点击波纹效果
    ripple(element, options = {}) {
      const {
        color = 'rgba(0, 0, 0, 0.3)',
        duration = 600
      } = options;

      element.style.position = 'relative';
      element.style.overflow = 'hidden';

      const handleClick = (e) => {
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        const ripple = document.createElement('div');
        ripple.style.position = 'absolute';
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        ripple.style.backgroundColor = color;
        ripple.style.borderRadius = '50%';
        ripple.style.transform = 'scale(0)';
        ripple.style.transition = `transform ${duration}ms ease-out`;
        ripple.style.pointerEvents = 'none';

        element.appendChild(ripple);

        requestAnimationFrame(() => {
          ripple.style.transform = 'scale(2)';
          ripple.style.opacity = '0';

          setTimeout(() => {
            ripple.remove();
          }, duration);
        });
      };

      element.addEventListener('click', handleClick);

      return () => {
        element.removeEventListener('click', handleClick);
      };
    },

    // 添加悬停提示
    tooltip(element, text, options = {}) {
      const {
        position = 'top',
        offset = 10,
        delay = 200
      } = options;

      let timeout;
      let tooltip;

      const createTooltip = () => {
        tooltip = document.createElement('div');
        tooltip.textContent = text;
        tooltip.style.position = 'absolute';
        tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        tooltip.style.color = 'white';
        tooltip.style.padding = '5px 10px';
        tooltip.style.borderRadius = '4px';
        tooltip.style.fontSize = '14px';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.zIndex = '9999';
        tooltip.style.opacity = '0';
        tooltip.style.transition = 'opacity 200ms';

        document.body.appendChild(tooltip);

        const elementRect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let left, top;

        switch (position) {
          case 'top':
            left = elementRect.left + (elementRect.width - tooltipRect.width) / 2;
            top = elementRect.top - tooltipRect.height - offset;
            break;
          case 'bottom':
            left = elementRect.left + (elementRect.width - tooltipRect.width) / 2;
            top = elementRect.bottom + offset;
            break;
          case 'left':
            left = elementRect.left - tooltipRect.width - offset;
            top = elementRect.top + (elementRect.height - tooltipRect.height) / 2;
            break;
          case 'right':
            left = elementRect.right + offset;
            top = elementRect.top + (elementRect.height - tooltipRect.height) / 2;
            break;
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;

        requestAnimationFrame(() => {
          tooltip.style.opacity = '1';
        });
      };

      const handleMouseEnter = () => {
        timeout = setTimeout(createTooltip, delay);
      };

      const handleMouseLeave = () => {
        clearTimeout(timeout);
        if (tooltip) {
          tooltip.remove();
          tooltip = null;
        }
      };

      element.addEventListener('mouseenter', handleMouseEnter);
      element.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        element.removeEventListener('mouseenter', handleMouseEnter);
        element.removeEventListener('mouseleave', handleMouseLeave);
        if (tooltip) {
          tooltip.remove();
        }
      };
    }
  }
};

export default ui;
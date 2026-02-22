// 动画工具类
const animation = {
  // 缓动函数
  easing: {
    // 线性
    linear: t => t,
    // 缓入
    easeIn: t => t * t,
    // 缓出
    easeOut: t => t * (2 - t),
    // 缓入缓出
    easeInOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    // 弹性缓入
    elasticIn: t => {
      return (.04 - .04 / t) * Math.sin(25 * t) + 1;
    },
    // 弹性缓出
    elasticOut: t => {
      return .04 * t / (--t) * Math.sin(25 * t);
    },
    // 弹性缓入缓出
    elasticInOut: t => {
      return (t -= .5) < 0
        ? (.02 + .01 / t) * Math.sin(50 * t)
        : (.02 - .01 / t) * Math.sin(50 * t) + 1;
    }
  },

  // 动画函数
  animate({
    from = 0,
    to = 1,
    duration = 300,
    easing = 'linear',
    onUpdate,
    onComplete
  }) {
    const startTime = Date.now();
    const easingFn = typeof easing === 'function' ? easing : this.easing[easing];

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const value = from + (to - from) * easingFn(progress);
      onUpdate?.(value, progress);

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        onComplete?.(value);
      }
    };

    tick();
  },

  // 滚动动画
  scroll: {
    // 滚动到指定位置
    to({
      target,
      container = window,
      duration = 300,
      offset = 0,
      easing = 'easeInOut',
      onComplete
    }) {
      const isWindow = container === window;
      const start = isWindow ? window.pageYOffset : container.scrollTop;
      let end = 0;

      if (typeof target === 'number') {
        end = target;
      } else if (typeof target === 'string') {
        const element = document.querySelector(target);
        if (element) {
          end = isWindow
            ? element.getBoundingClientRect().top + window.pageYOffset
            : element.offsetTop;
        }
      } else if (target instanceof Element) {
        end = isWindow
          ? target.getBoundingClientRect().top + window.pageYOffset
          : target.offsetTop;
      }

      end += offset;

      animation.animate({
        from: start,
        to: end,
        duration,
        easing,
        onUpdate: value => {
          if (isWindow) {
            window.scrollTo(0, value);
          } else {
            container.scrollTop = value;
          }
        },
        onComplete
      });
    },

    // 平滑滚动到顶部
    toTop(options = {}) {
      this.to({ ...options, target: 0 });
    },

    // 平滑滚动到底部
    toBottom(options = {}) {
      const { container = window } = options;
      const isWindow = container === window;
      const target = isWindow
        ? document.documentElement.scrollHeight
        : container.scrollHeight;
      this.to({ ...options, target });
    }
  },

  // 过渡动画
  transition: {
    // 淡入
    fadeIn(element, duration = 300, display = 'block') {
      element.style.opacity = 0;
      element.style.display = display;

      animation.animate({
        from: 0,
        to: 1,
        duration,
        onUpdate: value => {
          element.style.opacity = value;
        }
      });
    },

    // 淡出
    fadeOut(element, duration = 300) {
      animation.animate({
        from: 1,
        to: 0,
        duration,
        onUpdate: value => {
          element.style.opacity = value;
        },
        onComplete: () => {
          element.style.display = 'none';
        }
      });
    },

    // 滑入
    slideIn(element, duration = 300, direction = 'down') {
      const height = element.scrollHeight;
      element.style.display = 'block';
      element.style.overflow = 'hidden';
      element.style.height = '0';
      element.style.paddingTop = '0';
      element.style.paddingBottom = '0';
      element.style.marginTop = '0';
      element.style.marginBottom = '0';

      animation.animate({
        from: 0,
        to: 1,
        duration,
        onUpdate: value => {
          element.style.height = `${height * value}px`;
          if (value === 1) {
            element.style.height = '';
            element.style.overflow = '';
            element.style.padding = '';
            element.style.margin = '';
          }
        }
      });
    },

    // 滑出
    slideOut(element, duration = 300) {
      const height = element.scrollHeight;
      element.style.overflow = 'hidden';
      element.style.height = `${height}px`;

      animation.animate({
        from: 1,
        to: 0,
        duration,
        onUpdate: value => {
          element.style.height = `${height * value}px`;
          if (value === 0) {
            element.style.display = 'none';
            element.style.height = '';
            element.style.overflow = '';
          }
        }
      });
    }
  },

  // 数值动画
  number: {
    // 数值变化动画
    animate({
      from = 0,
      to = 0,
      duration = 1000,
      decimals = 0,
      easing = 'easeInOut',
      onUpdate,
      onComplete
    }) {
      animation.animate({
        from,
        to,
        duration,
        easing,
        onUpdate: value => {
          onUpdate?.(Number(value.toFixed(decimals)));
        },
        onComplete: value => {
          onComplete?.(Number(value.toFixed(decimals)));
        }
      });
    },

    // 数值增长动画
    increase(element, value, options = {}) {
      const current = parseFloat(element.textContent) || 0;
      this.animate({
        from: current,
        to: value,
        ...options,
        onUpdate: value => {
          element.textContent = value;
        }
      });
    },

    // 数值减少动画
    decrease(element, value, options = {}) {
      const current = parseFloat(element.textContent) || 0;
      this.animate({
        from: current,
        to: value,
        ...options,
        onUpdate: value => {
          element.textContent = value;
        }
      });
    }
  },

  // CSS动画
  css: {
    // 添加CSS动画类
    addClass(element, className, callback) {
      element.classList.add(className);
      element.addEventListener('animationend', function handler() {
        callback?.();
        element.removeEventListener('animationend', handler);
      });
    },

    // 移除CSS动画类
    removeClass(element, className, callback) {
      element.classList.remove(className);
      element.addEventListener('animationend', function handler() {
        callback?.();
        element.removeEventListener('animationend', handler);
      });
    },

    // 切换CSS动画类
    toggleClass(element, className, callback) {
      element.classList.toggle(className);
      element.addEventListener('animationend', function handler() {
        callback?.();
        element.removeEventListener('animationend', handler);
      });
    }
  }
};

export default animation;
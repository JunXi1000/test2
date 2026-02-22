import logger from './logger';

// 用户反馈工具类
const feedback = {
  // 提示消息
  toast: {
    // 显示提示消息
    show(message, options = {}) {
      const {
        type = 'info', // info, success, warning, error
        duration = 3000,
        position = 'top-right' // top-left, top-right, bottom-left, bottom-right, center
      } = options;

      // 创建toast容器
      let container = document.querySelector('.toast-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);

        // 设置容器样式
        const style = document.createElement('style');
        style.textContent = `
          .toast-container {
            position: fixed;
            z-index: 9999;
            padding: 15px;
            pointer-events: none;
          }
          .toast {
            padding: 12px 20px;
            margin-bottom: 10px;
            border-radius: 4px;
            color: white;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease;
          }
          .toast.show {
            opacity: 1;
            transform: translateY(0);
          }
          .toast.info { background-color: #1890ff; }
          .toast.success { background-color: #52c41a; }
          .toast.warning { background-color: #faad14; }
          .toast.error { background-color: #f5222d; }
        `;
        document.head.appendChild(style);
      }

      // 设置容器位置
      switch (position) {
        case 'top-left':
          container.style.top = '0';
          container.style.left = '0';
          break;
        case 'top-right':
          container.style.top = '0';
          container.style.right = '0';
          break;
        case 'bottom-left':
          container.style.bottom = '0';
          container.style.left = '0';
          break;
        case 'bottom-right':
          container.style.bottom = '0';
          container.style.right = '0';
          break;
        case 'center':
          container.style.top = '50%';
          container.style.left = '50%';
          container.style.transform = 'translate(-50%, -50%)';
          break;
      }

      // 创建toast元素
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;

      // 添加到容器
      container.appendChild(toast);

      // 显示动画
      setTimeout(() => toast.classList.add('show'), 10);

      // 自动移除
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    },

    // 快捷方法
    info(message, options = {}) {
      this.show(message, { ...options, type: 'info' });
    },

    success(message, options = {}) {
      this.show(message, { ...options, type: 'success' });
    },

    warning(message, options = {}) {
      this.show(message, { ...options, type: 'warning' });
    },

    error(message, options = {}) {
      this.show(message, { ...options, type: 'error' });
    }
  },

  // 加载状态
  loading: {
    show(options = {}) {
      const {
        text = '加载中...',
        background = 'rgba(0, 0, 0, 0.5)',
        spinnerColor = '#ffffff'
      } = options;

      // 创建加载遮罩
      const overlay = document.createElement('div');
      overlay.className = 'loading-overlay';

      // 设置样式
      const style = document.createElement('style');
      style.textContent = `
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: ${background};
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 9999;
        }
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid ${spinnerColor};
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .loading-text {
          margin-top: 15px;
          color: ${spinnerColor};
          font-size: 14px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);

      // 创建加载动画
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      overlay.appendChild(spinner);

      // 创建加载文本
      if (text) {
        const textElement = document.createElement('div');
        textElement.className = 'loading-text';
        textElement.textContent = text;
        overlay.appendChild(textElement);
      }

      document.body.appendChild(overlay);

      return {
        hide: () => {
          overlay.remove();
          style.remove();
        },
        updateText: (newText) => {
          const textElement = overlay.querySelector('.loading-text');
          if (textElement) {
            textElement.textContent = newText;
          }
        }
      };
    }
  },

  // 进度反馈
  progress: {
    create(options = {}) {
      const {
        type = 'bar', // bar, circle
        color = '#1890ff',
        size = type === 'circle' ? 120 : '100%',
        strokeWidth = 6
      } = options;

      let container, progressElement, valueElement;

      if (type === 'bar') {
        // 创建进度条
        container = document.createElement('div');
        container.className = 'progress-bar-container';
        container.style.cssText = `
          width: ${size};
          height: ${strokeWidth}px;
          background: #f5f5f5;
          border-radius: ${strokeWidth}px;
          overflow: hidden;
        `;

        progressElement = document.createElement('div');
        progressElement.className = 'progress-bar';
        progressElement.style.cssText = `
          width: 0%;
          height: 100%;
          background: ${color};
          transition: width 0.3s ease;
        `;

        container.appendChild(progressElement);
      } else {
        // 创建环形进度
        container = document.createElement('div');
        container.className = 'progress-circle-container';
        container.style.cssText = `
          width: ${size}px;
          height: ${size}px;
          position: relative;
        `;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '50');
        circle.setAttribute('cy', '50');
        circle.setAttribute('r', (50 - strokeWidth / 2).toString());
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', '#f5f5f5');
        circle.setAttribute('stroke-width', strokeWidth.toString());

        progressElement = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        progressElement.setAttribute('cx', '50');
        progressElement.setAttribute('cy', '50');
        progressElement.setAttribute('r', (50 - strokeWidth / 2).toString());
        progressElement.setAttribute('fill', 'none');
        progressElement.setAttribute('stroke', color);
        progressElement.setAttribute('stroke-width', strokeWidth.toString());
        progressElement.setAttribute('stroke-dasharray', '0 314.159');
        progressElement.setAttribute('transform', 'rotate(-90 50 50)');

        svg.appendChild(circle);
        svg.appendChild(progressElement);
        container.appendChild(svg);

        // 创建进度文本
        valueElement = document.createElement('div');
        valueElement.className = 'progress-value';
        valueElement.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: ${size / 4}px;
          color: ${color};
        `;
        valueElement.textContent = '0%';
        container.appendChild(valueElement);
      }

      return {
        element: container,
        update: (value) => {
          const progress = Math.min(100, Math.max(0, value));
          if (type === 'bar') {
            progressElement.style.width = `${progress}%`;
          } else {
            const circumference = 2 * Math.PI * (50 - strokeWidth / 2);
            const offset = circumference * (1 - progress / 100);
            progressElement.setAttribute(
              'stroke-dasharray',
              `${circumference - offset} ${offset}`
            );
            if (valueElement) {
              valueElement.textContent = `${Math.round(progress)}%`;
            }
          }
        }
      };
    }
  },

  // 操作反馈
  action: {
    // 确认操作
    confirm(options = {}) {
      return new Promise((resolve) => {
        const {
          title = '确认',
          content = '是否确认此操作？',
          okText = '确定',
          cancelText = '取消',
          type = 'info' // info, warning, error
        } = options;

        // 创建确认框
        const modal = document.createElement('div');
        modal.className = 'confirm-modal';
        modal.innerHTML = `
          <div class="confirm-content ${type}">
            <h3>${title}</h3>
            <p>${content}</p>
            <div class="confirm-buttons">
              <button class="cancel">${cancelText}</button>
              <button class="ok">${okText}</button>
            </div>
          </div>
        `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
          .confirm-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
          }
          .confirm-content {
            background: white;
            padding: 20px;
            border-radius: 4px;
            min-width: 300px;
            max-width: 90%;
          }
          .confirm-content.info h3 { color: #1890ff; }
          .confirm-content.warning h3 { color: #faad14; }
          .confirm-content.error h3 { color: #f5222d; }
          .confirm-content h3 {
            margin: 0 0 15px;
            font-size: 18px;
          }
          .confirm-content p {
            margin: 0 0 20px;
            color: #666;
          }
          .confirm-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
          }
          .confirm-buttons button {
            padding: 8px 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
          .confirm-buttons .cancel {
            background: #f5f5f5;
            color: #666;
          }
          .confirm-buttons .ok {
            background: #1890ff;
            color: white;
          }
          .confirm-buttons .ok:hover { background: #40a9ff; }
          .confirm-buttons .cancel:hover { background: #e8e8e8; }
        `;
        document.head.appendChild(style);

        // 添加到页面
        document.body.appendChild(modal);

        // 绑定事件
        const close = (result) => {
          modal.remove();
          style.remove();
          resolve(result);
        };

        modal.querySelector('.ok').onclick = () => close(true);
        modal.querySelector('.cancel').onclick = () => close(false);
        modal.onclick = (e) => {
          if (e.target === modal) close(false);
        };
      });
    }
  }
};

export default feedback;
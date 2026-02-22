// 事件总线工具类

class EventBus {
  constructor() {
    // 事件存储
    this.events = new Map();
    // 一次性事件存储
    this.onceEvents = new Map();
  }

  // 订阅事件
  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(callback);

    // 返回取消订阅的函数
    return () => {
      this.off(event, callback);
    };
  }

  // 订阅一次性事件
  once(event, callback) {
    if (!this.onceEvents.has(event)) {
      this.onceEvents.set(event, new Set());
    }
    this.onceEvents.get(event).add(callback);

    // 返回取消订阅的函数
    return () => {
      this.off(event, callback, true);
    };
  }

  // 取消订阅
  off(event, callback, isOnce = false) {
    const events = isOnce ? this.onceEvents : this.events;
    if (events.has(event)) {
      if (callback) {
        events.get(event).delete(callback);
      } else {
        events.delete(event);
      }
    }
  }

  // 触发事件
  emit(event, ...args) {
    // 触发普通事件
    if (this.events.has(event)) {
      this.events.get(event).forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event ${event}:`, error);
        }
      });
    }

    // 触发一次性事件
    if (this.onceEvents.has(event)) {
      this.onceEvents.get(event).forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in once event ${event}:`, error);
        }
      });
      this.onceEvents.delete(event);
    }
  }

  // 清空所有事件
  clear() {
    this.events.clear();
    this.onceEvents.clear();
  }

  // 获取事件数量
  count(event) {
    let count = 0;
    if (this.events.has(event)) {
      count += this.events.get(event).size;
    }
    if (this.onceEvents.has(event)) {
      count += this.onceEvents.get(event).size;
    }
    return count;
  }

  // 判断是否有订阅者
  hasListeners(event) {
    return this.count(event) > 0;
  }

  // 获取所有事件名
  getEventNames() {
    return [
      ...new Set([...this.events.keys(), ...this.onceEvents.keys()])
    ];
  }
}

// 创建事件总线实例
const eventBus = new EventBus();

// 常用事件名称
const Events = {
  // 用户相关
  USER_LOGIN: 'user:login',           // 用户登录
  USER_LOGOUT: 'user:logout',         // 用户登出
  USER_UPDATE: 'user:update',         // 用户信息更新

  // 购物车相关
  CART_UPDATE: 'cart:update',         // 购物车更新
  CART_CLEAR: 'cart:clear',           // 清空购物车

  // 订单相关
  ORDER_CREATE: 'order:create',       // 创建订单
  ORDER_PAY: 'order:pay',             // 订单支付
  ORDER_CANCEL: 'order:cancel',       // 取消订单

  // 商品相关
  PRODUCT_UPDATE: 'product:update',   // 商品更新
  PRODUCT_DELETE: 'product:delete',   // 商品删除

  // 系统相关
  SYSTEM_ERROR: 'system:error',       // 系统错误
  NETWORK_ERROR: 'network:error',     // 网络错误
  API_ERROR: 'api:error',             // API错误

  // 主题相关
  THEME_CHANGE: 'theme:change',       // 主题切换

  // 页面相关
  PAGE_RELOAD: 'page:reload',         // 页面重载
  PAGE_SCROLL: 'page:scroll',         // 页面滚动
  PAGE_RESIZE: 'page:resize',         // 页面大小改变

  // 组件相关
  COMPONENT_MOUNTED: 'component:mounted',   // 组件挂载
  COMPONENT_UPDATED: 'component:updated',   // 组件更新
  COMPONENT_UNMOUNTED: 'component:unmounted' // 组件卸载
};

// 事件总线工具类
const bus = {
  // 订阅事件
  on(event, callback) {
    return eventBus.on(event, callback);
  },

  // 订阅一次性事件
  once(event, callback) {
    return eventBus.once(event, callback);
  },

  // 取消订阅
  off(event, callback) {
    eventBus.off(event, callback);
  },

  // 触发事件
  emit(event, ...args) {
    eventBus.emit(event, ...args);
  },

  // 清空所有事件
  clear() {
    eventBus.clear();
  },

  // 获取事件数量
  count(event) {
    return eventBus.count(event);
  },

  // 判断是否有订阅者
  hasListeners(event) {
    return eventBus.hasListeners(event);
  },

  // 获取所有事件名
  getEventNames() {
    return eventBus.getEventNames();
  }
};

export { bus as default, Events };
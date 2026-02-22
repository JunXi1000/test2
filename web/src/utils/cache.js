// 缓存工具类

// 本地存储封装
class Storage {
  constructor(storage) {
    this.storage = storage;
  }

  // 设置缓存
  set(key, value, expire = 0) {
    const data = {
      value,
      expire: expire ? Date.now() + expire * 1000 : 0
    };
    this.storage.setItem(key, JSON.stringify(data));
  }

  // 获取缓存
  get(key) {
    const data = this.storage.getItem(key);
    if (!data) return null;

    try {
      const { value, expire } = JSON.parse(data);
      // 未设置过期时间或者未过期
      if (expire === 0 || expire > Date.now()) {
        return value;
      }
      // 已过期则删除
      this.remove(key);
      return null;
    } catch (e) {
      return null;
    }
  }

  // 移除缓存
  remove(key) {
    this.storage.removeItem(key);
  }

  // 清空缓存
  clear() {
    this.storage.clear();
  }

  // 获取所有键名
  keys() {
    return Object.keys(this.storage);
  }

  // 获取缓存数量
  length() {
    return this.storage.length;
  }

  // 遍历缓存
  forEach(callback) {
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      callback(key, this.get(key));
    }
  }
}

// 内存缓存
class MemoryStorage {
  constructor() {
    this.storage = new Map();
  }

  setItem(key, value) {
    this.storage.set(key, value);
  }

  getItem(key) {
    return this.storage.get(key);
  }

  removeItem(key) {
    this.storage.delete(key);
  }

  clear() {
    this.storage.clear();
  }

  key(index) {
    return [...this.storage.keys()][index];
  }

  get length() {
    return this.storage.size;
  }
}

// 创建存储实例
const local = new Storage(localStorage);
const session = new Storage(sessionStorage);
const memory = new Storage(new MemoryStorage());

// 缓存工具类
const cache = {
  // 本地永久缓存
  local: {
    // 设置永久缓存
    set(key, value) {
      local.set(key, value);
    },

    // 获取永久缓存
    get(key) {
      return local.get(key);
    },

    // 移除永久缓存
    remove(key) {
      local.remove(key);
    },

    // 清空永久缓存
    clear() {
      local.clear();
    }
  },

  // 本地会话缓存
  session: {
    // 设置会话缓存
    set(key, value) {
      session.set(key, value);
    },

    // 获取会话缓存
    get(key) {
      return session.get(key);
    },

    // 移除会话缓存
    remove(key) {
      session.remove(key);
    },

    // 清空会话缓存
    clear() {
      session.clear();
    }
  },

  // 内存缓存
  memory: {
    // 设置缓存
    set(key, value, expire = 0) {
      memory.set(key, value, expire);
    },

    // 获取缓存
    get(key) {
      return memory.get(key);
    },

    // 移除缓存
    remove(key) {
      memory.remove(key);
    },

    // 清空缓存
    clear() {
      memory.clear();
    }
  },

  // Cookie操作
  cookie: {
    // 设置Cookie
    set(name, value, days = 7, path = '/') {
      const exp = new Date();
      exp.setTime(exp.getTime() + days * 24 * 60 * 60 * 1000);
      document.cookie = `${name}=${encodeURIComponent(value)};expires=${exp.toUTCString()};path=${path}`;
    },

    // 获取Cookie
    get(name) {
      const arr = document.cookie.match(new RegExp(`(^| )${name}=([^;]*)(;|$)`));
      if (arr) {
        return decodeURIComponent(arr[2]);
      }
      return null;
    },

    // 移除Cookie
    remove(name, path = '/') {
      this.set(name, '', -1, path);
    }
  }
};

export default cache;
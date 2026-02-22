// 数据格式化工具类

// 日期时间格式化
const dateTime = {
  // 格式化为年月日
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 格式化为年月日时分秒
  formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  },

  // 格式化为相对时间
  formatRelative(date) {
    if (!date) return '';
    const now = new Date();
    const d = new Date(date);
    const diff = now - d;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 30) {
      return this.formatDate(date);
    } else if (days > 0) {
      return `${days}天前`;
    } else if (hours > 0) {
      return `${hours}小时前`;
    } else if (minutes > 0) {
      return `${minutes}分钟前`;
    } else {
      return '刚刚';
    }
  }
};

// 数字格式化
const number = {
  // 格式化金额
  formatPrice(price, decimals = 2) {
    if (!price) return '0.00';
    return Number(price).toFixed(decimals);
  },

  // 格式化百分比
  formatPercent(value, decimals = 2) {
    if (!value) return '0%';
    return `${(value * 100).toFixed(decimals)}%`;
  },

  // 格式化数字（添加千位分隔符）
  formatNumber(num) {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  // 格式化文件大小
  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let num = bytes;
    let unitIndex = 0;
    
    while (num >= 1024 && unitIndex < units.length - 1) {
      num /= 1024;
      unitIndex++;
    }
    
    return `${num.toFixed(2)} ${units[unitIndex]}`;
  }
};

// 字符串格式化
const string = {
  // 首字母大写
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  // 驼峰转连字符
  toKebabCase(str) {
    if (!str) return '';
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  },

  // 连字符转驼峰
  toCamelCase(str) {
    if (!str) return '';
    return str
      .replace(/-([a-z])/g, (g) => g[1].toUpperCase())
      .replace(/^[a-z]/, (g) => g.toUpperCase());
  },

  // 截断文本
  truncate(str, length = 30, suffix = '...') {
    if (!str) return '';
    if (str.length <= length) return str;
    return str.substring(0, length) + suffix;
  },

  // 掩码处理（如手机号、邮箱等）
  mask(str, start = 3, end = 4) {
    if (!str) return '';
    const length = str.length;
    const maskLength = length - start - end;
    if (maskLength <= 0) return str;
    return str.substring(0, start) + '*'.repeat(maskLength) + str.substring(length - end);
  }
};

// 数组格式化
const array = {
  // 数组转树形结构
  toTree(array, options = {}) {
    const {
      id = 'id',
      parentId = 'parentId',
      children = 'children'
    } = options;

    const tree = [];
    const map = {};

    array.forEach(item => {
      map[item[id]] = { ...item, [children]: [] };
    });

    array.forEach(item => {
      const node = map[item[id]];
      if (item[parentId] && map[item[parentId]]) {
        map[item[parentId]][children].push(node);
      } else {
        tree.push(node);
      }
    });

    return tree;
  },

  // 树形结构转数组
  toArray(tree, options = {}) {
    const { children = 'children' } = options;
    const result = [];
    const stack = [...tree];

    while (stack.length) {
      const node = stack.pop();
      const childNodes = node[children];
      delete node[children];
      result.push(node);

      if (childNodes && childNodes.length) {
        stack.push(...childNodes);
      }
    }

    return result;
  },

  // 数组去重
  unique(array, key) {
    if (!Array.isArray(array)) return [];
    if (key) {
      const map = new Map();
      return array.filter(item => {
        if (!map.has(item[key])) {
          map.set(item[key], true);
          return true;
        }
        return false;
      });
    }
    return [...new Set(array)];
  }
};

// 对象格式化
const object = {
  // 移除对象中的空值
  removeEmpty(obj) {
    const result = {};
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value !== null && value !== undefined && value !== '') {
        result[key] = value;
      }
    });
    return result;
  },

  // 扁平化对象
  flatten(obj, prefix = '') {
    const result = {};
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.flatten(value, newKey));
      } else {
        result[newKey] = value;
      }
    });
    return result;
  },

  // 深度合并对象
  deepMerge(target, source) {
    const result = { ...target };
    if (source && typeof source === 'object') {
      Object.keys(source).forEach(key => {
        const value = source[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if (result[key] && typeof result[key] === 'object') {
            result[key] = this.deepMerge(result[key], value);
          } else {
            result[key] = { ...value };
          }
        } else {
          result[key] = value;
        }
      });
    }
    return result;
  }
};

export const formatter = {
  dateTime,
  number,
  string,
  array,
  object
};
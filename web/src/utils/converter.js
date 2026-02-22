// 数据转换工具类
const converter = {
  // 数字转换
  number: {
    // 数字千分位格式化
    toThousands(num) {
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    // 数字转中文
    toChinese(num) {
      const units = ['', '万', '亿', '万亿'];
      const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
      const radix = ['', '十', '百', '千'];
      
      let result = '';
      let unitIndex = 0;
      let strNum = Math.abs(num).toString();

      while (strNum.length > 0) {
        const section = strNum.slice(-4);
        let sectionResult = '';
        
        for (let i = 0; i < section.length; i++) {
          const digit = parseInt(section[i]);
          if (digit === 0) {
            if (sectionResult.length > 0 && sectionResult[sectionResult.length - 1] !== '零') {
              sectionResult += '零';
            }
          } else {
            sectionResult += digits[digit] + radix[section.length - 1 - i];
          }
        }

        if (sectionResult !== '') {
          result = sectionResult + units[unitIndex] + result;
        }

        strNum = strNum.slice(0, -4);
        unitIndex++;
      }

      // 处理特殊情况
      result = result.replace(/零+$/, '');
      result = result.replace(/零+/g, '零');
      if (result === '') result = '零';
      if (num < 0) result = '负' + result;

      return result;
    },

    // 数字转罗马数字
    toRoman(num) {
      const roman = {
        M: 1000, CM: 900, D: 500, CD: 400,
        C: 100, XC: 90, L: 50, XL: 40,
        X: 10, IX: 9, V: 5, IV: 4, I: 1
      };
      let result = '';
      
      for (let key in roman) {
        while (num >= roman[key]) {
          result += key;
          num -= roman[key];
        }
      }
      
      return result;
    },

    // 数字转百分比
    toPercentage(num, decimals = 2) {
      return (num * 100).toFixed(decimals) + '%';
    }
  },

  // 日期转换
  date: {
    // 日期格式化
    format(date, format = 'YYYY-MM-DD HH:mm:ss') {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');

      return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
    },

    // 相对时间
    fromNow(date) {
      const now = new Date();
      const diff = now - new Date(date);
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const months = Math.floor(days / 30);
      const years = Math.floor(months / 12);

      if (years > 0) return `${years}年前`;
      if (months > 0) return `${months}个月前`;
      if (days > 0) return `${days}天前`;
      if (hours > 0) return `${hours}小时前`;
      if (minutes > 0) return `${minutes}分钟前`;
      if (seconds > 0) return `${seconds}秒前`;
      return '刚刚';
    },

    // 日期范围格式化
    formatRange(startDate, endDate, format = 'YYYY-MM-DD') {
      return [
        this.format(startDate, format),
        this.format(endDate, format)
      ];
    }
  },

  // 文件转换
  file: {
    // 文件大小格式化
    formatSize(bytes) {
      if (bytes === 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
      const exp = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, exp)).toFixed(2)} ${units[exp]}`;
    },

    // Base64转Blob
    base64ToBlob(base64, mimeType) {
      const byteString = atob(base64.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      
      return new Blob([ab], { type: mimeType });
    },

    // Blob转Base64
    blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  },

  // 颜色转换
  color: {
    // RGB转十六进制
    rgbToHex(r, g, b) {
      return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
    },

    // 十六进制转RGB
    hexToRgb(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    },

    // RGB转HSL
    rgbToHsl(r, g, b) {
      r /= 255;
      g /= 255;
      b /= 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }

        h /= 6;
      }

      return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
      };
    }
  },

  // 文本转换
  text: {
    // 首字母大写
    capitalize(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    },

    // 驼峰转连字符
    camelToKebab(str) {
      return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    },

    // 连字符转驼峰
    kebabToCamel(str) {
      return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    },

    // 文本截断
    truncate(str, length, suffix = '...') {
      if (str.length <= length) return str;
      return str.slice(0, length) + suffix;
    },

    // 移除HTML标签
    stripHtml(html) {
      return html.replace(/<[^>]*>/g, '');
    }
  },

  // 数据结构转换
  data: {
    // 数组转树形结构
    arrayToTree(array, options = {}) {
      const {
        id = 'id',
        parentId = 'parentId',
        children = 'children'
      } = options;

      const map = {};
      const result = [];

      array.forEach(item => {
        map[item[id]] = { ...item, [children]: [] };
      });

      array.forEach(item => {
        const parent = map[item[parentId]];
        if (parent) {
          parent[children].push(map[item[id]]);
        } else {
          result.push(map[item[id]]);
        }
      });

      return result;
    },

    // 树形结构转数组
    treeToArray(tree, options = {}) {
      const {
        children = 'children',
        parent = 'parent',
        level = 'level'
      } = options;

      const result = [];
      const stack = tree.map(node => ({ node, [level]: 0, [parent]: null }));

      while (stack.length) {
        const { node, [level]: lev, [parent]: par } = stack.pop();
        const children = node[children];
        delete node[children];

        result.push({ ...node, [level]: lev, [parent]: par });

        if (children?.length) {
          children.forEach(child => {
            stack.push({
              node: child,
              [level]: lev + 1,
              [parent]: node
            });
          });
        }
      }

      return result;
    }
  }
};

export default converter;
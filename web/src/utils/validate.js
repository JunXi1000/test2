// 数据校验工具类

// 字符串校验
const string = {
  // 是否为空字符串
  isEmpty(str) {
    return str === undefined || str === null || str.trim() === '';
  },

  // 是否为手机号
  isPhone(str) {
    return /^1[3-9]\d{9}$/.test(str);
  },

  // 是否为邮箱
  isEmail(str) {
    return /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/.test(str);
  },

  // 是否为URL
  isUrl(str) {
    return /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/.test(str);
  },

  // 是否为身份证号
  isIdCard(str) {
    return /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/.test(str);
  },

  // 是否为中文
  isChinese(str) {
    return /^[\u4e00-\u9fa5]+$/.test(str);
  },

  // 是否包含中文
  hasChinese(str) {
    return /[\u4e00-\u9fa5]/.test(str);
  },

  // 是否为邮政编码
  isPostcode(str) {
    return /^\d{6}$/.test(str);
  },

  // 是否为IP地址
  isIp(str) {
    return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(str);
  }
};

// 数字校验
const number = {
  // 是否为数字
  isNumber(value) {
    return typeof value === 'number' && !isNaN(value);
  },

  // 是否为整数
  isInteger(value) {
    return Number.isInteger(value);
  },

  // 是否为正数
  isPositive(value) {
    return this.isNumber(value) && value > 0;
  },

  // 是否为负数
  isNegative(value) {
    return this.isNumber(value) && value < 0;
  },

  // 是否在范围内
  inRange(value, min, max) {
    return this.isNumber(value) && value >= min && value <= max;
  },

  // 是否为金额（最多两位小数）
  isPrice(value) {
    return /^\d+(\.\d{1,2})?$/.test(value.toString());
  }
};

// 数组校验
const array = {
  // 是否为数组
  isArray(value) {
    return Array.isArray(value);
  },

  // 是否为空数组
  isEmpty(value) {
    return this.isArray(value) && value.length === 0;
  },

  // 是否包含某个值
  includes(array, value) {
    return this.isArray(array) && array.includes(value);
  },

  // 是否所有元素都满足条件
  every(array, predicate) {
    return this.isArray(array) && array.every(predicate);
  },

  // 是否存在满足条件的元素
  some(array, predicate) {
    return this.isArray(array) && array.some(predicate);
  }
};

// 对象校验
const object = {
  // 是否为对象
  isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  },

  // 是否为空对象
  isEmpty(value) {
    return this.isObject(value) && Object.keys(value).length === 0;
  },

  // 是否包含某个属性
  hasProperty(obj, prop) {
    return this.isObject(obj) && Object.prototype.hasOwnProperty.call(obj, prop);
  },

  // 是否包含所有指定属性
  hasProperties(obj, props) {
    if (!this.isObject(obj) || !Array.isArray(props)) return false;
    return props.every(prop => this.hasProperty(obj, prop));
  }
};

// 日期校验
const date = {
  // 是否为日期对象
  isDate(value) {
    return value instanceof Date && !isNaN(value);
  },

  // 是否为有效的日期字符串
  isValidDateString(str) {
    const date = new Date(str);
    return this.isDate(date);
  },

  // 是否为过去的日期
  isPast(date) {
    return this.isDate(date) && date < new Date();
  },

  // 是否为将来的日期
  isFuture(date) {
    return this.isDate(date) && date > new Date();
  },

  // 是否在日期范围内
  inRange(date, start, end) {
    return this.isDate(date) && 
           this.isDate(start) && 
           this.isDate(end) && 
           date >= start && 
           date <= end;
  }
};

// 文件校验
const file = {
  // 是否为允许的文件类型
  isAllowedType(file, types) {
    if (!file || !Array.isArray(types)) return false;
    const fileType = file.type.toLowerCase();
    return types.some(type => fileType.includes(type.toLowerCase()));
  },

  // 是否超过文件大小限制（单位：字节）
  isOverSize(file, maxSize) {
    return file && file.size > maxSize;
  },

  // 是否为图片文件
  isImage(file) {
    return file && file.type.startsWith('image/');
  },

  // 是否为视频文件
  isVideo(file) {
    return file && file.type.startsWith('video/');
  },

  // 是否为音频文件
  isAudio(file) {
    return file && file.type.startsWith('audio/');
  }
};

// 密码强度校验
const password = {
  // 包含数字
  hasNumber(str) {
    return /\d/.test(str);
  },

  // 包含小写字母
  hasLowerCase(str) {
    return /[a-z]/.test(str);
  },

  // 包含大写字母
  hasUpperCase(str) {
    return /[A-Z]/.test(str);
  },

  // 包含特殊字符
  hasSpecialChar(str) {
    return /[!@#$%^&*(),.?":{}|<>]/.test(str);
  },

  // 获取密码强度等级（0-4）
  getStrength(str) {
    let strength = 0;
    if (str.length >= 8) strength++;
    if (this.hasNumber(str)) strength++;
    if (this.hasLowerCase(str)) strength++;
    if (this.hasUpperCase(str)) strength++;
    if (this.hasSpecialChar(str)) strength++;
    return strength;
  }
};

export const validate = {
  string,
  number,
  array,
  object,
  date,
  file,
  password
};
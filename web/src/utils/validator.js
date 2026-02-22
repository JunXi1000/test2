// 表单验证工具类

// 通用验证规则
const rules = {
  // 必填项验证
  required: (message = '该字段不能为空') => ({
    required: true,
    message,
    trigger: ['blur', 'change']
  }),

  // 字符串长度验证
  length: (min, max, message) => ({
    min,
    max,
    message: message || `长度必须在${min}到${max}个字符之间`,
    trigger: ['blur', 'change']
  }),

  // 手机号验证
  phone: {
    pattern: /^1[3-9]\d{9}$/,
    message: '请输入正确的手机号码',
    trigger: ['blur', 'change']
  },

  // 邮箱验证
  email: {
    type: 'email',
    message: '请输入正确的邮箱地址',
    trigger: ['blur', 'change']
  },

  // URL验证
  url: {
    type: 'url',
    message: '请输入正确的URL地址',
    trigger: ['blur', 'change']
  },

  // 数字范围验证
  number: (min, max, message) => ({
    type: 'number',
    min,
    max,
    message: message || `数值必须在${min}到${max}之间`,
    trigger: ['blur', 'change']
  }),

  // 密码强度验证
  password: {
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/,
    message: '密码必须包含大小写字母和数字，且长度不少于8位',
    trigger: ['blur', 'change']
  },

  // 用户名验证
  username: {
    pattern: /^[a-zA-Z0-9_-]{4,16}$/,
    message: '用户名必须是4-16位字母、数字、下划线或连字符',
    trigger: ['blur', 'change']
  },

  // 中文验证
  chinese: {
    pattern: /^[\u4e00-\u9fa5]+$/,
    message: '请输入中文字符',
    trigger: ['blur', 'change']
  },

  // 身份证号验证
  idCard: {
    pattern: /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/,
    message: '请输入正确的身份证号码',
    trigger: ['blur', 'change']
  },

  // 金额验证（最多两位小数）
  price: {
    pattern: /^\d+(\.\d{1,2})?$/,
    message: '请输入正确的金额（最多两位小数）',
    trigger: ['blur', 'change']
  }
};

// 自定义验证函数
const validate = {
  // 确认密码验证
  confirmPassword: (password) => (rule, value, callback) => {
    if (value === '') {
      callback(new Error('请再次输入密码'));
    } else if (value !== password) {
      callback(new Error('两次输入密码不一致'));
    } else {
      callback();
    }
  },

  // 自定义异步验证
  async: (validator) => (rule, value, callback) => {
    try {
      const result = await validator(value);
      callback();
    } catch (error) {
      callback(error);
    }
  }
};

// 表单验证工具方法
const validator = {
  // 创建表单验证规则
  createRules(config) {
    const formRules = {};
    Object.keys(config).forEach(key => {
      const ruleConfig = config[key];
      formRules[key] = [];

      // 处理必填规则
      if (ruleConfig.required) {
        formRules[key].push(rules.required(ruleConfig.message));
      }

      // 处理其他验证规则
      if (ruleConfig.rules && Array.isArray(ruleConfig.rules)) {
        ruleConfig.rules.forEach(rule => {
          if (typeof rule === 'string' && rules[rule]) {
            formRules[key].push(rules[rule]);
          } else if (typeof rule === 'object') {
            formRules[key].push(rule);
          }
        });
      }
    });
    return formRules;
  },

  // 验证单个表单字段
  validateField(formRef, field) {
    return new Promise((resolve, reject) => {
      formRef.validateField(field, (valid) => {
        if (valid) {
          resolve();
        } else {
          reject();
        }
      });
    });
  },

  // 验证整个表单
  validateForm(formRef) {
    return new Promise((resolve, reject) => {
      formRef.validate((valid) => {
        if (valid) {
          resolve();
        } else {
          reject();
        }
      });
    });
  },

  // 重置表单
  resetForm(formRef) {
    formRef.resetFields();
  }
};

export { rules, validate, validator };
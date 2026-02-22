import CryptoJS from 'crypto-js';

// 加密配置
const config = {
  // 默认密钥
  key: 'your-secret-key',
  // 加密选项
  options: {
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  }
};

// 加密工具类
const crypto = {
  // 配置加密选项
  config(options) {
    Object.assign(config, options);
  },

  // AES 加密
  encrypt: {
    // 加密文本
    text(text, key = config.key) {
      try {
        const result = CryptoJS.AES.encrypt(text, key, config.options);
        return result.toString();
      } catch (error) {
        console.error('Encryption error:', error);
        return '';
      }
    },

    // 加密对象
    object(obj, key = config.key) {
      try {
        const text = JSON.stringify(obj);
        return this.text(text, key);
      } catch (error) {
        console.error('Object encryption error:', error);
        return '';
      }
    }
  },

  // AES 解密
  decrypt: {
    // 解密文本
    text(encrypted, key = config.key) {
      try {
        const bytes = CryptoJS.AES.decrypt(encrypted, key, config.options);
        return bytes.toString(CryptoJS.enc.Utf8);
      } catch (error) {
        console.error('Decryption error:', error);
        return '';
      }
    },

    // 解密对象
    object(encrypted, key = config.key) {
      try {
        const text = this.text(encrypted, key);
        return JSON.parse(text);
      } catch (error) {
        console.error('Object decryption error:', error);
        return null;
      }
    }
  },

  // MD5 加密
  md5(text) {
    try {
      return CryptoJS.MD5(text).toString();
    } catch (error) {
      console.error('MD5 error:', error);
      return '';
    }
  },

  // SHA1 加密
  sha1(text) {
    try {
      return CryptoJS.SHA1(text).toString();
    } catch (error) {
      console.error('SHA1 error:', error);
      return '';
    }
  },

  // SHA256 加密
  sha256(text) {
    try {
      return CryptoJS.SHA256(text).toString();
    } catch (error) {
      console.error('SHA256 error:', error);
      return '';
    }
  },

  // Base64 编码
  base64: {
    // 编码
    encode(text) {
      try {
        const wordArray = CryptoJS.enc.Utf8.parse(text);
        return CryptoJS.enc.Base64.stringify(wordArray);
      } catch (error) {
        console.error('Base64 encode error:', error);
        return '';
      }
    },

    // 解码
    decode(encoded) {
      try {
        const wordArray = CryptoJS.enc.Base64.parse(encoded);
        return CryptoJS.enc.Utf8.stringify(wordArray);
      } catch (error) {
        console.error('Base64 decode error:', error);
        return '';
      }
    }
  },

  // URL 安全的 Base64
  urlSafeBase64: {
    // 编码
    encode(text) {
      try {
        return crypto.base64.encode(text)
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
      } catch (error) {
        console.error('URL safe Base64 encode error:', error);
        return '';
      }
    },

    // 解码
    decode(encoded) {
      try {
        encoded = encoded
          .replace(/-/g, '+')
          .replace(/_/g, '/');
        
        // 添加回填充
        switch (encoded.length % 4) {
          case 2: encoded += '==';
            break;
          case 3: encoded += '=';
            break;
        }
        
        return crypto.base64.decode(encoded);
      } catch (error) {
        console.error('URL safe Base64 decode error:', error);
        return '';
      }
    }
  },

  // 生成随机密钥
  generateKey(length = 32) {
    try {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      const randomValues = new Uint32Array(length);
      window.crypto.getRandomValues(randomValues);
      for (let i = 0; i < length; i++) {
        result += chars[randomValues[i] % chars.length];
      }
      return result;
    } catch (error) {
      console.error('Generate key error:', error);
      return '';
    }
  },

  // 生成UUID
  generateUUID() {
    try {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    } catch (error) {
      console.error('Generate UUID error:', error);
      return '';
    }
  }
};

export default crypto;
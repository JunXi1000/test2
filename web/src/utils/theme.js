import cache from './cache';
import bus, { Events } from './eventBus';

// 主题配置
const defaultConfig = {
  // 主题模式
  mode: 'light',
  // 主题颜色
  colors: {
    primary: '#409EFF',
    success: '#67C23A',
    warning: '#E6A23C',
    danger: '#F56C6C',
    info: '#909399',
    // 文本颜色
    textPrimary: '#303133',
    textRegular: '#606266',
    textSecondary: '#909399',
    textPlaceholder: '#C0C4CC',
    // 边框颜色
    borderBase: '#DCDFE6',
    borderLight: '#E4E7ED',
    borderLighter: '#EBEEF5',
    borderExtraLight: '#F2F6FC',
    // 背景颜色
    bgWhite: '#FFFFFF',
    bgBlack: '#000000',
    bgPrimary: '#F5F7FA'
  },
  // 字体配置
  font: {
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    size: '14px',
    lineHeight: '1.5',
    weight: '400'
  },
  // 圆角配置
  borderRadius: {
    base: '4px',
    small: '2px',
    round: '20px',
    circle: '100%'
  },
  // 阴影配置
  boxShadow: {
    base: '0 2px 4px rgba(0, 0, 0, 0.12), 0 0 6px rgba(0, 0, 0, 0.04)',
    light: '0 2px 12px 0 rgba(0, 0, 0, 0.1)',
    lighter: '0 2px 12px 0 rgba(0, 0, 0, 0.1)',
    dark: '0 2px 4px rgba(0, 0, 0, 0.12), 0 0 6px rgba(0, 0, 0, 0.04)'
  },
  // 过渡配置
  transition: {
    all: 'all .3s cubic-bezier(.645,.045,.355,1)',
    fade: 'opacity .3s cubic-bezier(.645,.045,.355,1)',
    transform: 'transform .3s cubic-bezier(.645,.045,.355,1)'
  },
  // 响应式断点
  breakpoints: {
    xs: '480px',
    sm: '576px',
    md: '768px',
    lg: '992px',
    xl: '1200px',
    xxl: '1600px'
  }
};

// 暗色主题配置
const darkConfig = {
  mode: 'dark',
  colors: {
    primary: '#409EFF',
    success: '#67C23A',
    warning: '#E6A23C',
    danger: '#F56C6C',
    info: '#909399',
    // 文本颜色
    textPrimary: '#FFFFFF',
    textRegular: '#E5EAF3',
    textSecondary: '#A3A6AD',
    textPlaceholder: '#8896B3',
    // 边框颜色
    borderBase: '#4C4D4F',
    borderLight: '#363637',
    borderLighter: '#2B2B2C',
    borderExtraLight: '#1F1F1F',
    // 背景颜色
    bgWhite: '#1F1F1F',
    bgBlack: '#000000',
    bgPrimary: '#18181A'
  }
};

// 主题管理类
class ThemeManager {
  constructor() {
    this.config = { ...defaultConfig };
    this.init();
  }

  // 初始化主题
  init() {
    // 从缓存中获取主题配置
    const cachedTheme = cache.local.get('theme');
    if (cachedTheme) {
      this.config = { ...this.config, ...cachedTheme };
    }

    // 监听系统主题变化
    this.watchSystemTheme();

    // 应用主题
    this.applyTheme();
  }

  // 监听系统主题变化
  watchSystemTheme() {
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addListener(e => {
        if (e.matches) {
          this.setMode('dark');
        } else {
          this.setMode('light');
        }
      });
    }
  }

  // 设置主题模式
  setMode(mode) {
    if (mode === 'dark') {
      this.config = { ...this.config, ...darkConfig };
    } else {
      this.config = { ...defaultConfig };
    }
    this.applyTheme();
    cache.local.set('theme', this.config);
    bus.emit(Events.THEME_CHANGED, { mode });
  }

  // 设置主题颜色
  setColor(key, value) {
    if (this.config.colors[key]) {
      this.config.colors[key] = value;
      this.applyTheme();
      cache.local.set('theme', this.config);
      bus.emit(Events.THEME_COLOR_CHANGED, { key, value });
    }
  }

  // 应用主题
  applyTheme() {
    const style = document.documentElement.style;

    // 应用颜色
    Object.entries(this.config.colors).forEach(([key, value]) => {
      style.setProperty(`--color-${key}`, value);
    });

    // 应用字体
    style.setProperty('--font-family', this.config.font.family);
    style.setProperty('--font-size', this.config.font.size);
    style.setProperty('--line-height', this.config.font.lineHeight);
    style.setProperty('--font-weight', this.config.font.weight);

    // 应用圆角
    Object.entries(this.config.borderRadius).forEach(([key, value]) => {
      style.setProperty(`--border-radius-${key}`, value);
    });

    // 应用阴影
    Object.entries(this.config.boxShadow).forEach(([key, value]) => {
      style.setProperty(`--box-shadow-${key}`, value);
    });

    // 应用过渡
    Object.entries(this.config.transition).forEach(([key, value]) => {
      style.setProperty(`--transition-${key}`, value);
    });

    // 应用响应式断点
    Object.entries(this.config.breakpoints).forEach(([key, value]) => {
      style.setProperty(`--breakpoint-${key}`, value);
    });

    // 设置主题模式类名
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.documentElement.classList.add(`theme-${this.config.mode}`);
  }

  // 获取主题配置
  getConfig() {
    return { ...this.config };
  }

  // 重置主题
  reset() {
    this.config = { ...defaultConfig };
    this.applyTheme();
    cache.local.remove('theme');
    bus.emit(Events.THEME_RESET);
  }

  // 导出主题配置
  export() {
    return JSON.stringify(this.config, null, 2);
  }

  // 导入主题配置
  import(config) {
    try {
      const newConfig = typeof config === 'string' ? JSON.parse(config) : config;
      this.config = { ...this.config, ...newConfig };
      this.applyTheme();
      cache.local.set('theme', this.config);
      bus.emit(Events.THEME_IMPORTED, this.config);
      return true;
    } catch (error) {
      console.error('Import theme config failed:', error);
      return false;
    }
  }
}

// 创建主题管理实例
const theme = new ThemeManager();

export default theme;
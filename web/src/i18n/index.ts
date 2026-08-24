/**
 * i18n 实例
 *
 * 界面语言固定为 English（中英文切换功能已移除）。
 */
import { createI18n } from 'vue-i18n'
import en from './locales/en'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
})

export default i18n

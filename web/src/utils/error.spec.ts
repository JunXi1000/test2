import { describe, expect, it } from 'vitest'
import { toErrorMessage } from './error'

describe('toErrorMessage', () => {
  it('优先取 Error.message —— 拦截器已把后端具体原因写在这里', () => {
    expect(toErrorMessage(new Error('用户名或密码错误'), '请求失败')).toBe('用户名或密码错误')
  })

  it('message 为空白时退回兜底', () => {
    expect(toErrorMessage(new Error(''), '请求失败')).toBe('请求失败')
    expect(toErrorMessage(new Error('   '), '请求失败')).toBe('请求失败')
  })

  it('去掉 message 两端空白', () => {
    expect(toErrorMessage(new Error('  boom  '), '请求失败')).toBe('boom')
  })

  it('字符串抛出物按原样用', () => {
    expect(toErrorMessage('raw failure', '请求失败')).toBe('raw failure')
    expect(toErrorMessage('   ', '请求失败')).toBe('请求失败')
  })

  it('形如 { message } 的非 Error 对象也认（库边界）', () => {
    expect(toErrorMessage({ message: 'from object' }, '请求失败')).toBe('from object')
    expect(toErrorMessage({ message: 42 }, '请求失败')).toBe('请求失败')
    expect(toErrorMessage({ message: '  ' }, '请求失败')).toBe('请求失败')
  })

  it('其余一切（null / undefined / 数字 / 无 message 的对象）都退回兜底', () => {
    for (const value of [null, undefined, 0, false, Symbol('x'), {}, [], new Map()]) {
      expect(toErrorMessage(value, '请求失败')).toBe('请求失败')
    }
  })
})

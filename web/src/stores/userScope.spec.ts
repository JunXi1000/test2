import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_USER_KEY } from '@/auth/session'
import { getStorageScope, notifyUserScopeChange, onUserScopeChange, scopedKey } from './userScope'

/** 模拟"已登录某用户"，与 auth store 写的是同一个 key */
function loginAs(id: number | string) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id }))
}

describe('getStorageScope：作用域判定', () => {
  beforeEach(() => localStorage.clear())

  it('未登录 → guest', () => {
    expect(getStorageScope()).toBe('guest')
  })

  it('已登录 → 按用户 id 分作用域', () => {
    loginAs(7)
    expect(getStorageScope()).toBe('u7')
  })

  it('存的是非 JSON 脏数据 → 退回 guest，而不是抛错', () => {
    // 真实场景：旧版本或其它代码往同一 key 写过裸字符串
    localStorage.setItem(AUTH_USER_KEY, 'not-json{')
    expect(() => getStorageScope()).not.toThrow()
    expect(getStorageScope()).toBe('guest')
  })

  it('对象里缺 id → 退回 guest', () => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ name: 'someone' }))
    expect(getStorageScope()).toBe('guest')
  })

  it('id 为 null → 退回 guest（!= null 判断覆盖 null 与 undefined）', () => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: null }))
    expect(getStorageScope()).toBe('guest')
  })
})

describe('跨用户隔离：这是本模块存在的唯一理由', () => {
  beforeEach(() => localStorage.clear())

  it('A 用户写的数据，切到 B 用户后读不到', () => {
    loginAs(1)
    const keyOfA = scopedKey('nexus_cart')
    localStorage.setItem(keyOfA, JSON.stringify([{ id: 'secret-of-a' }]))

    loginAs(2)
    const keyOfB = scopedKey('nexus_cart')

    expect(keyOfB).not.toBe(keyOfA)
    expect(localStorage.getItem(keyOfB)).toBeNull()
  })

  it('切回原用户仍能读回自己的数据（隔离不等于清空）', () => {
    loginAs(1)
    localStorage.setItem(scopedKey('nexus_cart'), JSON.stringify([{ id: 'a' }]))
    loginAs(2)
    loginAs(1)
    expect(JSON.parse(localStorage.getItem(scopedKey('nexus_cart')) ?? '[]')).toEqual([{ id: 'a' }])
  })

  it('登出后看不到任何已登录用户的数据', () => {
    loginAs(1)
    localStorage.setItem(scopedKey('nexus_wishlist'), JSON.stringify([{ id: 'a' }]))
    // clearAuthStorage() 的行为：移掉 AUTH_USER_KEY
    localStorage.removeItem(AUTH_USER_KEY)

    expect(scopedKey('nexus_wishlist')).toBe('nexus_wishlist_guest')
    expect(localStorage.getItem(scopedKey('nexus_wishlist'))).toBeNull()
  })

  it('guest 数据不会泄漏给登录用户', () => {
    // 未登录时写入
    localStorage.setItem(scopedKey('nexus_cart'), JSON.stringify([{ id: 'guest-item' }]))
    loginAs(9)
    expect(localStorage.getItem(scopedKey('nexus_cart'))).toBeNull()
  })
})

describe('notifyUserScopeChange：广播', () => {
  it('通知到每一个订阅者', () => {
    const a = vi.fn()
    const b = vi.fn()
    const offA = onUserScopeChange(a)
    const offB = onUserScopeChange(b)
    try {
      notifyUserScopeChange()
      expect(a).toHaveBeenCalledTimes(1)
      expect(b).toHaveBeenCalledTimes(1)
    } finally {
      offA()
      offB()
    }
  })

  it('单个订阅者抛错不阻断其余订阅者', () => {
    const boom = vi.fn(() => {
      throw new Error('store 重载失败')
    })
    const good = vi.fn()
    const offBoom = onUserScopeChange(boom)
    const offGood = onUserScopeChange(good)
    try {
      expect(() => notifyUserScopeChange()).not.toThrow()
      expect(boom).toHaveBeenCalledTimes(1)
      expect(good).toHaveBeenCalledTimes(1)
    } finally {
      offBoom()
      offGood()
    }
  })

  it('取消订阅后不再收到通知', () => {
    const fn = vi.fn()
    const off = onUserScopeChange(fn)
    off()
    notifyUserScopeChange()
    expect(fn).not.toHaveBeenCalled()
  })

  it('重复调用取消订阅函数不会报错，也不会误删他人订阅', () => {
    const a = vi.fn()
    const b = vi.fn()
    const offA = onUserScopeChange(a)
    const offB = onUserScopeChange(b)
    try {
      offA()
      expect(() => offA()).not.toThrow()
      notifyUserScopeChange()
      expect(a).not.toHaveBeenCalled()
      expect(b).toHaveBeenCalledTimes(1)
    } finally {
      offB()
    }
  })
})

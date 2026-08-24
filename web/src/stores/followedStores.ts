/**
 * 关注店铺 store（阶段 1.2）
 *
 * 用户可关注商家店铺，关注列表按用户作用域隔离存储于 localStorage，
 * 登录/登出时通过 userScope 广播自动重载。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { onUserScopeChange, scopedKey } from './userScope'

export interface FollowedStore {
  id: string
  storeName: string
  avatar: string
  /** 关注时的粉丝数快照（用于展示） */
  followers?: number
  followedAt: number
}

const STORAGE_KEY = 'nexus_followed_stores'

function loadFromStorage(): FollowedStore[] {
  try {
    const raw = localStorage.getItem(scopedKey(STORAGE_KEY))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const useFollowedStores = defineStore('followedStores', () => {
  const items = ref<FollowedStore[]>(loadFromStorage())

  function persist() {
    try {
      localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(items.value))
    } catch { /* storage full / unavailable */ }
  }

  function isFollowing(id: string): boolean {
    return items.value.some(s => s.id === id)
  }

  /** 关注店铺，返回是否为新关注（用于 toast 文案） */
  function follow(store: { id: string; storeName: string; avatar?: string; followers?: number }): boolean {
    if (isFollowing(store.id)) return false
    items.value.push({
      id: store.id,
      storeName: store.storeName,
      avatar: store.avatar || '',
      followers: store.followers,
      followedAt: Date.now(),
    })
    persist()
    return true
  }

  function unfollow(id: string): boolean {
    const existed = isFollowing(id)
    items.value = items.value.filter(s => s.id !== id)
    if (existed) persist()
    return existed
  }

  function toggle(store: { id: string; storeName: string; avatar?: string; followers?: number }): boolean {
    return isFollowing(store.id) ? unfollow(store.id) : follow(store)
  }

  function clear() {
    items.value = []
    persist()
  }

  // 登录/登出时按新用户作用域重新加载
  onUserScopeChange(() => {
    items.value = loadFromStorage()
  })

  return { items, isFollowing, follow, unfollow, toggle, clear }
})

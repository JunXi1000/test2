import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '@/types/product'
import { AUTH_USER_KEY } from '@/auth/session'

vi.mock('@/config/env', () => ({ USE_MOCK: true }))
vi.mock('@/api/http', () => ({ get: vi.fn(), post: vi.fn() }))

// 用固定商品集替换 mock 数据源：getSearchSuggestions / searchProducts 都走
// `await import('./product.mock')`，替换后断言才是确定的。
// 必须用 vi.hoisted —— 否则 vi.mock 的工厂会在 FIXTURE 初始化之前执行。
const { FIXTURE } = vi.hoisted(() => {
  const FIXTURE: Product[] = [
    {
      id: 1,
      title: 'iPhone 15 Pro',
      price: 999,
      category: 'Electronics',
      image: 'iphone.jpg',
      rating: 4.8,
    },
    {
      id: 2,
      title: 'iPhone 14 Case',
      price: 29,
      category: 'Accessories',
      image: 'case.jpg',
      rating: 4.2,
    },
    {
      id: 3,
      title: 'Galaxy S24',
      price: 50,
      category: 'Electronics',
      image: 'galaxy.jpg',
      rating: 3.5,
    },
    {
      id: 4,
      title: 'USB-C Hub Pro',
      price: 200,
      category: 'Accessories',
      image: 'hub.jpg',
      rating: 5,
    },
    {
      id: 5,
      title: 'Cheap Cable',
      price: 49.99,
      category: 'Accessories',
      image: 'cable.jpg',
      rating: 1,
    },
    { id: 6, title: 'Luxury Monitor', price: 1000, category: 'Electronics', image: 'monitor.jpg' },
    {
      id: 7,
      title: 'Mid Tablet',
      price: 300,
      category: 'Tablets',
      image: 'tablet.jpg',
      rating: 2.5,
    },
  ]
  return { FIXTURE }
})

vi.mock('./product.mock', () => ({
  getMockProducts: () => FIXTURE,
  shuffleMockProducts: (list: Product[]) => list,
}))

import {
  addSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  getSearchSuggestions,
  removeSearchHistory,
  searchProducts,
} from './search'

// q: '' 会跳过关键词过滤（源码里是 `if (q)`），用来隔离出其它维度
const ALL = { q: '', limit: 100 } as const

function loginAs(id: number) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id }))
}

describe('searchProducts：筛选维度', () => {
  it('q 同时匹配标题与分类名', async () => {
    const byTitle = await searchProducts({ q: 'phone', limit: 100 })
    expect(byTitle.products.map((p) => p.id)).toEqual([1, 2])

    const byCategory = await searchProducts({ q: 'electronics', limit: 100 })
    expect(byCategory.total).toBe(3)
  })

  it('category 是精确匹配，不是包含匹配', async () => {
    const r = await searchProducts({ q: '', category: 'Electronic', limit: 100 })
    expect(r.total).toBe(0)
  })

  it('priceMin / priceMax 都是闭区间', async () => {
    const r = await searchProducts({ q: '', priceMin: 50, priceMax: 200, limit: 100 })
    expect(r.products.map((p) => p.price).sort((a, b) => a - b)).toEqual([50, 200])
  })

  it('rating 是 >= 阈值，无评分的商品按 0 处理而被排除', async () => {
    const r = await searchProducts({ q: '', rating: 4, limit: 100 })
    expect(r.products.map((p) => p.id).sort((a, b) => a - b)).toEqual([1, 2, 4])
  })

  it('多个维度是叠加（与）关系', async () => {
    const r = await searchProducts({ q: '', category: 'Accessories', priceMax: 100, limit: 100 })
    expect(r.products.map((p) => p.id).sort((a, b) => a - b)).toEqual([2, 5])
  })
})

describe('searchProducts：排序', () => {
  it('price-asc', async () => {
    const r = await searchProducts({ q: '', sort: 'price-asc', limit: 100 })
    expect(r.products.map((p) => p.price)).toEqual([29, 49.99, 50, 200, 300, 999, 1000])
  })

  it('price-desc', async () => {
    const r = await searchProducts({ q: '', sort: 'price-desc', limit: 100 })
    expect(r.products.map((p) => p.price)).toEqual([1000, 999, 300, 200, 50, 49.99, 29])
  })

  it('rating 降序，无评分的排最后（按 0 参与比较）', async () => {
    const r = await searchProducts({ q: '', sort: 'rating', limit: 100 })
    expect(r.products.map((p) => p.rating ?? 0)).toEqual([5, 4.8, 4.2, 3.5, 2.5, 1, 0])
  })

  it('未知 sort 值不改动顺序（保持数据源原序）', async () => {
    const r = await searchProducts({ q: '', sort: 'bogus', limit: 100 })
    expect(r.products.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})

describe('searchProducts：分页', () => {
  it('total 是过滤后的总数，不是当前页条数', async () => {
    const r = await searchProducts({ q: '', limit: 3, page: 1, sort: 'price-asc' })
    expect(r.products.map((p) => p.price)).toEqual([29, 49.99, 50])
    expect(r.total).toBe(7)
  })

  it('第二页接着第一页', async () => {
    const r = await searchProducts({ q: '', limit: 3, page: 2, sort: 'price-asc' })
    expect(r.products.map((p) => p.price)).toEqual([200, 300, 999])
  })

  it('超出末页返回空数组，但 total 仍是总数', async () => {
    const r = await searchProducts({ q: '', limit: 3, page: 99 })
    expect(r.products).toEqual([])
    expect(r.total).toBe(7)
  })

  it('默认 limit 是 20', async () => {
    const r = await searchProducts({ q: '' })
    expect(r.products).toHaveLength(7)
  })
})

describe('searchProducts：facets 基于过滤后的结果集重算', () => {
  it('价格区间是左闭右开，端点归入上一档', async () => {
    const r = await searchProducts(ALL)
    const counts = Object.fromEntries(r.facets.priceRanges.map((x) => [x.label, x.count]))
    expect(counts).toEqual({
      'Under $50': 2, // 29, 49.99
      '$50 - $200': 1, // 50（50 归此档，不进 Under $50）
      '$200 - $500': 2, // 200, 300
      '$500 - $1000': 1, // 999
      'Over $1000': 1, // 1000
    })
  })

  it('按分类过滤后，分类 facet 只剩被选中的那一项', async () => {
    const r = await searchProducts({ q: '', category: 'Electronics', limit: 100 })
    expect(r.facets.categories).toEqual([{ name: 'Electronics', count: 3 }])
  })

  it('评分分桶是 >= 语义：评分 5 归入 4 分档', async () => {
    const r = await searchProducts(ALL)
    expect(r.facets.ratings).toEqual([
      { value: 4, count: 3 }, // 4.8, 4.2, 5
      { value: 3, count: 1 }, // 3.5
      { value: 2, count: 1 }, // 2.5
    ])
  })

  it('计数为 0 的档位会被剔除（facet 不会出现空档）', async () => {
    const r = await searchProducts({ q: '', priceMin: 1000, limit: 100 })
    expect(r.facets.priceRanges).toEqual([{ label: 'Over $1000', min: 1000, max: null, count: 1 }])
    expect(r.facets.ratings).toEqual([]) // 唯一的商品没有评分
  })

  it('relatedSearches 最多 5 条，且不含被搜索词本身', async () => {
    const r = await searchProducts({ q: 'monitor', limit: 100 })
    expect(r.relatedSearches.length).toBeLessThanOrEqual(5)
    expect(r.relatedSearches).not.toContain('monitor')
  })
})

describe('getSearchSuggestions：关键词缓存', () => {
  it('返回以查询词开头的关键词，按字典序', async () => {
    const r = await getSearchSuggestions('ca')
    expect(r.keywords).toEqual(['cable', 'case'])
  })

  it('分类名也会进入缓存（小写）', async () => {
    const r = await getSearchSuggestions('acc')
    expect(r.keywords).toEqual(['accessories'])
  })

  it('关键词不含查询词自身', async () => {
    const r = await getSearchSuggestions('iphone')
    expect(r.keywords).toEqual([])
  })

  it('关键词最多 6 条', async () => {
    const r = await getSearchSuggestions('')
    expect(r.keywords).toHaveLength(6)
  })

  it('商品建议最多 4 条，且只带 id/title/price/image', async () => {
    const r = await getSearchSuggestions('')
    expect(r.products).toHaveLength(4)
    expect(r.products[0]).toEqual({
      id: 1,
      title: 'iPhone 15 Pro',
      price: 999,
      image: 'iphone.jpg',
    })
  })

  it('商品建议按标题包含匹配', async () => {
    const r = await getSearchSuggestions('pro')
    expect(r.products.map((p) => p.id)).toEqual([1, 4])
  })
})

describe('搜索历史：按用户作用域隔离', () => {
  beforeEach(() => localStorage.clear())

  it('新搜索排最前', () => {
    addSearchHistory('apple')
    addSearchHistory('banana')
    expect(getSearchHistory()).toEqual(['banana', 'apple'])
  })

  it('重复搜索去重并提到最前（忽略大小写）', () => {
    addSearchHistory('apple')
    addSearchHistory('banana')
    addSearchHistory('APPLE')
    expect(getSearchHistory()).toEqual(['APPLE', 'banana'])
  })

  it('忽略纯空白输入', () => {
    addSearchHistory('   ')
    expect(getSearchHistory()).toEqual([])
  })

  it('裁掉两端空白', () => {
    addSearchHistory('  apple  ')
    expect(getSearchHistory()).toEqual(['apple'])
  })

  it('最多保留 20 条，超出丢弃最旧的', () => {
    for (let i = 1; i <= 25; i++) addSearchHistory(`q${i}`)
    const history = getSearchHistory()
    expect(history).toHaveLength(20)
    expect(history[0]).toBe('q25')
    expect(history).toContain('q6')
    expect(history).not.toContain('q5')
  })

  it('跨用户互不可见', () => {
    loginAs(1)
    addSearchHistory('secret-of-user-1')
    loginAs(2)
    expect(getSearchHistory()).toEqual([])
  })

  it('clearSearchHistory 只清当前用户', () => {
    loginAs(1)
    addSearchHistory('mine')
    loginAs(2)
    addSearchHistory('theirs')

    clearSearchHistory()
    expect(getSearchHistory()).toEqual([])

    loginAs(1)
    expect(getSearchHistory()).toEqual(['mine'])
  })

  it('removeSearchHistory 是精确匹配，与 addSearchHistory 的忽略大小写不一致', () => {
    // 钉住既有行为：大小写不同删不掉。改动此处会打破这条断言，从而被看见。
    addSearchHistory('Apple')
    removeSearchHistory('apple')
    expect(getSearchHistory()).toEqual(['Apple'])

    removeSearchHistory('Apple')
    expect(getSearchHistory()).toEqual([])
  })

  it('本地存了损坏 JSON 时返回空数组，而不是抛错', () => {
    localStorage.setItem('nexus_search_history_guest', 'broken{')
    expect(() => getSearchHistory()).not.toThrow()
    expect(getSearchHistory()).toEqual([])
  })
})

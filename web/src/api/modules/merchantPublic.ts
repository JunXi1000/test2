import { USE_MOCK } from '@/config/env'
import { get } from '@/api/http'

export interface MerchantPublicProfile {
  id: string
  storeName: string
  avatar: string
  description: string
  verified: boolean
  joinedDate: string
  location: string
  responseTime: string
  stats: {
    rating: number
    totalReviews: number
    totalProducts: number
    totalSales: number
    satisfactionRate: number
    followers: number
  }
  policies: {
    shipping: string
    returns: string
  }
  featuredProducts: MerchantFeaturedProduct[]
}

export interface MerchantFeaturedProduct {
  id: number
  title: string
  price: number
  image: string
  rating: number
  sales: number
  category?: string
}

const MOCK_PROFILES: Record<string, MerchantPublicProfile> = {
  m1: {
    id: 'm1',
    storeName: 'Nike Official Store',
    avatar: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=200&auto=format&fit=crop',
    description: 'Official Nike store. Authentic sneakers, apparel and accessories with worldwide shipping.',
    verified: true,
    joinedDate: '2022-03',
    location: 'Portland, OR',
    responseTime: '< 1 hour',
    stats: {
      rating: 4.9,
      totalReviews: 12840,
      totalProducts: 286,
      totalSales: 58200,
      satisfactionRate: 98,
      followers: 45600
    },
    policies: {
      shipping: 'Free shipping on orders over $100. Standard delivery 3-5 business days.',
      returns: '30-day free returns. Items must be unworn with original tags.'
    },
    featuredProducts: [
      { id: 101, title: 'Air Max 90', price: 130, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=300&auto=format&fit=crop', rating: 4.8, sales: 3200 },
      { id: 102, title: 'React Infinity Run', price: 160, image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=300&auto=format&fit=crop', rating: 4.7, sales: 1800 },
      { id: 103, title: 'Dunk Low Retro', price: 110, image: 'https://images.unsplash.com/photo-1597045566677-8cf032ed6634?q=80&w=300&auto=format&fit=crop', rating: 4.9, sales: 5100 },
      { id: 104, title: 'Air Force 1 \'07', price: 90, image: 'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?q=80&w=300&auto=format&fit=crop', rating: 4.8, sales: 8900 }
    ]
  },
  m2: {
    id: 'm2',
    storeName: 'Adidas Originals',
    avatar: 'https://images.unsplash.com/photo-1518002171953-a080ee802e12?q=80&w=200&auto=format&fit=crop',
    description: 'Adidas Originals — iconic streetwear and performance gear for every lifestyle.',
    verified: true,
    joinedDate: '2021-11',
    location: 'Herzogenaurach, DE',
    responseTime: '< 2 hours',
    stats: {
      rating: 4.7,
      totalReviews: 8420,
      totalProducts: 195,
      totalSales: 34500,
      satisfactionRate: 96,
      followers: 32100
    },
    policies: {
      shipping: 'Free shipping on orders over $80. Express shipping available.',
      returns: '60-day hassle-free returns on all orders.'
    },
    featuredProducts: [
      { id: 201, title: 'Ultraboost 23', price: 190, image: 'https://images.unsplash.com/photo-1518002171953-a080ee802e12?q=80&w=300&auto=format&fit=crop', rating: 4.9, sales: 4200 },
      { id: 202, title: 'Stan Smith', price: 85, image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=300&auto=format&fit=crop', rating: 4.6, sales: 6700 },
      { id: 203, title: 'NMD_R1', price: 140, image: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?q=80&w=300&auto=format&fit=crop', rating: 4.5, sales: 2100 }
    ]
  }
}

export interface StoreProductQuery {
  category?: string
  q?: string
  sort?: 'popular' | 'newest' | 'price-asc' | 'price-desc'
  page?: number
  limit?: number
}

export interface StoreProductsResult {
  items: MerchantFeaturedProduct[]
  total: number
  categories: string[]
}

function buildStoreProducts(merchantId: string): MerchantFeaturedProduct[] {
  const p = MOCK_PROFILES[merchantId]
  if (!p) return []
  const base = p.featuredProducts
  const extras: MerchantFeaturedProduct[] = []
  const categories = ['Footwear', 'Apparel', 'Accessories', 'Sports']
  const adjectives = ['Pro', 'Elite', 'Classic', 'Flex', 'Air', 'Ultra', 'Boost']
  for (let i = 0; i < 20; i++) {
    const src = base[i % base.length]
    extras.push({
      id: src.id + 1000 + i,
      title: `${adjectives[i % adjectives.length]} ${src.title} ${i + 1}`,
      price: Math.floor(src.price * (0.6 + Math.random() * 0.8)),
      image: src.image,
      rating: +(3.5 + Math.random() * 1.5).toFixed(1),
      sales: Math.floor(Math.random() * 5000),
      category: categories[i % categories.length]
    })
  }
  return [...base.map(p => ({ ...p, category: 'Footwear' })), ...extras]
}

export async function getMerchantStoreProducts(
  merchantId: string,
  params?: StoreProductQuery
): Promise<StoreProductsResult> {
  if (USE_MOCK) {
    let items = buildStoreProducts(merchantId)
    const categories = [...new Set(items.map(p => p.category!))].filter(Boolean)

    if (params?.category && params.category !== 'All') {
      items = items.filter(p => p.category === params.category)
    }
    if (params?.q) {
      const q = params.q.toLowerCase()
      items = items.filter(p => p.title.toLowerCase().includes(q))
    }
    if (params?.sort === 'popular') items.sort((a, b) => b.sales - a.sales)
    else if (params?.sort === 'newest') items.sort((a, b) => b.id - a.id)
    else if (params?.sort === 'price-asc') items.sort((a, b) => a.price - b.price)
    else if (params?.sort === 'price-desc') items.sort((a, b) => b.price - a.price)

    const total = items.length
    const page = params?.page || 1
    const limit = params?.limit || 12
    const start = (page - 1) * limit
    items = items.slice(start, start + limit)

    return new Promise(resolve => setTimeout(() => resolve({ items, total, categories }), 400))
  }
  return get<StoreProductsResult>(`/merchants/${merchantId}/products`, { params })
}

export async function getMerchantPublicProfile(merchantId: string): Promise<MerchantPublicProfile> {
  if (USE_MOCK) {
    const profile = MOCK_PROFILES[merchantId]
    if (!profile) {
      return Promise.resolve({
        id: merchantId,
        storeName: 'Unknown Store',
        avatar: '',
        description: '',
        verified: false,
        joinedDate: '2024-01',
        location: 'Unknown',
        responseTime: 'N/A',
        stats: { rating: 0, totalReviews: 0, totalProducts: 0, totalSales: 0, satisfactionRate: 0, followers: 0 },
        policies: { shipping: 'Contact store for details.', returns: 'Contact store for details.' },
        featuredProducts: []
      })
    }
    return new Promise(resolve => setTimeout(() => resolve(profile), 300))
  }
  return get<MerchantPublicProfile>(`/merchants/${merchantId}/profile`)
}

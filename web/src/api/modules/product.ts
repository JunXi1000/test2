import { USE_MOCK } from '@/config/env'
import { get } from '@/api/http'
import type { Product } from '@/types/product'

export interface ProductQuery {
  category?: string
  q?: string
  sort?: 'price-asc' | 'price-desc' | 'default'
  page?: number
  limit?: number
}

async function loadMockProducts() {
  const { getMockProducts, shuffleMockProducts } = await import('./product.mock')
  return { products: getMockProducts(), shuffle: shuffleMockProducts }
}

let shuffledOnce = false

export async function getProducts(params?: ProductQuery): Promise<Product[]> {
  if (USE_MOCK) {
    const { products, shuffle } = await loadMockProducts()

    if (!shuffledOnce) {
      shuffle(products)
      shuffledOnce = true
    }

    let result = [...products]
    if (params?.category && params.category !== 'All') {
      result = result.filter(p => p.category === params.category)
    }
    if (params?.q) {
      const q = params.q.toLowerCase()
      result = result.filter(p => p.title.toLowerCase().includes(q))
    }
    if (params?.sort === 'price-asc') result.sort((a, b) => a.price - b.price)
    else if (params?.sort === 'price-desc') result.sort((a, b) => b.price - a.price)

    const page = params?.page || 1
    const limit = params?.limit || 20
    const start = (page - 1) * limit
    const end = start + limit

    return result.slice(start, end)
  }
  return get<Product[]>('/products', { params })
}

export async function getCategoryCounts(): Promise<Record<string, number>> {
  if (USE_MOCK) {
    const { products } = await loadMockProducts()
    const counts: Record<string, number> = {}
    for (const p of products) {
      const cat = p.category || 'Other'
      counts[cat] = (counts[cat] || 0) + 1
    }
    return counts
  }
  return get<Record<string, number>>('/products/category-counts')
}

interface CategoryVariant {
  colors?: Array<{ name: string; value?: string }>
  sizes?: string[]
  specLabel?: string
  description: string
  features: string[]
}

const CATEGORY_VARIANTS: Record<string, CategoryVariant> = {
  Phones: {
    colors: [
      { name: 'Midnight Black', value: '#1a1a1a' },
      { name: 'Titanium Gray', value: '#8a8a8a' },
      { name: 'Sierra Blue', value: '#6b8fad' },
      { name: 'Purple', value: '#7c3aed' },
      { name: 'Gold', value: '#c9a84c' },
      { name: 'Green', value: '#4a7c59' },
      { name: 'Pink', value: '#ec8fa3' },
      { name: 'Red', value: '#c53030' }
    ],
    sizes: ['64GB', '128GB', '256GB', '512GB', '1TB'],
    specLabel: 'Storage',
    description: 'Flagship smartphone with pro-grade camera, all-day battery life, and an edge-to-edge OLED display that brings every detail to life.',
    features: ['48MP triple-camera system', '6.7" Super AMOLED 120Hz display', '5000mAh battery', '5G connectivity', 'IP68 water resistance']
  },
  Laptops: {
    colors: [
      { name: 'Space Gray', value: '#4a4a4a' },
      { name: 'Silver', value: '#c0c0c0' }
    ],
    sizes: ['16GB / 512GB', '32GB / 1TB', '64GB / 2TB'],
    specLabel: 'Configuration',
    description: 'High-performance laptop designed for creators and gamers, with dedicated GPU and a display that covers the full DCI-P3 color gamut.',
    features: ['Latest-gen CPU', 'Dedicated RTX graphics', '165Hz display', 'Thunderbolt 4 ports', 'Up to 10hr battery']
  },
  Tablets: {
    colors: [
      { name: 'Silver', value: '#c0c0c0' },
      { name: 'Space Gray', value: '#4a4a4a' }
    ],
    sizes: ['64GB WiFi', '128GB WiFi', '256GB WiFi+Cellular'],
    specLabel: 'Storage & Connectivity',
    description: 'Versatile tablet with a stunning Liquid Retina display, perfect for reading, drawing, and productivity on the go.',
    features: ['10.9" Liquid Retina display', 'Apple Pencil support', 'All-day battery', 'USB-C connectivity', 'Stereo speakers']
  },
  Audio: {
    colors: [
      { name: 'Matte Black', value: '#222222' },
      { name: 'Cloud White', value: '#f5f5f0' },
      { name: 'Navy Blue', value: '#2c3e6b' }
    ],
    description: 'Immersive audio experience with active noise cancellation, crystal-clear sound, and a comfortable design for all-day listening.',
    features: ['Active Noise Cancellation', 'Up to 30hr playback', 'Hi-Res Audio certified', 'Multi-device pairing', 'Quick charge (10min = 3hr)']
  },
  Watches: {
    colors: [
      { name: 'Graphite', value: '#383838' },
      { name: 'Starlight', value: '#e8dccf' },
      { name: 'Silver', value: '#c0c0c0' }
    ],
    sizes: ['41mm', '45mm'],
    specLabel: 'Case Size',
    description: 'Smart watch with health monitoring, fitness tracking, and seamless integration with your phone. Water-resistant and built for everyday wear.',
    features: ['Heart rate & SpO2 monitor', 'GPS tracking', 'Always-on display', '5ATM water resistance', '7-day battery life']
  },
  Wearables: {
    colors: [
      { name: 'Black', value: '#1a1a1a' },
      { name: 'Silver', value: '#c0c0c0' },
      { name: 'Rose Gold', value: '#b76e79' }
    ],
    sizes: ['S', 'M', 'L'],
    specLabel: 'Band Size',
    description: 'Lightweight wearable that tracks your fitness goals, sleep quality, and daily activity with precision sensors.',
    features: ['24/7 health tracking', 'Sleep analysis', 'Water-resistant design', '14-day battery life', 'AMOLED touchscreen']
  },
  Electronics: {
    colors: [
      { name: 'Black', value: '#1a1a1a' },
      { name: 'White', value: '#f0f0f0' }
    ],
    description: 'Cutting-edge electronics engineered for performance and reliability. Built with premium materials to deliver an exceptional experience.',
    features: ['High-performance chipset', 'Energy efficient design', 'Premium build quality', 'Smart connectivity', '2-year warranty']
  },
  'Smart Home': {
    colors: [
      { name: 'White', value: '#f5f5f5' },
      { name: 'Charcoal', value: '#3a3a3a' }
    ],
    description: 'Smart home device that works with your favorite voice assistants. Easy setup, reliable automation, and energy-saving intelligence.',
    features: ['Voice assistant compatible', 'WiFi & Bluetooth', 'App remote control', 'Energy-saving mode', 'Easy 5-min setup']
  },
  Office: {
    colors: [
      { name: 'Walnut', value: '#5c3d2e' },
      { name: 'Oak', value: '#c2a278' },
      { name: 'Matte White', value: '#f0ede8' }
    ],
    sizes: ['120cm', '140cm', '160cm'],
    specLabel: 'Size',
    description: 'Ergonomically designed for long work sessions. Premium materials and a clean aesthetic complement any workspace.',
    features: ['Ergonomic design', 'Cable management system', 'Scratch-resistant surface', 'Easy assembly', '5-year warranty']
  },
  Drones: {
    colors: [
      { name: 'Arctic White', value: '#e8e8e8' },
      { name: 'Gray', value: '#7a7a7a' }
    ],
    sizes: ['Standard', 'Fly More Combo'],
    specLabel: 'Package',
    description: 'Professional-grade aerial camera drone with obstacle avoidance and 4K stabilized video. Perfect for content creators and adventurers.',
    features: ['4K/60fps Gimbal Camera', '45-min flight time', 'Omnidirectional obstacle sensing', 'GPS return-to-home', '12km transmission range']
  },
  Cameras: {
    colors: [
      { name: 'Black', value: '#1a1a1a' },
      { name: 'Silver', value: '#b0b0b0' }
    ],
    sizes: ['Body Only', 'With Kit Lens'],
    specLabel: 'Bundle',
    description: 'Capture stunning photos and videos in any condition. Fast autofocus, weather-sealed body, and cinema-quality output.',
    features: ['High-resolution sensor', '4K video recording', 'Fast hybrid autofocus', 'Weather-sealed body', 'Dual card slots']
  },
  Monitors: {
    sizes: ['2K (QHD)', '4K (UHD)'],
    specLabel: 'Resolution',
    description: 'Color-accurate display with wide color gamut and high refresh rate. Ideal for professionals and gamers alike.',
    features: ['IPS / OLED panel', '165Hz refresh rate', 'HDR600 support', 'USB-C power delivery', 'Height-adjustable stand']
  },
  Accessories: {
    colors: [
      { name: 'Black', value: '#1a1a1a' },
      { name: 'White', value: '#f0f0f0' },
      { name: 'Space Gray', value: '#6e6e6e' },
      { name: 'Navy', value: '#1e3a5f' },
      { name: 'Pink', value: '#f5a3b8' },
      { name: 'Red', value: '#cc2936' },
      { name: 'Forest Green', value: '#2d6a4f' },
      { name: 'Lavender', value: '#b4a7d6' },
      { name: 'Orange', value: '#e8772e' }
    ],
    description: 'Essential accessory designed to boost your productivity. Compact, reliable, and built to last.',
    features: ['Universal compatibility', 'Plug-and-play setup', 'Compact & portable', 'Durable construction', '18-month warranty']
  },
  Networking: {
    colors: [
      { name: 'White', value: '#f5f5f5' },
      { name: 'Black', value: '#1a1a1a' }
    ],
    sizes: ['AX3000', 'AX5400', 'AX6000'],
    specLabel: 'Speed Tier',
    description: 'Next-gen WiFi router delivering blazing-fast speeds and wall-to-wall coverage for all your connected devices.',
    features: ['WiFi 6E support', 'Mesh-ready', 'Parental controls', 'VPN built-in', 'Covers up to 3000 sq ft']
  }
}

/** Keys aligned with mock `getProductById` enrichment — use in merchant category picker so storefront detail matches. */
export const PRODUCT_STORE_CATEGORIES: readonly string[] = Object.keys(CATEGORY_VARIANTS)

export async function getProductById(id: number): Promise<Product> {
  if (USE_MOCK) {
    const { products } = await loadMockProducts()
    const item = products.find(p => p.id === id)
    if (!item) throw new Error('Product not found')

    const cat = item.category || 'Electronics'
    const variant = CATEGORY_VARIANTS[cat] || CATEGORY_VARIANTS.Electronics

    const enriched: Product = {
      ...item,
      images: [item.image, item.image, item.image],
      description: variant.description,
      rating: +(3.8 + (id % 13) * 0.1).toFixed(1),
      reviews: 30 + (id * 17) % 400,
      colors: variant.colors,
      sizes: variant.sizes,
      specLabel: variant.specLabel,
      features: variant.features
    }
    return enriched
  }
  return get<Product>(`/products/${id}`)
}

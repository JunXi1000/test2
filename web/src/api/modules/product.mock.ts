import type { Product } from '@/types/product'

const BASE_PRODUCTS: Product[] = [
  { id: 1, title: 'Nexus VR Pro', price: 899, category: 'Electronics', image: 'https://images.unsplash.com/photo-1622979135228-d0a136e145c6?q=80&w=1000&auto=format&fit=crop' },
  { id: 2, title: 'Smart Ring', price: 299, category: 'Wearables', image: 'https://images.unsplash.com/photo-1623998021446-45cd9b269056?q=80&w=1000&auto=format&fit=crop' },
  { id: 3, title: 'Audio Pods X', price: 199, category: 'Audio', image: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?q=80&w=1000&auto=format&fit=crop' },
  { id: 4, title: 'Cyber Watch', price: 399, category: 'Watches', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop' },
  { id: 5, title: 'Minimal Desk', price: 1299, category: 'Office', image: 'https://images.unsplash.com/photo-1595515106967-1434857ed8dd?q=80&w=1000&auto=format&fit=crop' },
  { id: 6, title: 'Ergo Chair', price: 699, category: 'Office', image: 'https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?q=80&w=1000&auto=format&fit=crop' },
  { id: 7, title: 'Drone Air', price: 799, category: 'Drones', image: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?q=80&w=1000&auto=format&fit=crop' },
  { id: 8, title: 'Smart Lamp', price: 129, category: 'Smart Home', image: 'https://images.unsplash.com/photo-1507473888900-52e1adad5420?q=80&w=1000&auto=format&fit=crop' },
  { id: 9, title: 'Mechanical Keyboard', price: 159, category: 'Accessories', image: 'https://images.unsplash.com/photo-1595225476474-87563907a212?q=80&w=1000&auto=format&fit=crop' },
  { id: 10, title: 'Gaming Monitor', price: 499, category: 'Monitors', image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?q=80&w=1000&auto=format&fit=crop' },
  { id: 11, title: 'Wireless Mouse', price: 79, category: 'Accessories', image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?q=80&w=1000&auto=format&fit=crop' },
  { id: 12, title: 'Action Camera', price: 349, category: 'Cameras', image: 'https://images.unsplash.com/photo-1564466021183-a4268fce06fa?q=80&w=1000&auto=format&fit=crop' },
  { id: 13, title: 'Noise Cancelling Headphones', price: 299, category: 'Audio', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1000&auto=format&fit=crop' },
  { id: 14, title: 'Tablet Pro', price: 649, category: 'Tablets', image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?q=80&w=1000&auto=format&fit=crop' },
  { id: 15, title: 'Smart Speaker', price: 99, category: 'Smart Home', image: 'https://images.unsplash.com/photo-1589492477829-5e65395b66cc?q=80&w=1000&auto=format&fit=crop' },
  { id: 16, title: 'Gaming Laptop', price: 1899, category: 'Laptops', image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?q=80&w=1000&auto=format&fit=crop' },
  { id: 17, title: 'Smartphone Ultra', price: 1099, category: 'Phones', image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=1000&auto=format&fit=crop' },
  { id: 18, title: 'Fitness Band', price: 49, category: 'Wearables', image: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?q=80&w=1000&auto=format&fit=crop' },
  { id: 19, title: 'Security Camera', price: 129, category: 'Smart Home', image: 'https://images.unsplash.com/photo-1557324232-b8917d3c3d63?q=80&w=1000&auto=format&fit=crop' },
  { id: 20, title: 'Portable Projector', price: 459, category: 'Electronics', image: 'https://images.unsplash.com/photo-1535016120720-40c6874c3b1c?q=80&w=1000&auto=format&fit=crop' },
  { id: 21, title: 'Smart Thermostat', price: 199, category: 'Smart Home', image: 'https://images.unsplash.com/photo-1567365601292-04e4a0505a79?q=80&w=1000&auto=format&fit=crop' },
  { id: 22, title: 'Robot Vacuum', price: 349, category: 'Smart Home', image: 'https://images.unsplash.com/photo-1563714272638-882a6309539d?q=80&w=1000&auto=format&fit=crop' },
  { id: 23, title: 'Mirrorless Camera', price: 1299, category: 'Cameras', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1000&auto=format&fit=crop' },
  { id: 24, title: 'Ultra-Wide Monitor', price: 899, category: 'Monitors', image: 'https://images.unsplash.com/photo-1551645120-d70bfe84c826?q=80&w=1000&auto=format&fit=crop' },
  { id: 25, title: 'Bluetooth Speaker', price: 79, category: 'Audio', image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?q=80&w=1000&auto=format&fit=crop' },
  { id: 26, title: 'E-Reader', price: 129, category: 'Tablets', image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1000&auto=format&fit=crop' },
  { id: 27, title: 'Power Bank', price: 49, category: 'Accessories', image: 'https://images.unsplash.com/photo-1609592424303-066e8208398e?q=80&w=1000&auto=format&fit=crop' },
  { id: 28, title: 'Streaming Stick', price: 39, category: 'Electronics', image: 'https://images.unsplash.com/photo-1544099858-75feeb57f01e?q=80&w=1000&auto=format&fit=crop' },
  { id: 29, title: 'Smart Doorbell', price: 149, category: 'Smart Home', image: 'https://images.unsplash.com/photo-1558002038-1091a1661116?q=80&w=1000&auto=format&fit=crop' },
  { id: 30, title: 'Laptop Stand', price: 59, category: 'Accessories', image: 'https://images.unsplash.com/photo-1616628188506-411103cee2b9?q=80&w=1000&auto=format&fit=crop' },
  { id: 31, title: 'Webcam 4K', price: 199, category: 'Cameras', image: 'https://images.unsplash.com/photo-1622618991746-fe6004db3a47?q=80&w=1000&auto=format&fit=crop' },
  { id: 32, title: 'USB-C Hub', price: 89, category: 'Accessories', image: 'https://images.unsplash.com/photo-1625842268584-8f3296236761?q=80&w=1000&auto=format&fit=crop' },
  { id: 33, title: 'Wi-Fi Router', price: 249, category: 'Networking', image: 'https://images.unsplash.com/photo-1544197150-b99a580bbcbf?q=80&w=1000&auto=format&fit=crop' },
  { id: 34, title: 'Smart Scale', price: 69, category: 'Smart Home', image: 'https://images.unsplash.com/photo-1576678927484-cc907957088c?q=80&w=1000&auto=format&fit=crop' },
  { id: 35, title: 'Graphics Card', price: 799, category: 'Electronics', image: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?q=80&w=1000&auto=format&fit=crop' }
]

const MOCK_PRODUCTS: Product[] = [...BASE_PRODUCTS]
for (let i = 0; i < 3; i++) {
  BASE_PRODUCTS.forEach(p => {
    MOCK_PRODUCTS.push({
      ...p,
      id: MOCK_PRODUCTS.length + 1,
      title: `${p.title} ${['Plus', 'Max', 'Lite', 'SE'][i % 4]}`,
      price: Math.floor(p.price * (0.8 + Math.random() * 0.4))
    })
  })
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array
}

export function getMockProducts(): Product[] {
  return MOCK_PRODUCTS
}

export function shuffleMockProducts(products: Product[]): Product[] {
  return shuffleArray(products)
}

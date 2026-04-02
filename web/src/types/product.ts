export interface Product {
  id: number
  title: string
  subtitle?: string
  price: number
  category?: string
  image: string
  images?: string[]
  description?: string
  features?: string[]
  colors?: Array<{ name: string; value?: string }>
  sizes?: string[]
  specLabel?: string
  variantImages?: Record<string, string>
  rating?: number
  reviews?: number
}

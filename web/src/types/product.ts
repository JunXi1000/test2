export interface Product {
  id: number
  title: string
  subtitle?: string
  price: number
  category?: string
  /** 真实后端返回的店铺 id(用于 /merchants/:id/profile);mock 数据无此字段 */
  shopId?: number
  shopName?: string
  image: string
  images?: string[]
  /** 演示视频 URL（阶段 4.1）：详情页相册中与图片混排展示 */
  video?: string
  description?: string
  features?: string[]
  colors?: Array<{ name: string; value?: string }>
  sizes?: string[]
  specLabel?: string
  /** 尺码指南（阶段 4.2）：服装类商品为 true，详情页尺码区显示 "Size Guide" 入口 */
  hasSizeGuide?: boolean
  variantImages?: Record<string, string>
  rating?: number
  reviews?: number
}

import { USE_MOCK } from '@/config/env'
import { get, post, put, del } from '@/api/http'
import type { CartItem } from '@/stores/cart'

/** 后端购物车行(shopping_cart 实体,已联 product 冗余名称/主图/价格) */
export interface ShoppingCartRow {
  id: number
  productId: number
  productName?: string | null
  quantity: number
  productMainImg?: string | null
  productPrice?: number | null
}

/**
 * 后端购物车仅按 productId 存行(无颜色/尺寸列),映射到前端时用默认选项。
 * 限制已在 cart store 文档化:登录态颜色/尺寸恒为 Default/Standard。
 */
function mapServerRow(row: ShoppingCartRow): CartItem {
  return {
    serverId: row.id,
    id: row.productId,
    cartItemId: String(row.id),
    title: row.productName || 'Product',
    price: Number(row.productPrice) || 0,
    image: row.productMainImg || '',
    color: 'Default',
    size: 'Standard',
    quantity: row.quantity || 1,
  }
}

/** 拉取当前用户购物车(page 端点已按 userId 过滤;禁用无用户过滤的 /list) */
export async function getCart(): Promise<CartItem[]> {
  if (USE_MOCK) return []
  const page = await get<{ list?: ShoppingCartRow[] }>('/shoppingCart/page', {
    params: { pageNum: 1, pageSize: 100 },
  })
  return (page?.list || []).map(mapServerRow)
}

/** 加入购物车(服务端按 productId+userId 合并数量) */
export async function addCartItem(productId: number, quantity: number): Promise<void> {
  if (USE_MOCK) return
  await post('/shoppingCart/add', { productId, quantity })
}

/** 修改购物车行数量 */
export async function updateCartItem(rowId: number, quantity: number): Promise<void> {
  if (USE_MOCK) return
  await put('/shoppingCart/update', { id: rowId, quantity })
}

/** 批量删除购物车行(服务端已按 userId 过滤,仅删自己的行) */
export async function removeCartItems(rowIds: number[]): Promise<void> {
  if (USE_MOCK) return
  await del('/shoppingCart/delBatch', { data: rowIds })
}

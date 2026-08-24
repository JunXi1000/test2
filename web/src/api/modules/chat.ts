import { get, post, put } from '@/api/http'
import { USE_MOCK } from '@/config/env'
import { useAuthStore } from '@/stores/auth'

export interface Message {
  id: number
  conversationId: number
  senderId: number
  senderType: 'USER' | 'SHOP'
  content: string
  type: 'text' | 'image' | 'attachment'
  fileName?: string
  fileUrl?: string
  isRead: boolean
  createTime: string
}

// Backend Conversation shape (snake_case from DB)
interface BackendConversation {
  id: number
  userId: number
  shopId: number
  productId?: number
  lastMessage: string
  lastMessageTime: string
  userUnreadCount: number
  shopUnreadCount: number
  createTime: string
  userName?: string
  userAvatar?: string
  shopName?: string
  shopAvatar?: string
  productName?: string
  productImage?: string
}

// Frontend conversation shape (used by components)
export interface Conversation {
  id: string
  participantId: string
  participantName: string
  participantAvatar?: string
  lastMessage: string
  lastMessageTime: number
  unreadCount: number
  productId?: number
  productName?: string
  productImage?: string
}

function isMerchant(): boolean {
  const auth = useAuthStore()
  return auth.user?.role === 'merchant'
}

// ── Mock 分支 ─────────────────────────────────────────────────────────
// mock 模式(本地 dev / 无后端)下聊天全走本地假数据,避免假 token 打真实
// 后端 /chat/* 触发 401 → 全局拦截器清会话 → 登录死循环。
const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    participantId: '1',
    participantName: 'Customer Support',
    participantAvatar: '',
    lastMessage: 'Hi there! How can we help you today?',
    lastMessageTime: Date.now() - 60_000,
    unreadCount: 1
  }
]

const MOCK_MESSAGES: Message[] = [
  {
    id: 1,
    conversationId: 1,
    senderId: 0,
    senderType: 'SHOP',
    content: 'Hi there! How can we help you today?',
    type: 'text',
    isRead: true,
    createTime: new Date(Date.now() - 60_000).toISOString()
  }
]

function mapConversation(c: BackendConversation): Conversation {
  const merchant = isMerchant()
  return {
    id: String(c.id),
    participantId: merchant ? String(c.userId) : String(c.shopId),
    participantName: (merchant ? c.userName : c.shopName) || 'Unknown',
    participantAvatar: merchant ? c.userAvatar : c.shopAvatar,
    lastMessage: c.lastMessage || '',
    lastMessageTime: c.lastMessageTime ? new Date(c.lastMessageTime).getTime() : Date.now(),
    unreadCount: merchant ? c.shopUnreadCount : c.userUnreadCount,
    productId: c.productId,
    productName: c.productName,
    productImage: c.productImage
  }
}

export async function getConversations(): Promise<Conversation[]> {
  if (USE_MOCK) return MOCK_CONVERSATIONS
  const raw = await get<BackendConversation[]>('/chat/conversations')
  return (raw || []).map(mapConversation)
}

export async function getMessages(conversationId: string | number): Promise<Message[]> {
  if (USE_MOCK) return MOCK_MESSAGES
  return get<Message[]>(`/chat/conversations/${conversationId}/messages`)
}

export async function sendMessage(payload: {
  conversationId?: string | number
  receiverId: string | number
  content: string
  productId?: number
  isMerchant: boolean
}): Promise<Message> {
  if (USE_MOCK) {
    return {
      id: Date.now(),
      conversationId: payload.conversationId ? Number(payload.conversationId) : 1,
      senderId: payload.isMerchant ? 1 : 1,
      senderType: payload.isMerchant ? 'SHOP' : 'USER',
      content: payload.content,
      type: 'text',
      isRead: false,
      createTime: new Date().toISOString()
    }
  }
  return post<Message>('/chat/messages', {
    conversationId: payload.conversationId ? Number(payload.conversationId) : null,
    receiverId: Number(payload.receiverId),
    content: payload.content,
    productId: payload.productId ?? null,
    isMerchant: payload.isMerchant
  })
}

export async function markAsRead(conversationId: string | number): Promise<void> {
  if (USE_MOCK) return
  return put(`/chat/conversations/${conversationId}/read`)
}

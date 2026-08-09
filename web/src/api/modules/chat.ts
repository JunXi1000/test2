import { get, post, put } from '@/api/http'
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
  const raw = await get<BackendConversation[]>('/chat/conversations')
  return (raw || []).map(mapConversation)
}

export async function getMessages(conversationId: string | number): Promise<Message[]> {
  return get<Message[]>(`/chat/conversations/${conversationId}/messages`)
}

export async function sendMessage(payload: {
  conversationId?: string | number
  receiverId: string | number
  content: string
  productId?: number
  isMerchant: boolean
}): Promise<Message> {
  return post<Message>('/chat/messages', {
    conversationId: payload.conversationId ? Number(payload.conversationId) : null,
    receiverId: Number(payload.receiverId),
    content: payload.content,
    productId: payload.productId ?? null,
    isMerchant: payload.isMerchant
  })
}

export async function markAsRead(conversationId: string | number): Promise<void> {
  return put(`/chat/conversations/${conversationId}/read`)
}

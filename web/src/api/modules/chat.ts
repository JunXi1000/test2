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
    unreadCount: 1,
  },
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
    createTime: new Date(Date.now() - 60_000).toISOString(),
  },
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
    productImage: c.productImage,
  }
}

export async function getConversations(): Promise<Conversation[]> {
  if (USE_MOCK) return MOCK_CONVERSATIONS
  const raw = await get<BackendConversation[]>('/chat/conversations')
  return (raw || []).map(mapConversation)
}

export async function getMessages(conversationId: string | number): Promise<Message[]> {
  // 必须按会话过滤、且返回**累积**数组：原先无脑返回上面那个常量，
  // 于是发出去的消息在下一次 getMessages 时凭空消失 —— 两个页面发完都会重拉消息，
  // 所以 mock 下发消息表现为「闪一下就不见了」。返回引用还会让调用方改到模块常量。
  if (USE_MOCK) {
    return MOCK_MESSAGES.filter((m) => String(m.conversationId) === String(conversationId))
  }
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
    const conversationId = payload.conversationId ? Number(payload.conversationId) : 1
    const message: Message = {
      // 不能用 Date.now()：连发两条会撞 id，而模板拿 msg.id 当 :key
      id: Math.max(0, ...MOCK_MESSAGES.map((m) => m.id)) + 1,
      conversationId,
      // senderId 全项目无人读取（极性一律由 senderType 推导），此处不维护
      senderId: 1,
      senderType: payload.isMerchant ? 'SHOP' : 'USER',
      content: payload.content,
      type: 'text',
      isRead: false,
      createTime: new Date().toISOString(),
    }
    MOCK_MESSAGES.push(message)
    // 同步会话预览：页面发完会重拉列表，不同步的话列表还停在上一条消息上
    const conv = MOCK_CONVERSATIONS.find((c) => String(c.id) === String(conversationId))
    if (conv) {
      conv.lastMessage = payload.content
      conv.lastMessageTime = Date.now()
    }
    return message
  }
  return post<Message>('/chat/messages', {
    conversationId: payload.conversationId ? Number(payload.conversationId) : null,
    receiverId: Number(payload.receiverId),
    content: payload.content,
    productId: payload.productId ?? null,
    isMerchant: payload.isMerchant,
  })
}

export async function markAsRead(conversationId: string | number): Promise<void> {
  if (USE_MOCK) return
  return put(`/chat/conversations/${conversationId}/read`)
}

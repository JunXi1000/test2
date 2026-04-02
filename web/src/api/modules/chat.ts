import { USE_MOCK } from '@/config/env'
import { get, post, put } from '@/api/http'

export interface Message {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  senderAvatar?: string
  content: string
  timestamp: number
  read: boolean
  isMerchant: boolean // true if sender is merchant
}

export interface Conversation {
  id: string
  participantId: string // The other person's ID (user or merchant)
  participantName: string
  participantAvatar?: string
  lastMessage: string
  lastMessageTime: number
  unreadCount: number
  productId?: number // Optional: context for the conversation
  productName?: string
  productImage?: string
}

const MOCK_MESSAGES: Message[] = []
const MOCK_CONVERSATIONS: Conversation[] = []

// Helper to generate ID
const genId = () => Math.random().toString(36).substring(2, 9)

export async function getConversations(role: 'user' | 'merchant'): Promise<Conversation[]> {
  if (USE_MOCK) {
    // In a real app, backend filters by current user ID
    // Here we just return mock data
    return Promise.resolve(MOCK_CONVERSATIONS)
  }
  return get<Conversation[]>('/chat/conversations')
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  if (USE_MOCK) {
    return Promise.resolve(MOCK_MESSAGES.filter(m => m.conversationId === conversationId).sort((a, b) => a.timestamp - b.timestamp))
  }
  return get<Message[]>(`/chat/conversations/${conversationId}/messages`)
}

export async function sendMessage(payload: { conversationId?: string, receiverId: string, content: string, productId?: number, isMerchant: boolean }): Promise<Message> {
  if (USE_MOCK) {
    let convId = payload.conversationId
    
    // If no conversation ID, check if one exists or create new
    if (!convId) {
      // Simple mock logic: create new conversation
      convId = genId()
      const newConv: Conversation = {
        id: convId,
        participantId: payload.receiverId,
        participantName: payload.isMerchant ? 'User' : 'Nike Store', // Mock names
        participantAvatar: payload.isMerchant 
          ? 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop'
          : 'https://images.unsplash.com/photo-1517849845537-4d257902454a?q=80&w=200&auto=format&fit=crop',
        lastMessage: payload.content,
        lastMessageTime: Date.now(),
        unreadCount: 0,
        productId: payload.productId
      }
      MOCK_CONVERSATIONS.push(newConv)
    } else {
      // Update existing conversation
      const conv = MOCK_CONVERSATIONS.find(c => c.id === convId)
      if (conv) {
        conv.lastMessage = payload.content
        conv.lastMessageTime = Date.now()
      }
    }

    const newMessage: Message = {
      id: genId(),
      conversationId: convId,
      senderId: 'current_user', // Mock ID
      senderName: payload.isMerchant ? 'Nike Store' : 'You',
      content: payload.content,
      timestamp: Date.now(),
      read: false,
      isMerchant: payload.isMerchant
    }
    
    MOCK_MESSAGES.push(newMessage)
    return Promise.resolve(newMessage)
  }
  return post<Message>('/chat/messages', payload)
}

export async function markAsRead(conversationId: string): Promise<void> {
  if (USE_MOCK) {
    MOCK_MESSAGES.filter(m => m.conversationId === conversationId).forEach(m => m.read = true)
    const conv = MOCK_CONVERSATIONS.find(c => c.id === conversationId)
    if (conv) conv.unreadCount = 0
    return Promise.resolve()
  }
  return put(`/chat/conversations/${conversationId}/read`)
}

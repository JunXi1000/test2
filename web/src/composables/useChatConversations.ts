import { computed, nextTick, onBeforeUnmount, ref, type Ref } from 'vue'
import { useToast } from '@/composables/useToast'
import {
  getConversations,
  getMessages,
  sendMessage as sendChatMessage,
  markAsRead,
  type Conversation as ApiConversation,
  type Message as ApiMessage,
} from '@/api/modules/chat'

/**
 * 会话列表 + 消息流的数据层，买家页与卖家页共用。
 *
 * **极性是这个模块存在的首要理由**：买家页与卖家页此前是两份拷贝，唯一实质差别是
 * 「我是哪一方」——`dashboard/Messages.vue` 处处写 `msg.sender === 'user'`，
 * `merchant/Messages.vue` 处处写 `msg.sender === 'merchant'`。同一个判断抄了十几遍、
 * 各自写死一个字符串，改错一处就是气泡跑到对面去。
 *
 * 这里把它收敛成构造参数 `selfSender`，并在 `mapMessage` 里**一次性算完**：
 * 模板从此只见 `msg.isSelf`，不再出现任何角色字符串。
 *
 * 另一件事是**停止反解 API 层的归一化**：`api/modules/chat.ts` 的 `mapConversation`
 * 已经按当前角色把 `shopName`/`userName` 折叠成了统一的 `participantName`，
 * 而两个页面各自又把它拆回 `merchantName` / `userName`。本模块直接用 `participant*`。
 */

/** 本端在会话里扮演的角色。买家看到的对端是商家，卖家看到的对端是顾客。 */
export type SelfSender = 'user' | 'merchant'

export interface ChatMessage {
  id: string
  content: string
  /**
   * 是否本端发出。**极性已在此算好**，模板不要再判断角色。
   * 对齐方向、气泡配色、已读回执、以及列表预览的「You:」前缀都由它决定。
   */
  isSelf: boolean
  timestamp: Date
  read: boolean
  type?: string
  fileName?: string
  fileUrl?: string
}

export interface ChatConversation {
  id: string
  /** 对端（买家视角下是商家，卖家视角下是顾客） */
  participantId: string
  participantName: string
  participantAvatar: string
  lastMessage: string
  lastMessageTime: Date
  unreadCount: number
  /**
   * 恒为 false：后端 `Conversation` 根本没有在线字段，两个页面原先也都硬编码 false。
   * 保留是因为模板里有「在线小绿点 + Online/Offline 文案」两处判断，
   * 直接删会改变渲染结果（现在是恒显 Offline）。要真正实现在线态得先有后端字段。
   */
  online: boolean
  messages: ChatMessage[]
}

function mapMessage(m: ApiMessage, selfSender: SelfSender): ChatMessage {
  return {
    id: String(m.id),
    content: m.content || '',
    // 极性唯一的一次判断：senderType 说的是「谁发的」，跟本端角色一比即可
    isSelf: (m.senderType === 'SHOP' ? 'merchant' : 'user') === selfSender,
    timestamp: new Date(m.createTime),
    read: m.isRead,
    type: m.type,
    fileName: m.fileName,
    fileUrl: m.fileUrl,
  }
}

function mapConversation(c: ApiConversation): ChatConversation {
  return {
    id: c.id,
    participantId: c.participantId,
    participantName: c.participantName,
    participantAvatar: c.participantAvatar || '',
    lastMessage: c.lastMessage,
    lastMessageTime: new Date(c.lastMessageTime),
    unreadCount: c.unreadCount,
    online: false,
    messages: [],
  }
}

/** 聊天气泡上的时间（HH:MM AM/PM） */
export function formatChatTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  }).format(date)
}

/** 会话列表上的时间：今天给时刻，昨天给 "Yesterday"，更早给日期 */
export function formatChatDate(date: Date) {
  const now = new Date()
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return formatChatTime(date)
  if (days === 1) return 'Yesterday'
  return date.toLocaleDateString()
}

export function useChatConversations(options: {
  selfSender: SelfSender
  /** 轮询间隔，默认 5s（与重构前两个页面的硬编码一致） */
  pollIntervalMs?: number
  /**
   * 消息滚动容器，由页面用 `ref="..."` 绑好再传进来。
   * **为什么不在这里自己建 ref**：模板 ref 的名字必须与模板里的字符串对上，
   * 它属于页面；而且只被字符串消费的 ref 在 `noUnusedLocals` 下算「未读取」。
   */
  scrollContainer?: Ref<HTMLElement | null>
}) {
  const { selfSender, pollIntervalMs = 5000, scrollContainer } = options
  const { toast } = useToast()

  const conversations = ref<ChatConversation[]>([])
  const activeConversationId = ref<string | null>(null)
  const searchQuery = ref('')
  const newMessage = ref('')
  const isLoading = ref(true)
  const isSending = ref(false)
  const errorRef = ref('')

  let pollTimer: ReturnType<typeof setInterval> | null = null

  const activeConversation = computed(
    () => conversations.value.find((c) => c.id === activeConversationId.value) ?? null,
  )

  const filteredConversations = computed(() => {
    const q = searchQuery.value.toLowerCase()
    return conversations.value.filter((c) => c.participantName.toLowerCase().includes(q))
  })

  function scrollToBottom() {
    nextTick(() => {
      if (scrollContainer?.value) {
        scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
      }
    })
  }

  /**
   * 拉会话列表。`rethrow` 决定失败怎么处理 —— 这是**有意区分**的两种语义：
   *
   * - 首次加载（`load()` 调用）：必须把失败暴露出去，否则页面会把「加载失败」
   *   渲染成空态「No conversations found」，谎报成用户没有会话。
   * - 轮询刷新：必须吞掉。一次瞬时网络抖动不该把整页换成错误态。
   *
   * 重构前这里是个 bug：dashboard 的 `loadConversations` 内部 `catch {}` 吞掉异常，
   * 而 `loadAll` 在**外面** `try/catch` 去设 `errorRef` —— 异常根本传不出来，
   * 于是阶段 2 加的 ErrorState 从来没有机会渲染。改动时别把它再改回去。
   */
  async function fetchConversations(rethrow: boolean) {
    try {
      const raw = await getConversations()
      const oldMap = new Map(conversations.value.map((c) => [c.id, c]))
      conversations.value = raw.map((c) => {
        const conv = mapConversation(c)
        const existing = oldMap.get(c.id)
        if (existing) {
          // 刷新是把新数据盖到旧对象上，已加载的消息与在线态不能丢
          conv.messages = existing.messages
          conv.online = existing.online
        }
        return conv
      })
    } catch (error) {
      if (rethrow) throw error
      // 轮询失败：保留当前内容，静默
    }
  }

  async function loadMessages(conv: ChatConversation) {
    try {
      const msgs = await getMessages(conv.id)
      conv.messages = msgs.map((m) => mapMessage(m, selfSender))
    } catch {
      conv.messages = []
    }
  }

  /** 重拉当前会话的消息并滚到底（发完消息、轮询都走这里） */
  async function refreshActiveMessages() {
    const conv = activeConversation.value
    if (!conv) return
    try {
      const msgs = await getMessages(conv.id)
      conv.messages = msgs.map((m) => mapMessage(m, selfSender))
      scrollToBottom()
    } catch {
      // 静默：消息流刷新失败不该把整页换掉
    }
  }

  /** 首次加载：错误进 errorRef，由页面渲染 ErrorState + 重试 */
  async function load() {
    errorRef.value = ''
    isLoading.value = true
    try {
      await fetchConversations(true)
    } catch (error) {
      errorRef.value = error instanceof Error ? error.message : 'Failed to load conversations'
    } finally {
      isLoading.value = false
    }
    return !errorRef.value
  }

  function startPolling() {
    stopPolling()
    pollTimer = setInterval(async () => {
      await fetchConversations(false)
      await refreshActiveMessages()
    }, pollIntervalMs)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  async function selectConversation(id: string) {
    activeConversationId.value = id
    const conv = conversations.value.find((c) => c.id === id)
    if (!conv) return
    if (conv.messages.length === 0) {
      await loadMessages(conv)
    }
    conv.unreadCount = 0
    scrollToBottom()
    await markAsRead(id)
  }

  async function sendMessage() {
    if (!newMessage.value.trim() || !activeConversation.value || isSending.value) return
    const content = newMessage.value.trim()
    const conv = activeConversation.value
    newMessage.value = ''
    isSending.value = true
    try {
      await sendChatMessage({
        conversationId: conv.id,
        receiverId: conv.participantId,
        content,
        isMerchant: selfSender === 'merchant',
      })
      await refreshActiveMessages()
      await fetchConversations(false)
      scrollToBottom()
    } catch (error) {
      toast({
        title: 'Send failed',
        description: error instanceof Error ? error.message : 'Could not send message',
        variant: 'destructive',
      })
    } finally {
      isSending.value = false
    }
  }

  onBeforeUnmount(stopPolling)

  return {
    conversations,
    activeConversationId,
    activeConversation,
    filteredConversations,
    searchQuery,
    newMessage,
    isLoading,
    isSending,
    errorRef,
    load,
    selectConversation,
    sendMessage,
    startPolling,
    stopPolling,
    scrollToBottom,
    refreshActiveMessages,
  }
}

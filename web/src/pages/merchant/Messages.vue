<script setup lang="ts">
import { ref, onMounted, computed, nextTick, onBeforeUnmount } from 'vue'
import {
  Search,
  Send,
  Image as ImageIcon,
  Paperclip,
  Check,
  CheckCheck,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Columns2,
  Columns3,
  MessageSquare
} from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { useMessagesLayout } from '@/composables/useMessagesLayout'
import {
  getConversations,
  getMessages,
  sendMessage as sendChatMessage,
  markAsRead,
  type Conversation as ApiConversation,
  type Message as ApiMessage
} from '@/api/modules/chat'

// ── Local types (compatible with template) ──────────────────────────
interface LocalMessage {
  id: string
  content: string
  sender: 'user' | 'merchant'
  timestamp: Date
  read: boolean
  type?: string
  fileName?: string
  fileUrl?: string
}

interface LocalConversation {
  id: string
  userId: string
  userName: string
  userAvatar: string
  lastMessage: string
  lastMessageTime: Date
  unread: number
  online: boolean
  messages: LocalMessage[]
}

function mapApiMessage(m: ApiMessage): LocalMessage {
  return {
    id: String(m.id),
    content: m.content || '',
    sender: m.senderType === 'SHOP' ? 'merchant' : 'user',
    timestamp: new Date(m.createTime),
    read: m.isRead,
    type: m.type,
    fileName: m.fileName,
    fileUrl: m.fileUrl
  }
}

function mapApiConversation(c: ApiConversation): LocalConversation {
  return {
    id: c.id,
    userId: c.participantId,
    userName: c.participantName,
    userAvatar: c.participantAvatar || '',
    lastMessage: c.lastMessage,
    lastMessageTime: new Date(c.lastMessageTime),
    unread: c.unreadCount,
    online: false,
    messages: []
  }
}

// ── State ────────────────────────────────────────────────────────────
const { toast } = useToast()
const searchQuery = ref('')
const activeConversationId = ref<string | null>(null)
const newMessage = ref('')
const chatContainerRef = ref<HTMLElement | null>(null)
const isLoading = ref(true)
const isSending = ref(false)
const LAYOUT_PREFERENCES_KEY = 'merchant-messages-layout-preferences-v1'

const conversations = ref<LocalConversation[]>([])

let pollTimer: ReturnType<typeof setInterval> | null = null

const {
  sidebarWidth,
  isSidebarCollapsed,
  mobileViewMode,
  ultraWideMode,
  isResizingSidebar,
  isMobile,
  isUltraWide,
  showSidebar,
  showChat,
  showInspector,
  sidebarStyle,
  toggleSidebarCollapse,
  startSidebarResize
} = useMessagesLayout({
  preferencesKey: LAYOUT_PREFERENCES_KEY,
  defaultSidebarWidth: 300,
  minSidebarWidth: 260,
  maxSidebarWidth: 400
})

// ── Computed ─────────────────────────────────────────────────────────
const activeConversation = computed(() =>
  conversations.value.find((c) => c.id === activeConversationId.value)
)

const filteredConversations = computed(() =>
  conversations.value.filter((c) =>
    c.userName.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
)

// ── API helpers ──────────────────────────────────────────────────────
async function loadConversations() {
  try {
    const raw = await getConversations()
    const oldMap = new Map(conversations.value.map((c) => [c.id, c]))
    conversations.value = raw.map((c) => {
      const existing = oldMap.get(c.id)
      const conv = mapApiConversation(c)
      if (existing) {
        conv.messages = existing.messages
        conv.online = existing.online
      }
      return conv
    })
  } catch {
    // keep current state
  }
}

async function loadMessagesForConversation(conv: LocalConversation) {
  try {
    const msgs = await getMessages(conv.id)
    conv.messages = msgs.map(mapApiMessage)
  } catch {
    conv.messages = []
  }
}

async function refreshActiveMessages() {
  const conv = activeConversation.value
  if (!conv) return
  try {
    const msgs = await getMessages(conv.id)
    conv.messages = msgs.map(mapApiMessage)
    scrollToBottom()
  } catch { /* silent */ }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    await loadConversations()
    if (activeConversation.value) {
      const fresh = conversations.value.find((c) => c.id === activeConversationId.value)
      if (fresh) {
        await loadMessagesForConversation(fresh)
        if (fresh.id === activeConversationId.value) {
          activeConversation.value!.messages = fresh.messages
        }
      }
    }
  }, 5000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// ── Actions ──────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    await loadConversations()
  } catch { /* empty */ }
  isLoading.value = false
  if (!isMobile.value && conversations.value.length > 0) {
    selectConversation(conversations.value[0].id)
  }
  startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
})

async function selectConversation(id: string) {
  activeConversationId.value = id
  if (isMobile.value) {
    mobileViewMode.value = 'chat'
  }
  const conv = conversations.value.find((c) => c.id === id)
  if (conv) {
    if (conv.messages.length === 0) {
      await loadMessagesForConversation(conv)
    }
    conv.unread = 0
    scrollToBottom()
    await markAsRead(id)
  }
}

async function doSendMessage() {
  if (!newMessage.value.trim() || !activeConversation.value || isSending.value) return
  const content = newMessage.value.trim()
  const conv = activeConversation.value
  newMessage.value = ''
  isSending.value = true

  try {
    await sendChatMessage({
      conversationId: conv.id,
      receiverId: conv.userId,
      content,
      isMerchant: true
    })
    await refreshActiveMessages()
    await loadConversations()
    scrollToBottom()
  } catch (err: any) {
    toast({ title: 'Send failed', description: err?.message || 'Could not send message', variant: 'destructive' })
  } finally {
    isSending.value = false
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainerRef.value) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
    }
  })
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }).format(date)
}

function formatDate(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return formatTime(date)
  if (days === 1) return 'Yesterday'
  return date.toLocaleDateString()
}
</script>

<template>
  <div
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:flex-row md:items-stretch"
  >
    <div
      v-if="showSidebar"
      class="flex w-full min-h-0 flex-col border-zinc-200/80 bg-zinc-100/95 dark:border-zinc-800 dark:bg-zinc-900/90 md:h-full md:max-h-full md:shrink-0 md:border-r"
      :style="sidebarStyle"
      :class="isMobile ? 'max-h-[min(52vh,28rem)] border-b md:max-h-none md:border-b-0' : ''"
    >
      <div class="shrink-0 border-b border-zinc-200/70 px-3 pb-2 pt-3 dark:border-zinc-800 sm:px-4">
        <div class="mb-2 flex items-center justify-between gap-2">
          <h2 class="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Customer Messages</h2>
          <div class="flex items-center gap-0.5">
            <button
              v-if="!isMobile"
              type="button"
              class="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/80 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              :aria-label="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
              @click="toggleSidebarCollapse"
            >
              <PanelLeftOpen v-if="isSidebarCollapsed" class="h-4 w-4" />
              <PanelLeftClose v-else class="h-4 w-4" />
            </button>
            <button
              v-if="isUltraWide"
              type="button"
              class="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/80 dark:hover:bg-zinc-800"
              :aria-label="ultraWideMode === 'three' ? 'Switch to two columns' : 'Switch to three columns'"
              @click="ultraWideMode = ultraWideMode === 'three' ? 'two' : 'three'"
            >
              <Columns2 v-if="ultraWideMode === 'three'" class="h-4 w-4" />
              <Columns3 v-else class="h-4 w-4" />
            </button>
          </div>
        </div>
        <div class="relative">
          <Search class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search customers..."
            class="h-10 w-full rounded-xl border border-zinc-200/80 bg-white pl-10 pr-3 text-sm text-zinc-900 shadow-sm outline-none ring-violet-500/0 transition-all placeholder:text-zinc-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/25 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>
        <div v-if="isMobile" class="mt-3 flex justify-end gap-1">
          <button
            type="button"
            class="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
            :class="
              mobileViewMode === 'list'
                ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300'
                : 'border-zinc-200 text-zinc-500 dark:border-zinc-700'
            "
            @click="mobileViewMode = 'list'"
          >
            List
          </button>
          <button
            type="button"
            class="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
            :class="
              mobileViewMode === 'chat'
                ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300'
                : 'border-zinc-200 text-zinc-500 dark:border-zinc-700'
            "
            @click="mobileViewMode = 'chat'"
          >
            Chat
          </button>
        </div>
      </div>

      <div class="custom-scrollbar flex-1 overflow-y-auto p-2">
        <div v-if="isLoading" class="space-y-3 p-2">
          <div v-for="i in 3" :key="i" class="flex gap-3 rounded-xl bg-white/60 p-3 dark:bg-zinc-800/40">
            <Skeleton class="h-12 w-12 rounded-full" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4 w-24 rounded-md" />
              <Skeleton class="h-3 w-full rounded-md" />
            </div>
          </div>
        </div>

        <div
          v-else-if="filteredConversations.length === 0"
          class="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400"
        >
          No conversations found
        </div>

        <div v-else class="space-y-1.5 px-1 pb-2">
          <button
            v-for="conv in filteredConversations"
            :key="conv.id"
            type="button"
            class="relative w-full rounded-xl px-3 py-3 text-left transition-all duration-200"
            :class="[
              activeConversationId === conv.id
                ? 'bg-white shadow-md ring-1 ring-zinc-200/90 dark:bg-zinc-800 dark:ring-zinc-600/80'
                : 'hover:bg-white/70 dark:hover:bg-zinc-800/50'
            ]"
            @click="selectConversation(conv.id)"
          >
            <div class="flex items-start gap-3">
              <div class="relative shrink-0">
                <div
                  class="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-zinc-200/80 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                >
                  <img v-if="conv.userAvatar" :src="conv.userAvatar" class="h-full w-full object-cover" alt="" />
                  <User v-else class="h-6 w-6 text-zinc-400" />
                </div>
                <span
                  v-if="conv.online"
                  class="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-800"
                />
              </div>
              <div class="min-w-0 flex-1">
                <div class="mb-0.5 flex items-start justify-between gap-2">
                  <span class="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{{
                    conv.userName
                  }}</span>
                  <span class="shrink-0 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">{{
                    formatDate(conv.lastMessageTime)
                  }}</span>
                </div>
                <p
                  class="line-clamp-2 text-xs leading-snug text-zinc-500 dark:text-zinc-400"
                  :class="conv.unread > 0 ? 'font-medium text-zinc-800 dark:text-zinc-200' : ''"
                >
                  <span v-if="conv.messages[conv.messages.length - 1]?.sender === 'merchant'">You: </span>
                  {{ conv.lastMessage }}
                </p>
              </div>
            </div>
            <div
              v-if="conv.unread > 0"
              class="absolute bottom-3 right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white shadow-sm"
            >
              {{ conv.unread }}
            </div>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showSidebar && !isMobile && !isSidebarCollapsed"
      class="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-violet-400/25 dark:hover:bg-violet-500/20"
      :class="isResizingSidebar ? 'bg-violet-400/40 dark:bg-violet-500/30' : ''"
      @mousedown.prevent="startSidebarResize"
    />

    <div
      v-if="showChat"
      class="relative flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-50/90 dark:bg-zinc-950/40"
    >
      <div
        v-if="!isMobile && isSidebarCollapsed"
        class="group absolute left-0 top-3 z-20 h-12 w-5"
      >
        <button
          type="button"
          class="absolute left-0 top-0 -translate-x-2 rounded-r-lg border border-zinc-200 bg-white/95 p-2 opacity-20 shadow-sm backdrop-blur-sm transition-all duration-200 hover:translate-x-0 hover:opacity-100 dark:border-zinc-700 dark:bg-zinc-900/95"
          aria-label="Expand sidebar"
          @click="toggleSidebarCollapse"
        >
          <PanelLeftOpen class="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
        </button>
      </div>

      <div
        v-if="!activeConversation"
        class="flex flex-1 flex-col items-center justify-center p-8 text-zinc-500 dark:text-zinc-400"
      >
        <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/50">
          <MessageSquare class="h-8 w-8 text-violet-500 opacity-80" />
        </div>
        <h3 class="mb-1 text-lg font-bold text-zinc-800 dark:text-zinc-100">Select a conversation</h3>
        <p class="max-w-xs text-center text-sm">Choose a customer from the list to start chatting</p>
      </div>

      <template v-else>
        <div
          class="flex h-14 shrink-0 items-center border-b border-zinc-200/80 bg-white/90 px-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90 sm:h-16 sm:px-6"
        >
          <div class="flex min-w-0 items-center gap-3">
            <button
              type="button"
              class="rounded-lg p-1.5 text-zinc-600 md:hidden dark:text-zinc-300"
              @click="mobileViewMode = 'list'; activeConversationId = null"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div class="relative shrink-0">
              <div class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
                <img
                  v-if="activeConversation.userAvatar"
                  :src="activeConversation.userAvatar"
                  class="h-full w-full object-cover"
                  alt=""
                />
                <User v-else class="h-5 w-5 text-zinc-400" />
              </div>
              <span
                v-if="activeConversation.online"
                class="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-900"
              />
            </div>
            <div class="min-w-0">
              <h3 class="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {{ activeConversation.userName }}
              </h3>
              <p class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                {{ activeConversation.online ? 'Online' : 'Offline' }}
              </p>
            </div>
          </div>
        </div>

        <div
          ref="chatContainerRef"
          class="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-6 sm:py-4"
        >
          <div
            v-for="msg in activeConversation.messages"
            :key="msg.id"
            class="flex max-w-[min(100%,28rem)] gap-2.5 sm:max-w-[min(100%,32rem)]"
            :class="msg.sender === 'merchant' ? 'ml-auto flex-row-reverse' : ''"
          >
            <div
              v-if="msg.sender === 'user'"
              class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-800"
            >
              <img
                v-if="activeConversation.userAvatar"
                :src="activeConversation.userAvatar"
                class="h-full w-full object-cover"
                alt=""
              />
              <User v-else class="h-4 w-4 text-zinc-400" />
            </div>

            <div
              class="rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm"
              :class="
                msg.sender === 'merchant'
                  ? 'rounded-tr-md bg-violet-600 text-white'
                  : 'rounded-tl-md border border-zinc-200/90 bg-zinc-200/90 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
              "
            >
              <template v-if="msg.type === 'image' && msg.fileUrl">
                <img
                  :src="msg.fileUrl"
                  :alt="msg.fileName || 'image'"
                  class="max-h-[220px] max-w-[220px] rounded-lg border border-white/20 object-cover"
                />
                <p v-if="msg.fileName" class="mt-2 break-all text-xs opacity-90">{{ msg.fileName }}</p>
              </template>
              <template v-else-if="msg.type === 'attachment' && msg.fileUrl">
                <a
                  :href="msg.fileUrl"
                  :download="msg.fileName || 'attachment'"
                  class="inline-flex items-center gap-2 break-all underline-offset-2 hover:underline"
                  :class="msg.sender === 'merchant' ? 'text-white' : ''"
                >
                  <Paperclip class="h-4 w-4 shrink-0" />
                  <span>{{ msg.fileName || msg.content }}</span>
                </a>
              </template>
              <p v-else>{{ msg.content }}</p>
              <div
                class="mt-1.5 flex items-center justify-end gap-1 text-[10px]"
                :class="
                  msg.sender === 'merchant' ? 'text-violet-100/90' : 'text-zinc-500 dark:text-zinc-400'
                "
              >
                {{ formatTime(msg.timestamp) }}
                <span v-if="msg.sender === 'merchant'" class="inline-flex">
                  <CheckCheck v-if="msg.read" class="h-3.5 w-3.5" />
                  <Check v-else class="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="shrink-0 border-t border-zinc-200/80 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/80 sm:px-5 sm:py-2.5">
          <div
            class="flex items-end gap-1 rounded-2xl border-2 border-violet-400/45 bg-white px-1 py-1 shadow-sm transition-shadow focus-within:border-violet-500 focus-within:shadow-md focus-within:shadow-violet-500/10 dark:border-violet-500/35 dark:bg-zinc-900"
          >
            <textarea
              v-model="newMessage"
              rows="1"
              placeholder="Type a message..."
              class="max-h-32 min-h-[40px] flex-1 resize-none border-0 bg-transparent py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              @keydown.enter.prevent="doSendMessage"
            />
            <button
              type="button"
              class="mb-0.5 mr-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-md transition-all hover:bg-violet-700 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
              :disabled="!newMessage.trim() || isSending"
              aria-label="Send"
              @click="doSendMessage"
            >
              <Send class="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </template>
    </div>

    <aside
      v-if="showInspector"
      class="flex max-h-full min-h-0 w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-zinc-200/80 bg-white/80 p-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/70"
    >
      <h3 class="font-semibold text-sm">Conversation Details</h3>
      <div class="rounded-lg border border-border p-3 space-y-2 text-sm">
        <p><span class="text-muted-foreground">Customer:</span> {{ activeConversation?.userName }}</p>
        <p><span class="text-muted-foreground">Status:</span> {{ activeConversation?.online ? 'Online' : 'Offline' }}</p>
        <p><span class="text-muted-foreground">Messages:</span> {{ activeConversation?.messages.length ?? 0 }}</p>
      </div>
      <div class="rounded-lg border border-border p-3">
        <p class="text-xs text-muted-foreground">Ultra-wide mode enabled.</p>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.5);
  border-radius: 2px;
}
</style>

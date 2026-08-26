<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { MessageSquare, X, Send, Minus } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useRouter } from 'vue-router'
import {
  getConversations,
  getMessages,
  sendMessage as sendChatMessage,
  markAsRead,
  type Conversation,
  type Message
} from '@/api/modules/chat'

const isOpen = ref(false)
const isMinimized = ref(false)
const newMessage = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const authStore = useAuthStore()
const { toast } = useToast()
const router = useRouter()

// Real data from backend
const conversations = ref<Conversation[]>([])
const activeConversation = ref<Conversation | null>(null)
const messages = ref<Message[]>([])
const isLoading = ref(false)
const isSending = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null

const isMerchant = computed(() => authStore.user?.role === 'merchant')

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

async function loadConversations() {
  try {
    conversations.value = await getConversations()
  } catch {
    conversations.value = []
  }
}

async function loadMessages(conversationId: string) {
  try {
    const msgs = await getMessages(conversationId)
    messages.value = msgs.map((m: Message) => ({
      ...m,
      sender: m.senderType === 'SHOP' ? ('merchant' as const) : ('user' as const),
      time: new Date(m.createTime)
    })) as any
    scrollToBottom()
  } catch {
    messages.value = []
  }
}

async function openChat() {
  if (!authStore.isAuthenticated) {
    toast({ title: 'Login required', description: 'Please login to chat with support', variant: 'destructive' })
    router.push('/login')
    return
  }

  isOpen.value = true
  isMinimized.value = false
  isLoading.value = true

  await loadConversations()

  if (conversations.value.length > 0) {
    activeConversation.value = conversations.value[0]
    await loadMessages(activeConversation.value.id)
    await markAsRead(activeConversation.value.id)
  }

  isLoading.value = false
  startPolling()
}

function closeChat() {
  isOpen.value = false
  stopPolling()
}

function toggleChat() {
  if (isOpen.value) {
    closeChat()
  } else {
    openChat()
  }
}

async function sendMessage() {
  if (!newMessage.value.trim() || isSending.value) return

  const content = newMessage.value.trim()
  newMessage.value = ''
  isSending.value = true

  try {
    const conv = activeConversation.value
    await sendChatMessage({
      conversationId: conv?.id,
      receiverId: conv?.participantId || '1',
      content,
      isMerchant: isMerchant.value
    })
    // Reload messages to get the new one with server timestamp
    if (conv) {
      await loadMessages(conv.id)
      await loadConversations()
    }
  } catch (err: any) {
    toast({ title: 'Send failed', description: err?.message || 'Could not send message', variant: 'destructive' })
  } finally {
    isSending.value = false
  }
}

async function pollMessages() {
  if (!activeConversation.value) return
  try {
    const convId = activeConversation.value.id
    const msgs = await getMessages(convId)
    if (msgs.length !== messages.value.length) {
      messages.value = msgs.map((m: Message) => ({
        ...m,
        sender: m.senderType === 'SHOP' ? ('merchant' as const) : ('user' as const),
        time: new Date(m.createTime)
      })) as any
      scrollToBottom()
    }
  } catch {
    // silent poll failure
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(pollMessages, 5000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }).format(date)
}

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <div class="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] md:bottom-6 right-3 md:right-6 z-[100] flex flex-col items-end pointer-events-none [&>*]:pointer-events-auto">
    <!-- Chat Window -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-4 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-4 scale-95"
    >
      <div
        v-if="isOpen && !isMinimized"
        class="w-[calc(100vw-1rem)] max-w-[350px] h-[70vh] max-h-[500px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-3 md:mb-4 relative"
      >
        <!-- Header -->
        <div class="bg-primary text-primary-foreground p-4 flex items-center justify-between shadow-md z-10">
          <div class="flex items-center gap-3">
            <div class="relative">
              <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-2 border-white/10">
                <img
                  v-if="activeConversation?.participantAvatar"
                  :src="activeConversation.participantAvatar"
                  class="w-full h-full object-cover"
                />
                <MessageSquare v-else class="w-5 h-5 text-white/70" />
              </div>
              <span class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-primary rounded-full"></span>
            </div>
            <div>
              <h3 class="font-bold text-sm leading-tight">{{ activeConversation?.participantName || 'Customer Support' }}</h3>
              <p class="text-[10px] opacity-90 font-medium">Online</p>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button @click="isMinimized = true" class="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Minimize">
              <Minus class="w-4 h-4" />
            </button>
            <button @click="closeChat" class="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Close">
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Messages -->
        <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4 bg-secondary/30 custom-scrollbar">
          <!-- Loading state -->
          <div v-if="isLoading" class="flex items-center justify-center h-full">
            <div class="flex gap-1 items-center text-muted-foreground text-sm">
              <span class="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"></span>
              <span class="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style="animation-delay:0.1s"></span>
              <span class="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style="animation-delay:0.2s"></span>
            </div>
          </div>

          <!-- Empty state: no conversations -->
          <div v-else-if="!activeConversation" class="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageSquare class="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p class="text-sm text-muted-foreground font-medium">No conversations yet</p>
            <p class="text-xs text-muted-foreground/70 mt-1">Visit a store page to start chatting with a merchant.</p>
            <router-link to="/" class="mt-3 text-xs text-primary hover:underline font-medium">Browse Stores →</router-link>
          </div>

          <!-- Messages list -->
          <template v-else>
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="flex gap-2 max-w-[85%]"
              :class="(msg as any).sender === 'user' ? 'ml-auto flex-row-reverse' : ''"
            >
              <div
                class="w-8 h-8 rounded-full bg-secondary border border-border flex-shrink-0 overflow-hidden mt-auto"
                v-if="(msg as any).sender === 'merchant'"
              >
                <img
                  v-if="activeConversation?.participantAvatar"
                  :src="activeConversation.participantAvatar"
                  class="w-full h-full object-cover"
                />
                <MessageSquare v-else class="w-4 h-4 m-auto text-muted-foreground" />
              </div>

              <div
                class="px-4 py-2.5 rounded-2xl text-sm shadow-sm relative group"
                :class="(msg as any).sender === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border rounded-bl-sm'"
              >
                <p class="leading-relaxed">{{ (msg as any).content }}</p>
                <span
                  class="text-[10px] absolute -bottom-5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-muted-foreground"
                  :class="(msg as any).sender === 'user' ? 'right-0' : 'left-0'"
                >
                  {{ formatTime((msg as any).time) }}
                </span>
              </div>
            </div>
          </template>
        </div>

        <!-- Input -->
        <div v-if="activeConversation" class="p-3 bg-card border-t border-border shadow-inner">
          <div class="flex items-end gap-2 bg-secondary/50 p-2 rounded-xl border border-transparent focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all focus-within:bg-background">
            <textarea
              v-model="newMessage"
              rows="1"
              placeholder="Type a message..."
              class="flex-1 bg-transparent border-none outline-none resize-none py-2 px-2 text-sm max-h-24 min-h-[40px] placeholder:text-muted-foreground/70"
              @keydown.enter.prevent="sendMessage"
            ></textarea>
            <div class="flex gap-1 pb-0.5">
              <Button
                size="icon"
                class="rounded-lg h-9 w-9 shrink-0 shadow-sm"
                :disabled="!newMessage.trim() || isSending"
                @click="sendMessage"
              >
                <Send class="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Trigger Button -->
    <button
      v-if="!isOpen || isMinimized"
      @click="toggleChat"
      class="h-12 w-12 md:h-14 md:w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all duration-300 flex items-center justify-center group relative hover:scale-105 active:scale-95"
    >
      <span class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-background" :class="conversations.length > 0 ? 'animate-pulse' : ''"></span>
      <MessageSquare class="w-6 h-6 md:w-7 md:h-7" />
    </button>

    <!-- Minimized State -->
    <div
      v-if="isMinimized && isOpen"
      class="bg-card border border-border rounded-full shadow-lg pr-4 pl-1 py-1 mb-4 flex items-center gap-3 cursor-pointer hover:bg-secondary/50 transition-all hover:scale-105 group"
      @click="isMinimized = false"
    >
      <div class="relative">
        <div class="w-10 h-10 rounded-full bg-secondary overflow-hidden border border-border group-hover:border-primary/50 transition-colors">
          <img
            v-if="activeConversation?.participantAvatar"
            :src="activeConversation.participantAvatar"
            class="w-full h-full object-cover"
          />
          <MessageSquare v-else class="w-5 h-5 m-auto text-muted-foreground" />
        </div>
        <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-card rounded-full"></span>
      </div>
      <div class="text-left">
        <h4 class="font-bold text-sm">{{ activeConversation?.participantName || 'Customer Support' }}</h4>
        <p class="text-xs text-muted-foreground truncate max-w-[120px]">Click to resume chat</p>
      </div>
      <button class="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-full ml-1 transition-colors" @click.stop="closeChat">
        <X class="w-4 h-4" />
      </button>
    </div>
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

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { MessageSquare, X, Send, Minus, Maximize2, Minimize2, Paperclip, Smile } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useRouter } from 'vue-router'

const props = defineProps<{
  merchantId?: string
  merchantName?: string
}>()

const isOpen = ref(false)
const isMinimized = ref(false)
const newMessage = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const authStore = useAuthStore()
const { toast } = useToast()
const router = useRouter()

// Mock Messages
const messages = ref([
  { id: '1', content: 'Hello! How can we help you today?', sender: 'merchant', time: new Date(Date.now() - 1000 * 60 * 5) },
])

const isTyping = ref(false)

function toggleChat() {
  if (!authStore.isAuthenticated) {
    toast({ title: 'Login required', description: 'Please login to chat with support', variant: 'destructive' })
    router.push('/login')
    return
  }
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    isMinimized.value = false
    scrollToBottom()
  }
}

function minimizeChat() {
  isMinimized.value = !isMinimized.value
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

function sendMessage() {
  if (!newMessage.value.trim()) return

  // Add user message
  messages.value.push({
    id: Date.now().toString(),
    content: newMessage.value,
    sender: 'user',
    time: new Date()
  })

  newMessage.value = ''
  scrollToBottom()
  isTyping.value = true

  // Simulate reply
  setTimeout(() => {
    isTyping.value = false
    messages.value.push({
      id: (Date.now() + 1).toString(),
      content: 'Thanks for your message! Our team will get back to you shortly.',
      sender: 'merchant',
      time: new Date()
    })
    scrollToBottom()
  }, 2000)
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }).format(date)
}
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
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop" class="w-full h-full object-cover" />
              </div>
              <span class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-primary rounded-full"></span>
            </div>
            <div>
              <h3 class="font-bold text-sm leading-tight">Customer Support</h3>
              <p class="text-[10px] opacity-90 font-medium">Online • Replies in 5m</p>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button @click="isMinimized = true" class="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Minimize">
              <Minus class="w-4 h-4" />
            </button>
            <button @click="isOpen = false" class="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Close">
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Messages -->
        <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4 bg-secondary/30 custom-scrollbar">
          <div class="text-center text-xs text-muted-foreground my-2 bg-secondary/50 py-1 px-3 rounded-full inline-block mx-auto">Today</div>
          
          <div 
            v-for="msg in messages" 
            :key="msg.id"
            class="flex gap-2 max-w-[85%]"
            :class="msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''"
          >
            <div 
              class="w-8 h-8 rounded-full bg-secondary border border-border flex-shrink-0 overflow-hidden mt-auto"
              v-if="msg.sender === 'merchant'"
            >
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop" class="w-full h-full object-cover" />
            </div>
            
            <div 
              class="px-4 py-2.5 rounded-2xl text-sm shadow-sm relative group"
              :class="msg.sender === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border rounded-bl-sm'"
            >
              <p class="leading-relaxed">{{ msg.content }}</p>
              <span 
                class="text-[10px] absolute -bottom-5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-muted-foreground"
                :class="msg.sender === 'user' ? 'right-0' : 'left-0'"
              >
                {{ formatTime(msg.time) }}
              </span>
            </div>
          </div>

          <div v-if="isTyping" class="flex gap-2">
             <div class="w-8 h-8 rounded-full bg-secondary border border-border flex-shrink-0 overflow-hidden mt-auto">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop" class="w-full h-full object-cover" />
            </div>
            <div class="bg-card border border-border px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center h-10 shadow-sm">
              <span class="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"></span>
              <span class="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce delay-100"></span>
              <span class="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div class="p-3 bg-card border-t border-border shadow-inner">
          <div class="flex items-end gap-2 bg-secondary/50 p-2 rounded-xl border border-transparent focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all focus-within:bg-background">
            <textarea 
              v-model="newMessage"
              rows="1"
              placeholder="Type a message..."
              class="flex-1 bg-transparent border-none outline-none resize-none py-2 px-2 text-sm max-h-24 min-h-[40px] placeholder:text-muted-foreground/70"
              @keydown.enter.prevent="sendMessage"
            ></textarea>
            <div class="flex gap-1 pb-0.5">
              <button class="p-2 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-secondary" title="Attach file">
                <Paperclip class="w-4 h-4" />
              </button>
              <Button 
                size="icon" 
                class="rounded-lg h-9 w-9 shrink-0 shadow-sm" 
                :disabled="!newMessage.trim()"
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
      <span class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-background animate-pulse"></span>
      <MessageSquare class="w-6 h-6 md:w-7 md:h-7" />
    </button>
    
    <!-- Minimized State Overlay (Click to restore) -->
    <div 
      v-if="isMinimized && isOpen" 
      class="bg-card border border-border rounded-full shadow-lg pr-4 pl-1 py-1 mb-4 flex items-center gap-3 cursor-pointer hover:bg-secondary/50 transition-all hover:scale-105 group"
      @click="isMinimized = false"
    >
      <div class="relative">
        <div class="w-10 h-10 rounded-full bg-secondary overflow-hidden border border-border group-hover:border-primary/50 transition-colors">
          <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop" class="w-full h-full object-cover" />
        </div>
        <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-card rounded-full"></span>
      </div>
      <div class="text-left">
        <h4 class="font-bold text-sm">Customer Support</h4>
        <p class="text-xs text-muted-foreground truncate max-w-[120px]">Click to resume chat</p>
      </div>
      <button class="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-full ml-1 transition-colors" @click.stop="isOpen = false">
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
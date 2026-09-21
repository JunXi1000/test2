<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  Search,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Columns2,
  Columns3,
} from 'lucide-vue-next'
import ChatConversationItem from '@/components/ui/chat/ChatConversationItem.vue'
import ChatMessageBubble from '@/components/ui/chat/ChatMessageBubble.vue'
import ChatComposer from '@/components/ui/chat/ChatComposer.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import EmptyState from '@/components/ui/state/EmptyState.vue'
import ErrorState from '@/components/ui/state/ErrorState.vue'
import { useMessagesLayout } from '@/composables/useMessagesLayout'
import {
  useChatConversations,
  type ChatConversation,
  type SelfSender,
} from '@/composables/useChatConversations'

/**
 * 消息页的三栏工作区（侧栏 / 聊天 / 详情）。买家页与卖家页共用这一份骨架。
 *
 * **它不是通用组件，是这两个页面的唯一一份模板。** 原先两页各自持有一套约 180 行的
 * 同构 markup，差异只有标题等四处字符串、以及「对端头像长什么样」。所以这里的选择是：
 * - 数据 + 布局**全部内聚**（`useChatConversations` + `useMessagesLayout` 都在这里调），
 *   页面不再持有 `chat` 状态、也不再拿到 layout 的一堆 ref —— 两页的脚本因此缩到十几行。
 * - 真正因域而异的**只有对端头像**，做成语义插槽由页面给：买家看商家（有头像、可点开资料），
 *   卖家看顾客（多数无头像、要图标兜底）。除此之外本组件不认识角色。
 * - 于是它**不向外 emit 任何东西**：点会话、发消息、重试全是内部行为。买家页的商家资料抽屉
 *   是唯一的域外功能，靠 `peer-avatar` / `conversation-avatar` 插槽里的按钮回调页面自己打开。
 *
 * ⚠️ 两个插槽**都是必填的**，没给就是空头像圈 —— 头像内容没有合理的默认值，
 * 与其塞一个「多数情况用不上」的默认实现，不如让调用方显式给。
 */
const props = defineProps<{
  /** 本端角色，决定消息极性（`message.isSelf` 怎么算） */
  selfSender: SelfSender
  /** 布局偏好持久化的 key —— 每个域一份，不能写死在这里 */
  layoutKey: string
  title: string
  searchPlaceholder: string
  selectPrompt: string
  /** 详情栏里对端的称呼：买家页是 `Merchant`、卖家页是 `Customer`（含冒号） */
  peerLabel: string
  inspectorHint: string
}>()

defineSlots<{
  /** 聊天头部与每条消息气泡共用的对端头像 —— 页面定义一次，两处都用它 */
  'peer-avatar': (props: { conversation: ChatConversation }) => unknown
  /** 会话列表里每一条的头像 */
  'conversation-avatar': (props: { conversation: ChatConversation }) => unknown
}>()

// 模板 ref 必须与模板里的字符串同名，所以它属于本组件；composable 只拿到它用来滚到底
const chatContainerRef = ref<HTMLElement | null>(null)

const {
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
  selectConversation: selectConversationBase,
  sendMessage,
  startPolling,
} = useChatConversations({ selfSender: props.selfSender, scrollContainer: chatContainerRef })

const {
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
  startSidebarResize,
} = useMessagesLayout({
  preferencesKey: props.layoutKey,
  defaultSidebarWidth: 300,
  minSidebarWidth: 260,
  maxSidebarWidth: 400,
})

// ── Actions ──────────────────────────────────────────────────────────
// 移动端的「点会话就切到聊天」是**布局**决策，不是数据层的事，所以在这里包一层。
function selectConversation(id: string) {
  if (isMobile.value) {
    mobileViewMode.value = 'chat'
  }
  return selectConversationBase(id)
}

async function loadAll() {
  // load() 内部把失败写进 errorRef，模板据此渲染 ErrorState。**别再改回「外面 try/catch」**：
  // 重构前 dashboard 就是这么写的，而 composable 内部把异常吞了，异常传不到外层，
  // errorRef 恒为空 → 加载失败被渲染成「一条会话都没有」。
  const ok = await load()
  if (ok && !isMobile.value && conversations.value.length > 0) {
    selectConversation(conversations.value[0].id)
  }
  startPolling()
}

onMounted(loadAll)
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
          <h2 class="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {{ title }}
          </h2>
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
              :aria-label="
                ultraWideMode === 'three' ? 'Switch to two columns' : 'Switch to three columns'
              "
              @click="ultraWideMode = ultraWideMode === 'three' ? 'two' : 'three'"
            >
              <Columns2 v-if="ultraWideMode === 'three'" class="h-4 w-4" />
              <Columns3 v-else class="h-4 w-4" />
            </button>
          </div>
        </div>
        <div class="relative">
          <Search
            class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            v-model="searchQuery"
            type="text"
            data-testid="messages-search"
            :placeholder="searchPlaceholder"
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
        <ErrorState v-if="errorRef" :message="errorRef" @retry="loadAll" />

        <div v-else-if="isLoading" class="space-y-3 p-2">
          <div
            v-for="i in 3"
            :key="i"
            class="flex gap-3 rounded-xl bg-white/60 p-3 dark:bg-zinc-800/40"
          >
            <Skeleton class="h-12 w-12 rounded-full" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4 w-24 rounded-md" />
              <Skeleton class="h-3 w-full rounded-md" />
            </div>
          </div>
        </div>

        <EmptyState
          v-else-if="filteredConversations.length === 0"
          variant="compact"
          data-testid="messages-empty"
          description="No conversations found"
          class="px-4"
        />

        <div v-else class="space-y-1.5 px-1 pb-2">
          <ChatConversationItem
            v-for="conv in filteredConversations"
            :key="conv.id"
            :conversation="conv"
            :active="activeConversationId === conv.id"
            @select="selectConversation(conv.id)"
          >
            <template #avatar="slotProps">
              <slot name="conversation-avatar" :conversation="slotProps.conversation" />
            </template>
          </ChatConversationItem>
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
      <div v-if="!isMobile && isSidebarCollapsed" class="group absolute left-0 top-3 z-20 h-12 w-5">
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
        data-testid="messages-select-prompt"
        class="flex flex-1 flex-col items-center justify-center p-8 text-zinc-500 dark:text-zinc-400"
      >
        <div
          class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/50"
        >
          <MessageSquare class="h-8 w-8 text-violet-500 opacity-80" />
        </div>
        <h3 class="mb-1 text-lg font-bold text-zinc-800 dark:text-zinc-100">
          Select a conversation
        </h3>
        <p class="max-w-xs text-center text-sm">{{ selectPrompt }}</p>
      </div>

      <template v-else>
        <div
          class="flex h-14 shrink-0 items-center border-b border-zinc-200/80 bg-white/90 px-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90 sm:h-16 sm:px-6"
        >
          <div class="flex min-w-0 items-center gap-3">
            <button
              type="button"
              class="rounded-lg p-1.5 text-zinc-600 md:hidden dark:text-zinc-300"
              @click="
                () => {
                  mobileViewMode = 'list'
                  activeConversationId = null
                }
              "
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div class="relative shrink-0">
              <div
                class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800"
              >
                <slot name="peer-avatar" :conversation="activeConversation" />
              </div>
              <span
                v-if="activeConversation.online"
                class="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-900"
              />
            </div>
            <div class="min-w-0">
              <h3 class="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {{ activeConversation.participantName }}
              </h3>
              <p class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                {{ activeConversation.online ? 'Online' : 'Offline' }}
              </p>
            </div>
          </div>
        </div>

        <div
          ref="chatContainerRef"
          data-testid="messages-list"
          class="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-6 sm:py-4"
        >
          <!-- 头部与气泡的对端头像共用页面的同一个插槽：内容一致，没必要让页面写两遍 -->
          <ChatMessageBubble
            v-for="msg in activeConversation.messages"
            :key="msg.id"
            :message="msg"
          >
            <template #peer-avatar>
              <slot name="peer-avatar" :conversation="activeConversation" />
            </template>
          </ChatMessageBubble>
        </div>

        <ChatComposer v-model="newMessage" :sending="isSending" @send="sendMessage" />
      </template>
    </div>

    <aside
      v-if="showInspector"
      data-testid="messages-inspector"
      class="flex max-h-full min-h-0 w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-zinc-200/80 bg-white/80 p-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/70"
    >
      <h3 class="font-semibold text-sm">Conversation Details</h3>
      <div class="rounded-lg border border-border p-3 space-y-2 text-sm">
        <p>
          <span class="text-muted-foreground">{{ peerLabel }}</span>
          {{ activeConversation?.participantName }}
        </p>
        <p>
          <span class="text-muted-foreground">Status:</span>
          {{ activeConversation?.online ? 'Online' : 'Offline' }}
        </p>
        <p>
          <span class="text-muted-foreground">Messages:</span>
          {{ activeConversation?.messages.length ?? 0 }}
        </p>
      </div>
      <div class="rounded-lg border border-border p-3">
        <p class="text-xs text-muted-foreground">{{ inspectorHint }}</p>
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

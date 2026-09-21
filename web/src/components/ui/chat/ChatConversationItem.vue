<script setup lang="ts">
import { formatChatDate, type ChatConversation } from '@/composables/useChatConversations'

/**
 * 会话列表里的一条。买家页与卖家页共用。
 *
 * 两侧唯一的实质差异是**头像长什么样**（买家看商家：有图、且可以点开资料抽屉；
 * 卖家看顾客：多数没图、要图标兜底），而且这差异还带着各自的副作用，
 * 所以做成了插槽而不是一堆可选参数：
 * - 早先的写法是 `avatarFallback` + `avatarAction`（后者顺便决定「头像是否是个按钮」），
 *   再配一个 `open-info` 事件往回冒 —— 结果是「卖家用哪个参数、买家用哪个参数」这种
 *   与本组件无关的知识散在了调用方。插槽把这段 markup 和它的回调一起还给页面。
 * - 头像内容**没有合理默认值**，所以插槽必填；不传就是一个空圈，不会渲染空 src 的破图。
 */
defineProps<{
  conversation: ChatConversation
  /** 是否当前选中项，决定高亮与 aria-current */
  active: boolean
}>()

defineSlots<{
  /** 头像内容；外层圆框与尺寸由本组件提供（条目里是 `h-12 w-12`） */
  avatar: (props: { conversation: ChatConversation }) => unknown
}>()

const emit = defineEmits<{ select: [] }>()
</script>

<template>
  <button
    type="button"
    data-testid="messages-conversation-item"
    class="relative w-full rounded-xl px-3 py-3 text-left transition-all duration-200"
    :class="[
      active
        ? 'bg-white shadow-md ring-1 ring-zinc-200/90 dark:bg-zinc-800 dark:ring-zinc-600/80'
        : 'hover:bg-white/70 dark:hover:bg-zinc-800/50',
    ]"
    :aria-current="active ? 'true' : 'false'"
    @click="emit('select')"
  >
    <div class="flex items-start gap-3">
      <div class="relative shrink-0">
        <div
          class="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-zinc-200/80 bg-white dark:border-zinc-600 dark:bg-zinc-800"
        >
          <slot name="avatar" :conversation="conversation" />
        </div>
        <span
          v-if="conversation.online"
          class="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-800"
        />
      </div>
      <div class="min-w-0 flex-1">
        <div class="mb-0.5 flex items-start justify-between gap-2">
          <span class="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{{
            conversation.participantName
          }}</span>
          <span class="shrink-0 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">{{
            formatChatDate(conversation.lastMessageTime)
          }}</span>
        </div>
        <p
          class="line-clamp-2 text-xs leading-snug text-zinc-500 dark:text-zinc-400"
          :class="
            conversation.unreadCount > 0 ? 'font-medium text-zinc-800 dark:text-zinc-200' : ''
          "
        >
          <!-- 只看最后一条**已加载**的消息判断「You:」前缀；没加载过就退化为不显示（原行为） -->
          <span v-if="conversation.messages[conversation.messages.length - 1]?.isSelf">You: </span>
          {{ conversation.lastMessage }}
        </p>
      </div>
    </div>
    <div
      v-if="conversation.unreadCount > 0"
      class="absolute bottom-3 right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white shadow-sm"
    >
      {{ conversation.unreadCount }}
    </div>
  </button>
</template>

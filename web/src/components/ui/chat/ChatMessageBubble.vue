<script setup lang="ts">
import { Check, CheckCheck, Paperclip } from 'lucide-vue-next'
import { formatChatTime, type ChatMessage } from '@/composables/useChatConversations'

/**
 * 单条消息气泡。买家页与卖家页共用。
 *
 * 「谁发的」只从 `message.isSelf` 读 —— 本组件**不认识角色**，模板里不会出现
 * `user` / `merchant` 这类字符串。极性在 `useChatConversations` 里就算完了。
 * 这正是三份拷贝能合一的关键：原先两侧各写一遍 `sender === 'user'` 与
 * `sender === 'merchant'`，同一个判断抄两遍、还得各写反一次。
 */
defineProps<{
  message: ChatMessage
}>()

defineSlots<{
  /**
   * 对端头像；本端消息不显示（圆框整个不渲染）。
   * 内容由调用方给 —— 头像没有合理默认值，且必须避免「空 src 的 img」那种破图。
   * 圆框与尺寸（`h-8 w-8`）由本组件提供，所以图标类请用相对尺寸（如 `h-1/2 w-1/2`）。
   */
  'peer-avatar': (props: { message: ChatMessage }) => unknown
}>()
</script>

<template>
  <div
    data-testid="messages-row"
    class="flex max-w-[min(100%,28rem)] gap-2.5 sm:max-w-[min(100%,32rem)]"
    :class="message.isSelf ? 'ml-auto flex-row-reverse' : ''"
  >
    <div
      v-if="!message.isSelf"
      class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-800"
    >
      <slot name="peer-avatar" :message="message" />
    </div>

    <div
      data-testid="messages-bubble"
      class="rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm"
      :class="
        message.isSelf
          ? 'rounded-tr-md bg-violet-600 text-white'
          : 'rounded-tl-md border border-zinc-200/90 bg-zinc-200/90 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
      "
    >
      <template v-if="message.type === 'image' && message.fileUrl">
        <img
          :src="message.fileUrl"
          :alt="message.fileName || 'image'"
          class="max-h-[220px] max-w-[220px] rounded-lg border border-white/20 object-cover"
        />
        <p v-if="message.fileName" class="mt-2 break-all text-xs opacity-90">
          {{ message.fileName }}
        </p>
      </template>
      <template v-else-if="message.type === 'attachment' && message.fileUrl">
        <a
          :href="message.fileUrl"
          :download="message.fileName || 'attachment'"
          class="inline-flex items-center gap-2 break-all underline-offset-2 hover:underline"
          :class="message.isSelf ? 'text-white' : ''"
        >
          <Paperclip class="h-4 w-4 shrink-0" />
          <span>{{ message.fileName || message.content }}</span>
        </a>
      </template>
      <p v-else>{{ message.content }}</p>
      <div
        class="mt-1.5 flex items-center justify-end gap-1 text-[10px]"
        :class="message.isSelf ? 'text-violet-100/90' : 'text-zinc-500 dark:text-zinc-400'"
      >
        {{ formatChatTime(message.timestamp) }}
        <span v-if="message.isSelf" class="inline-flex">
          <CheckCheck v-if="message.read" class="h-3.5 w-3.5" />
          <Check v-else class="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  </div>
</template>

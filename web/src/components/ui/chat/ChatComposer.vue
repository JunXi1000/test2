<script setup lang="ts">
import { Send } from 'lucide-vue-next'

/**
 * 消息输入条。买家页与卖家页共用，两处**零差异**，所以没有任何角色相关参数。
 * 滚动到底由 `useChatConversations` 负责，这里只发事件。
 */
const content = defineModel<string>({ required: true })

defineProps<{
  /** 发送中：禁用输入按钮，避免重复提交 */
  sending: boolean
}>()

const emit = defineEmits<{ send: [] }>()
</script>

<template>
  <div
    class="shrink-0 border-t border-zinc-200/80 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/80 sm:px-5 sm:py-2.5"
  >
    <div
      class="flex items-end gap-1 rounded-2xl border-2 border-violet-400/45 bg-white px-1 py-1 shadow-sm transition-shadow focus-within:border-violet-500 focus-within:shadow-md focus-within:shadow-violet-500/10 dark:border-violet-500/35 dark:bg-zinc-900"
    >
      <textarea
        v-model="content"
        rows="1"
        data-testid="messages-input"
        placeholder="Type a message..."
        class="max-h-32 min-h-[40px] flex-1 resize-none border-0 bg-transparent py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        @keydown.enter.prevent="emit('send')"
      />
      <button
        type="button"
        data-testid="messages-send"
        class="mb-0.5 mr-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-md transition-all hover:bg-violet-700 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
        :disabled="!content.trim() || sending"
        aria-label="Send"
        @click="emit('send')"
      >
        <Send class="h-[18px] w-[18px]" />
      </button>
    </div>
  </div>
</template>

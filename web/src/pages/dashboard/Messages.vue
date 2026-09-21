<script setup lang="ts">
import { ref } from 'vue'
import ChatWorkspace from '@/components/ui/chat/ChatWorkspace.vue'
import MerchantInfoPanel from '@/components/ui/chat/MerchantInfoPanel.vue'
import type { ChatConversation } from '@/composables/useChatConversations'

/**
 * 买家消息页。三栏骨架、数据层、布局全部在 `ChatWorkspace` 里，
 * 本页只剩**买家独有的那一件事**：点对端头像打开商家资料抽屉。
 */
const infoVisible = ref(false)
const infoConversation = ref<ChatConversation | null>(null)

// 抽屉展示哪条会话，由插槽里的按钮直接给出（列表头像给那一条、聊天头部头像给当前选中那条）。
// 早先这里是 `merchantInfoTargetId` + 一个 computed 回 conversations 里查，
// 因为当时「打开抽屉」和「看哪条会话」是分开的两件事；现在一次调用就带齐了。
function openInfo(conversation: ChatConversation) {
  infoConversation.value = conversation
  infoVisible.value = true
}
</script>

<template>
  <!-- 外层这层 div 只为「单根」而存在：布局会往页面根节点传 class，Transition 也只认单根，
       而抽屉必须与工作区并列（工作区不认识它，也不该认识）。 -->
  <div class="flex min-h-0 min-w-0 flex-1 flex-col">
    <ChatWorkspace
      self-sender="user"
      layout-key="dashboard-messages-layout-preferences-v1"
      title="Messages"
      search-placeholder="Search stores..."
      select-prompt="Choose a merchant from the list to start chatting"
      peer-label="Merchant:"
      inspector-hint="Ultra-wide mode enabled. Switch back to two columns with the top icon."
    >
      <template #peer-avatar="{ conversation }">
        <button
          type="button"
          class="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          aria-label="View merchant info"
          @click="openInfo(conversation)"
        >
          <img :src="conversation.participantAvatar" class="h-full w-full object-cover" alt="" />
        </button>
      </template>

      <!-- 头像按钮嵌在会话条目的按钮里，所以要 stop，否则一次点击既开抽屉又切会话 -->
      <template #conversation-avatar="{ conversation }">
        <button
          type="button"
          class="block h-full w-full rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          :aria-label="`View merchant info: ${conversation.participantName}`"
          @click.stop="openInfo(conversation)"
        >
          <img :src="conversation.participantAvatar" class="h-full w-full object-cover" alt="" />
        </button>
      </template>
    </ChatWorkspace>

    <MerchantInfoPanel v-model="infoVisible" :conversation="infoConversation" />
  </div>
</template>

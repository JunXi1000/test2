<script setup lang="ts">
import { User } from 'lucide-vue-next'
import ChatWorkspace from '@/components/ui/chat/ChatWorkspace.vue'

/**
 * 卖家消息页。除了「对端是顾客」这几处文案与头像兜底，与买家页（`dashboard/Messages.vue`）
 * 共用同一份 `ChatWorkspace`，所以这里没有脚本状态。
 */
</script>

<template>
  <ChatWorkspace
    self-sender="merchant"
    layout-key="merchant-messages-layout-preferences-v1"
    title="Customer Messages"
    search-placeholder="Search customers..."
    select-prompt="Choose a customer from the list to start chatting"
    peer-label="Customer:"
    inspector-hint="Ultra-wide mode enabled."
  >
    <!-- 顾客多数没有头像，用图标兜底。`h-1/2 w-1/2` 是相对外层圆框的尺寸：
         聊天头部 2.5rem 的框里得到 h-5（原值），气泡 2rem 的框里得到 h-4（原值）。 -->
    <template #peer-avatar="{ conversation }">
      <img
        v-if="conversation.participantAvatar"
        :src="conversation.participantAvatar"
        class="h-full w-full object-cover"
        alt=""
      />
      <User v-else class="h-1/2 w-1/2 text-zinc-400" />
    </template>

    <template #conversation-avatar="{ conversation }">
      <img
        v-if="conversation.participantAvatar"
        :src="conversation.participantAvatar"
        class="h-full w-full object-cover"
        alt=""
      />
      <User v-else class="h-1/2 w-1/2 text-zinc-400" />
    </template>
  </ChatWorkspace>
</template>

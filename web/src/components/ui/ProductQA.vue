<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import Button from '@/components/ui/button/Button.vue'
import { MessageCircle, ThumbsUp, User, ChevronDown, ChevronUp } from 'lucide-vue-next'

interface QAItem {
  id: number
  question: string
  answer: string | null
  asker: string
  answeredBy?: string
  askedAt: number
  answeredAt?: number
  helpful: number
}

const props = defineProps<{
  productId: number
  productTitle: string
}>()

const authStore = useAuthStore()
const { toast } = useToast()

// ── Mock existing Q&A ────────────────────────────────────────────────
const qaList = ref<QAItem[]>([
  {
    id: 1,
    question: 'Does this support wireless charging?',
    answer: 'Yes, it supports Qi wireless charging up to 15W.',
    asker: 'Mike R.',
    answeredBy: 'Store Owner',
    askedAt: Date.now() - 7 * 24 * 3600 * 1000,
    answeredAt: Date.now() - 6 * 24 * 3600 * 1000,
    helpful: 23,
  },
  {
    id: 2,
    question: 'What is the actual battery life for heavy use?',
    answer: 'With heavy usage (gaming, video streaming), you can expect about 6-7 hours. For normal use, it lasts a full day.',
    asker: 'Sarah K.',
    answeredBy: 'Verified Buyer',
    askedAt: Date.now() - 14 * 24 * 3600 * 1000,
    answeredAt: Date.now() - 12 * 24 * 3600 * 1000,
    helpful: 41,
  },
  {
    id: 3,
    question: 'Is the charger included in the box?',
    answer: null,
    asker: 'James T.',
    askedAt: Date.now() - 2 * 24 * 3600 * 1000,
    helpful: 5,
  },
  ...Array.from({ length: 3 }, (_, i) => ({
    id: 10 + i,
    question: [
      'Can I use this with a Mac and a PC simultaneously?',
      'Does it come with a warranty?',
      'What colors are available for this model?',
    ][i],
    answer: [
      'Yes, it works with both Mac and PC via Bluetooth or USB.',
      'Yes, it includes a 1-year manufacturer warranty, extendable to 2 years.',
      'Currently available in Space Gray, Silver, and Midnight Blue.',
    ][i],
    asker: ['Alex M.', 'Jamie L.', 'Casey B.'][i],
    answeredBy: 'Store Owner',
    askedAt: Date.now() - (14 + i * 3) * 24 * 3600 * 1000,
    answeredAt: Date.now() - (10 + i * 3) * 24 * 3600 * 1000,
    helpful: 10 + i * 7,
  })),
])

const newQuestion = ref('')
const submitting = ref(false)
const showAll = ref(false)
const visibleCount = 4

const displayedQA = computed(() => {
  if (showAll.value) return qaList.value
  return qaList.value.slice(0, visibleCount)
})

function submitQuestion() {
  const q = newQuestion.value.trim()
  if (!q) return
  if (!authStore.isAuthenticated) {
    toast({ title: 'Please log in', description: 'You need to be logged in to ask a question.', variant: 'destructive' })
    return
  }
  submitting.value = true
  // simulate submission
  setTimeout(() => {
    qaList.value.unshift({
      id: Date.now(),
      question: q,
      answer: null,
      asker: authStore.user?.name || 'You',
      askedAt: Date.now(),
      helpful: 0,
    })
    newQuestion.value = ''
    submitting.value = false
    toast({ title: 'Question submitted!', description: 'The seller will answer soon.', variant: 'success' })
  }, 500)
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const days = Math.floor(diff / (1000 * 3600 * 24))
  if (days > 30) return `${Math.floor(days / 30)}mo ago`
  if (days > 0) return `${days}d ago`
  const hours = Math.floor(diff / (1000 * 3600))
  if (hours > 0) return `${hours}h ago`
  return 'Just now'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Ask form -->
    <div class="bg-card border border-border rounded-xl p-4">
      <h4 class="font-semibold text-sm mb-3 flex items-center gap-2">
        <MessageCircle class="w-4 h-4" /> Ask a Question
      </h4>
      <div class="flex gap-2">
        <input
          v-model="newQuestion"
          type="text"
          :placeholder="`Ask about ${productTitle}...`"
          class="flex-1 h-10 rounded-lg border border-border bg-secondary px-3 text-sm outline-none focus:border-primary transition-colors"
          @keyup.enter="submitQuestion"
        />
        <Button size="sm" :disabled="!newQuestion.trim() || submitting" @click="submitQuestion">
          {{ submitting ? 'Posting...' : 'Ask' }}
        </Button>
      </div>
    </div>

    <!-- Q&A List -->
    <div class="space-y-3">
      <div
        v-for="qa in displayedQA"
        :key="qa.id"
        class="border border-border rounded-xl p-4 bg-card/50"
      >
        <div class="flex gap-3">
          <div class="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
            <User class="w-4 h-4 text-muted-foreground" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm">{{ qa.question }}</p>
            <p class="text-xs text-muted-foreground mt-0.5">
              {{ qa.asker }} · {{ timeAgo(qa.askedAt) }}
            </p>

            <!-- Answer -->
            <div v-if="qa.answer" class="mt-3 pl-4 border-l-2 border-primary/20">
              <p class="text-sm text-muted-foreground">{{ qa.answer }}</p>
              <p class="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span class="inline-flex items-center gap-0.5 font-medium text-primary">
                  <MessageCircle class="w-3 h-3" /> {{ qa.answeredBy }}
                </span>
                · {{ qa.answeredAt ? timeAgo(qa.answeredAt) : '' }}
              </p>
            </div>
            <div v-else class="mt-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 rounded-lg px-2 py-1 inline-block">
              Awaiting answer...
            </div>

            <button class="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
              <ThumbsUp class="w-3 h-3" /> Helpful ({{ qa.helpful }})
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Show more -->
    <button
      v-if="qaList.length > visibleCount"
      @click="showAll = !showAll"
      class="w-full py-2 text-sm text-primary hover:underline flex items-center justify-center gap-1"
    >
      {{ showAll ? 'Show Less' : `See all ${qaList.length} questions` }}
      <ChevronDown v-if="!showAll" class="w-4 h-4" />
      <ChevronUp v-else class="w-4 h-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import {
  BadgeCheck,
  CornerDownRight,
  Package,
  Reply,
  Star,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import EmptyState from '@/components/ui/state/EmptyState.vue'
import { useAuthStore } from '@/stores/auth'
import { useProductReviews } from '@/composables/useProductReviews'

/**
 * 商品详情页的「评价」区（含评分分布、筛选、写评价、回复、投票、图片预览）。
 *
 * 从 `ProductDetail.vue` 整块搬出来 —— 那里它占 389 行模板 + 约 490 行脚本。抽出来的
 * 依据不是行数而是**依赖**：这块唯一的外部依赖是全局的 authStore，其余状态与逻辑
 * 全是自己的，所以能连逻辑一起搬，父组件只传一个 productId。
 *
 * 仍然保留 `id="reviews-section"`：页面那套 tab 滚动联动是按 id 找区块的。
 */
const props = defineProps<{
  productId: number
}>()

const emit = defineEmits<{
  /** 评价提交成功 —— 页面据此把 tab 切回「评价」 */
  submitted: []
}>()

const authStore = useAuthStore()
const rootRef = ref<HTMLElement | null>(null)

const {
  reviewFilter,
  reviewSort,
  reviewSearch,
  onlyWithImages,
  reviewFormOpen,
  reviewSubmitting,
  reviewRating,
  reviewContent,
  reviewImages,
  reviewMaxChars,
  previewImageUrl,
  replyingToId,
  replyContent,
  replySubmitting,
  mergedReviews,
  filteredReviews,
  visibleReviews,
  hasMoreReviews,
  reviewAvg,
  reviewCharCount,
  ratingDistribution,
  getInitials,
  formatRelativeDate,
  isOwnReview,
  isReviewVoted,
  loadPersistedReviews,
  toggleHelpful,
  handleReviewImageUpload,
  removeReviewImage,
  openImagePreview,
  closeImagePreview,
  submitReview,
  openReply,
  deleteReview,
  submitReply,
  loadMoreReviews,
  resetReviewFilters,
} = useProductReviews({
  productId: props.productId,
  // 原先这段在 submitReview 里：先切 tab，等 nextTick，再滚到评价区。
  // 两件事一件是页面的状态、一件是本组件的 DOM，所以由这里接手，逻辑层不碰 DOM。
  onSubmitted: async () => {
    emit('submitted')
    await nextTick()
    rootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  },
})

onMounted(loadPersistedReviews)
</script>

<template>
  <section id="reviews-section" ref="rootRef" class="scroll-mt-40 space-y-10">
    <!-- Review Summary Header -->
    <div
      class="flex flex-col md:flex-row gap-6 md:gap-10 p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-border/50"
    >
      <!-- Average Score -->
      <div class="flex flex-col items-center justify-center gap-1 min-w-[120px]">
        <span class="text-5xl font-black text-primary">{{ reviewAvg.toFixed(1) }}</span>
        <div class="flex text-amber-400 gap-0.5">
          <Star
            v-for="i in 5"
            :key="i"
            class="w-4 h-4"
            :class="i <= Math.round(reviewAvg) ? 'fill-current' : 'opacity-20'"
          />
        </div>
        <span class="text-xs text-muted-foreground mt-1">{{ mergedReviews.length }} reviews</span>
      </div>
      <!-- Rating Distribution -->
      <div class="flex-1 space-y-1.5">
        <div v-for="item in ratingDistribution" :key="item.star" class="flex items-center gap-2">
          <span class="text-xs font-bold w-4 text-right text-muted-foreground">{{
            item.star
          }}</span>
          <Star class="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
          <div class="flex-1 h-2.5 bg-border/50 rounded-full overflow-hidden">
            <div
              class="h-full bg-amber-400 rounded-full transition-all duration-500"
              :style="{ width: `${item.percentage}%` }"
            ></div>
          </div>
          <span class="text-xs text-muted-foreground w-6 text-right">{{ item.count }}</span>
        </div>
      </div>
      <!-- Write Review CTA -->
      <div class="flex flex-col items-center justify-center gap-2">
        <Button
          variant="outline"
          class="rounded-full px-6 font-bold"
          @click="reviewFormOpen = !reviewFormOpen"
        >
          {{ reviewFormOpen ? 'CLOSE' : 'WRITE A REVIEW' }}
        </Button>
        <span class="text-[10px] text-muted-foreground">Share your experience</span>
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <Button
        v-for="star in ['all', '5', '4', '3', '2', '1']"
        :key="star"
        size="sm"
        variant="outline"
        class="rounded-full"
        :class="reviewFilter === star ? 'bg-primary text-primary-foreground' : ''"
        @click="reviewFilter = star"
      >
        {{ star === 'all' ? 'All' : `${star}★` }}
      </Button>
      <Button
        size="sm"
        variant="outline"
        class="rounded-full"
        :class="onlyWithImages ? 'bg-primary text-primary-foreground' : ''"
        @click="onlyWithImages = !onlyWithImages"
      >
        With Images
      </Button>
      <Button size="sm" variant="outline" class="rounded-full" @click="resetReviewFilters"
        >Reset</Button
      >
      <div class="min-w-[220px] flex-1 sm:flex-none">
        <input
          v-model="reviewSearch"
          type="text"
          placeholder="Search reviews..."
          class="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        />
      </div>
      <div class="ml-auto">
        <select
          v-model="reviewSort"
          class="h-9 rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="latest">Latest</option>
          <option value="top">Top Rating</option>
          <option value="most-helpful">Most Helpful</option>
        </select>
      </div>
    </div>

    <!-- Write Review Form -->
    <div v-if="reviewFormOpen" class="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div class="flex items-center gap-3 pb-2 border-b border-border">
        <template v-if="authStore.isAuthenticated && authStore.user">
          <img
            v-if="authStore.user.avatar"
            :src="authStore.user.avatar"
            class="w-9 h-9 rounded-full object-cover"
          />
          <div
            v-else
            class="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold"
          >
            {{ getInitials(authStore.user.name) }}
          </div>
          <div>
            <p class="text-sm font-bold">{{ authStore.user.name }}</p>
            <p class="text-[10px] text-muted-foreground">Posting as yourself</p>
          </div>
        </template>
        <template v-else>
          <div
            class="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs text-muted-foreground"
          >
            ?
          </div>
          <p class="text-sm text-muted-foreground">Sign in to post a review</p>
        </template>
        <div class="ml-auto flex items-center gap-1.5">
          <button
            v-for="n in 5"
            :key="n"
            type="button"
            class="text-amber-400 hover:scale-110 transition-transform"
            @click="reviewRating = n"
          >
            <Star class="w-5 h-5" :class="n <= reviewRating ? 'fill-current' : 'opacity-25'" />
          </button>
        </div>
      </div>
      <textarea
        v-model="reviewContent"
        rows="3"
        placeholder="Share your experience with this product..."
        class="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary resize-none"
      ></textarea>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <label
            class="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <input
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="handleReviewImageUpload"
            />
            <Package class="w-4 h-4" />
            Add Photos
          </label>
          <span class="text-[10px] text-muted-foreground"
            >{{ reviewCharCount }}/{{ reviewMaxChars }}</span
          >
        </div>
        <Button
          size="sm"
          :disabled="reviewSubmitting || !reviewContent.trim()"
          @click="submitReview"
        >
          {{ reviewSubmitting ? 'Posting...' : 'Post Review' }}
        </Button>
      </div>
      <div v-if="reviewImages.length" class="flex gap-2 flex-wrap">
        <div v-for="(img, idx) in reviewImages" :key="idx" class="relative">
          <img
            :src="img"
            class="w-14 h-14 rounded-lg object-cover border border-border cursor-zoom-in"
            @click="openImagePreview(img)"
          />
          <button
            type="button"
            class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center"
            @click="removeReviewImage(idx)"
          >
            <X class="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <EmptyState
      v-if="filteredReviews.length === 0"
      variant="compact"
      :description="
        mergedReviews.length === 0
          ? 'No reviews yet. Be the first to share your experience.'
          : 'No reviews match your filters.'
      "
    >
      <!-- 只有「有评价但被筛掉」才需要重置按钮；一个评价都没有时重置是无意义的 -->
      <button
        v-if="mergedReviews.length > 0"
        class="text-xs text-primary hover:underline mt-1"
        @click="resetReviewFilters"
      >
        Clear filters
      </button>
    </EmptyState>

    <!-- Review Cards -->
    <div class="space-y-4">
      <div
        v-for="review in visibleReviews"
        :key="review.id"
        class="rounded-xl border border-border bg-card overflow-hidden"
      >
        <div class="p-4 sm:p-5">
          <!-- Review Header -->
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex items-center gap-2.5">
              <img
                v-if="review.avatar"
                :src="review.avatar"
                class="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
              <div
                v-else
                class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0"
              >
                {{ getInitials(review.user) }}
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-bold">{{ review.user }}</span>
                  <span
                    v-if="review.verified"
                    class="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium"
                  >
                    <BadgeCheck class="w-3 h-3" />Verified Purchase
                  </span>
                  <span class="text-[10px] text-muted-foreground">{{
                    formatRelativeDate(review.date)
                  }}</span>
                </div>
                <div class="flex text-amber-400 gap-0.5 mt-0.5">
                  <Star
                    v-for="i in 5"
                    :key="i"
                    class="w-3 h-3"
                    :class="i <= review.rating ? 'fill-current' : 'opacity-20'"
                  />
                </div>
              </div>
            </div>
            <button
              v-if="isOwnReview(review)"
              type="button"
              class="text-muted-foreground hover:text-destructive transition-colors p-1"
              title="Delete your review"
              @click="deleteReview(review.id)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
          <!-- Review Content -->
          <p class="text-sm text-foreground/80 leading-relaxed mb-3">
            {{ review.content }}
          </p>
          <!-- Review Images -->
          <div v-if="review.images?.length" class="flex gap-2 flex-wrap mb-3">
            <img
              v-for="(img, idx) in review.images"
              :key="idx"
              :src="img"
              class="w-16 h-16 rounded-lg object-cover border border-border cursor-zoom-in hover:opacity-80 transition-opacity"
              @click="openImagePreview(img)"
            />
          </div>
          <!-- Actions -->
          <div class="flex items-center gap-4">
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              :class="isReviewVoted(review.id) ? 'text-primary' : ''"
              @click="toggleHelpful(review.id)"
            >
              <ThumbsUp
                class="w-3.5 h-3.5"
                :class="isReviewVoted(review.id) ? 'fill-current' : ''"
              />
              {{ review.helpful ?? 0 }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              @click="openReply(review.id)"
            >
              <Reply class="w-3.5 h-3.5" />
              Reply{{ review.replies?.length ? ` (${review.replies.length})` : '' }}
            </button>
          </div>
        </div>

        <!-- Replies -->
        <div v-if="review.replies?.length" class="border-t border-border bg-secondary/20">
          <div
            v-for="reply in review.replies"
            :key="reply.id"
            class="px-4 sm:px-5 py-3 flex gap-2.5 border-b border-border/50 last:border-0"
          >
            <CornerDownRight class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <img
                  v-if="reply.avatar"
                  :src="reply.avatar"
                  class="w-5 h-5 rounded-full object-cover"
                />
                <div
                  v-else
                  class="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold"
                >
                  {{ getInitials(reply.user) }}
                </div>
                <span class="text-xs font-bold">{{ reply.user }}</span>
                <span class="text-[10px] text-muted-foreground">{{
                  formatRelativeDate(reply.date)
                }}</span>
              </div>
              <p class="text-xs text-foreground/70 leading-relaxed">
                {{ reply.content }}
              </p>
            </div>
          </div>
        </div>

        <!-- Reply Input -->
        <div
          v-if="replyingToId === review.id"
          class="border-t border-border px-4 sm:px-5 py-3 flex gap-2 items-start bg-secondary/10"
        >
          <div
            class="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold flex-shrink-0 mt-0.5"
          >
            {{ authStore.user ? getInitials(authStore.user.name) : '?' }}
          </div>
          <div class="flex-1 min-w-0">
            <textarea
              v-model="replyContent"
              rows="2"
              placeholder="Write a reply..."
              class="w-full rounded-lg border border-border bg-background p-2 text-xs outline-none focus:border-primary resize-none"
            ></textarea>
            <div class="flex justify-end gap-2 mt-1.5">
              <Button
                variant="ghost"
                size="sm"
                class="h-7 text-xs px-3"
                @click="replyingToId = null"
                >Cancel</Button
              >
              <Button
                size="sm"
                class="h-7 text-xs px-3"
                data-testid="review-reply-submit"
                :disabled="replySubmitting || !replyContent.trim()"
                @click="submitReply(review.id)"
              >
                {{ replySubmitting ? 'Posting...' : 'Reply' }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Button
      v-if="hasMoreReviews"
      variant="outline"
      class="w-full h-12 rounded-2xl font-black tracking-wide"
      @click="loadMoreReviews"
    >
      Load More Reviews ({{ filteredReviews.length - visibleReviews.length }})
    </Button>

    <!-- Review image lightbox -->
    <div
      v-if="previewImageUrl"
      class="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      @click="closeImagePreview"
    >
      <img
        :src="previewImageUrl"
        class="max-w-[92vw] max-h-[88vh] rounded-xl shadow-2xl object-contain"
        @click.stop
      />
      <button
        class="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
        @click="closeImagePreview"
      >
        <X class="w-5 h-5" />
      </button>
    </div>
  </section>
</template>

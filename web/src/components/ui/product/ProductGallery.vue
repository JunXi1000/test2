<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronLeft, ChevronRight, Play, Share2 } from 'lucide-vue-next'
import { useProductGallery } from '@/composables/useProductGallery'
import type { Product } from '@/types/product'

/**
 * 商品详情页左栏：主图 / 演示视频混排、缩略图条、悬停放大镜、图片失败兜底。
 *
 * 从 `ProductDetail.vue` 整块搬出来（162 行模板 + 约 260 行脚本）。判据仍是依赖而不是行数：
 * 这块用到的三十来个标识符里，块外只有 `product`、`selectedColor` 与「分享」这一个动作，
 * 其余全是自己的状态与逻辑。
 *
 * 两件仍归页面的东西，所以做成 prop / emit 而不是搬进来：
 * - `selectedColor`：右栏的颜色选择器也在改它，且变体图要靠它切换。
 * - 分享：`shareProduct` 要用 navigator.share + toast，是页面的动作。
 */
const props = defineProps<{
  product: Product | null
  /** 选中颜色影响主图（变体图优先），也进失败兜底的 slot key */
  selectedColor: { name: string; value?: string } | null
}>()

const emit = defineEmits<{
  share: []
}>()

// 两个模板 ref 必须是本组件的顶层绑定（模板 ref 只认直接声明），所以在这里声明再传进去
const heroCardRef = ref<HTMLElement | null>(null)
const thumbnailStripRef = ref<HTMLElement | null>(null)

const {
  currentImageIndex,
  galleryItems,
  currentGalleryItem,
  isCurrentVideo,
  videoPoster,
  currentImage,
  canPrevImage,
  canNextImage,
  resolvedMainImage,
  isUsingBackupSource,
  isDevMode,
  imageFallback,
  resolveImageSrc,
  onImageError,
  selectImage,
  prevImage,
  nextImage,
  zoomActive,
  zoomLensX,
  zoomLensY,
  zoomBgPos,
  zoomPanelLeft,
  zoomPanelTop,
  ZOOM_SCALE,
  LENS_SIZE,
  ZOOM_PANEL_SIZE,
  onHeroMouseMove,
  onHeroMouseLeave,
} = useProductGallery({
  product: computed(() => props.product),
  selectedColor: computed(() => props.selectedColor),
  heroCardRef,
  thumbnailStripRef,
})
</script>

<template>
  <div class="lg:col-span-5 space-y-3 md:space-y-4 lg:sticky lg:top-24 relative w-full">
    <div
      ref="heroCardRef"
      class="product-hero-card relative aspect-[4/3] rounded-2xl md:rounded-3xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-border/50"
    >
      <!-- 演示视频：与图片混排相册，原生 controls 支持播放/暂停/全屏（阶段 4.1） -->
      <video
        v-if="isCurrentVideo"
        :key="`gallery-video-${currentImageIndex}`"
        :src="currentGalleryItem?.src"
        class="w-full h-full object-contain p-3 md:p-5"
        controls
        playsinline
        preload="metadata"
        :poster="videoPoster"
      ></video>
      <img
        v-else
        :src="
          resolveImageSrc(
            `main-${selectedColor?.name || 'default'}-${currentImageIndex}`,
            currentImage || imageFallback,
          )
        "
        class="w-full h-full object-contain p-3 md:p-5"
        :alt="product?.title"
        fetchpriority="high"
        loading="eager"
        decoding="async"
        draggable="false"
        @error="
          onImageError(
            $event,
            `main-${selectedColor?.name || 'default'}-${currentImageIndex}`,
            currentImage || imageFallback,
          )
        "
      />
      <!-- Zoom capture layer: sits above image, below buttons（视频时禁用，避免遮挡播放控件） -->
      <div
        v-if="!isCurrentVideo"
        class="hidden lg:block absolute inset-0 z-[1]"
        :class="zoomActive ? 'cursor-crosshair' : 'cursor-zoom-in'"
        @mousemove="onHeroMouseMove"
        @mouseleave="onHeroMouseLeave"
      />
      <!-- Zoom Lens Indicator -->
      <div
        v-if="!isCurrentVideo && zoomActive"
        data-testid="zoom-lens"
        class="hidden lg:block absolute pointer-events-none border-2 border-primary/40 bg-primary/10 rounded-sm z-[2]"
        :style="{
          width: `${LENS_SIZE}px`,
          height: `${LENS_SIZE}px`,
          left: `${zoomLensX}px`,
          top: `${zoomLensY}px`,
        }"
      />
      <span
        v-if="
          isDevMode &&
          isUsingBackupSource(`main-${selectedColor?.name || 'default'}-${currentImageIndex}`)
        "
        class="absolute top-4 right-16 md:top-6 md:right-20 px-2 py-1 rounded-full bg-black/50 text-white text-[10px] font-semibold tracking-wide z-[3]"
      >
        Backup image
      </span>
      <button
        v-if="galleryItems.length > 1"
        class="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/60 transition z-[3]"
        :disabled="!canPrevImage"
        :class="!canPrevImage ? 'opacity-40 cursor-not-allowed' : ''"
        @click="prevImage"
      >
        <ChevronLeft class="w-5 h-5" />
      </button>
      <button
        v-if="galleryItems.length > 1"
        class="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/60 transition z-[3]"
        :disabled="!canNextImage"
        :class="!canNextImage ? 'opacity-40 cursor-not-allowed' : ''"
        @click="nextImage"
      >
        <ChevronRight class="w-5 h-5" />
      </button>
      <!-- Badges -->
      <div
        class="absolute top-4 left-4 md:top-6 md:left-6 flex flex-col gap-1.5 md:gap-2 z-[3] pointer-events-none"
      >
        <span
          class="px-2.5 md:px-3 py-1 md:py-1.5 bg-white/90 dark:bg-black/90 backdrop-blur-md rounded-full text-[9px] md:text-[10px] font-bold tracking-wider md:tracking-widest uppercase shadow-sm"
          >New Arrival</span
        >
        <span
          v-if="Number(product?.rating ?? 0) >= 4.8"
          class="px-2.5 md:px-3 py-1 md:py-1.5 bg-primary text-primary-foreground rounded-full text-[9px] md:text-[10px] font-bold tracking-wider md:tracking-widest uppercase shadow-sm"
          >Top Rated</span
        >
      </div>
      <!-- Actions -->
      <div class="absolute top-4 right-4 md:top-6 md:right-6 z-[3]">
        <button
          class="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/90 dark:bg-black/90 backdrop-blur-md flex items-center justify-center text-foreground hover:bg-primary hover:text-white transition-all shadow-md active:scale-95"
          @click="emit('share')"
        >
          <Share2 class="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>
    </div>

    <!-- Thumbnail Strip（图片与演示视频混排，视频缩略图带播放角标） -->
    <div
      v-if="galleryItems.length > 1"
      ref="thumbnailStripRef"
      class="flex gap-2 md:gap-3 overflow-x-auto pb-2 no-scrollbar px-0.5 md:px-1 snap-x snap-mandatory scroll-px-1 md:scroll-px-2 [-webkit-overflow-scrolling:touch] justify-center lg:justify-start"
    >
      <button
        v-for="(item, idx) in galleryItems"
        :key="idx"
        :data-thumb-index="idx"
        :data-thumb-kind="item.kind"
        class="relative flex-shrink-0 snap-start w-14 h-14 md:w-16 md:h-16 rounded-lg md:rounded-xl overflow-hidden border-2 transition-all duration-300 group"
        :class="
          currentImageIndex === idx
            ? 'border-primary p-1 scale-105'
            : 'border-transparent opacity-60 hover:opacity-100'
        "
        @click="selectImage(idx)"
      >
        <template v-if="item.kind === 'video'">
          <img
            :src="resolveImageSrc(`thumb-${idx}`, videoPoster)"
            class="w-full h-full object-cover rounded-xl"
            :alt="`${product?.title || 'Product'} demo video`"
            :loading="idx <= 2 ? 'eager' : 'lazy'"
            decoding="async"
            @error="onImageError($event, `thumb-${idx}`, videoPoster)"
          />
          <span class="absolute inset-0 flex items-center justify-center rounded-xl bg-black/35">
            <span
              class="flex items-center justify-center w-6 h-6 rounded-full bg-white/95 text-foreground shadow-sm"
            >
              <Play class="w-3.5 h-3.5 ml-0.5" />
            </span>
          </span>
        </template>
        <img
          v-else
          :src="resolveImageSrc(`thumb-${idx}`, item.src || imageFallback)"
          class="w-full h-full object-cover rounded-xl"
          :alt="`${product?.title || 'Product'} thumbnail ${idx + 1}`"
          :loading="idx <= 2 ? 'eager' : 'lazy'"
          :fetchpriority="idx === currentImageIndex ? 'high' : 'low'"
          decoding="async"
          @error="onImageError($event, `thumb-${idx}`, item.src || imageFallback)"
        />
      </button>
    </div>

    <!-- Zoom Preview Panel (teleported to body for correct stacking) -->
    <Teleport to="body">
      <div
        v-if="zoomActive"
        data-testid="zoom-panel"
        class="hidden lg:block fixed rounded-2xl border border-border bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden pointer-events-none"
        :style="{
          width: `${ZOOM_PANEL_SIZE}px`,
          height: `${ZOOM_PANEL_SIZE}px`,
          left: `${zoomPanelLeft}px`,
          top: `${zoomPanelTop}px`,
          zIndex: 9999,
          backgroundImage: `url(${resolvedMainImage})`,
          backgroundSize: `${ZOOM_SCALE * 100}%`,
          backgroundPosition: zoomBgPos,
          backgroundRepeat: 'no-repeat',
        }"
      />
    </Teleport>
  </div>
</template>

<style scoped>
/* 这两条原来在页面的 <style scoped> 里，但作用对象是图集内部的元素：
   scoped 会给选择器加当前组件的 data-v 属性，搬进子组件后父组件的规则不再匹配。
   所以必须跟着搬，否则缩略图条会出现滚动条、窄屏主图圆角失效。 */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

@media (max-width: 390px) {
  .product-hero-card {
    border-radius: 1.1rem;
  }
}
</style>

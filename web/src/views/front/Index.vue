<template>
  <div class="bilibili-home">
    <!-- 现代化轮播图区域 -->
    <section class="hero-section">
      <div class="carousel-wrapper">
        <!-- 主轮播容器 -->
        <div class="carousel-main">
          <el-carousel
              ref="carouselRef"
              height="400px"
              indicator-position="none"
              arrow="never"
              :interval="8000"
              class="premium-carousel"
              :autoplay="true"
              :loop="true"
              @change="handleSlideChange"
          >
            <el-carousel-item
                v-for="(item, index) in slideshow"
                :key="index"
                class="carousel-slide"
            >
              <div class="slide-container" @click="openLink(item.link)">
                <!-- 背景图片层 -->
                <div class="bg-layer">
                  <el-image
                      :src="item.mainImg"
                      fit="contain"
                      class="bg-image"
                      :alt="item.title"
                  />
                  <div class="bg-gradient"></div>
                  <div class="bg-pattern"></div>
                </div>
              </div>
            </el-carousel-item>
          </el-carousel>
        </div>

        <!-- 导航控制区 -->
        <div class="carousel-controls">
          <!-- 自定义箭头 -->
          <button class="nav-arrow prev" @click="prevSlide" :disabled="slideshow.length <= 1">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
          </button>

          <!-- 进度指示器 -->
          <div class="progress-indicators">
            <div
                v-for="(item, index) in slideshow"
                :key="index"
                class="progress-dot"
                :class="{ 'active': currentSlide === index }"
                @click="goToSlide(index)"
            >
              <div class="dot-inner"></div>
              <div class="dot-progress" :style="{ width: currentSlide === index ? '100%' : '0%' }"></div>
            </div>
          </div>

          <button class="nav-arrow next" @click="nextSlide" :disabled="slideshow.length <= 1">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
            </svg>
          </button>
        </div>


      </div>
    </section>

    <!-- 搜索栏区域 -->
    <div class="search-section">
      <div class="search-container">
        <div class="search-wrapper">
          <el-input
              v-model="searchName"
              placeholder="搜索你想要的商品..."
              size="large"
              clearable
              class="bilibili-search"
              @keyup.enter="search"
          >
            <template #prefix>
              <el-icon class="search-icon"><Search /></el-icon>
            </template>
            <template #append>
              <el-button type="primary" class="search-btn" @click="search">
                <el-icon><Search /></el-icon>
                <span>搜索</span>
              </el-button>
            </template>
          </el-input>
        </div>
        <div class="search-tags">
          <span class="tag-label">热门搜索：</span>
          <el-tag
              v-for="tag in hotSearchTags"
              :key="tag"
              class="search-tag"
              @click="searchByTag(tag)"
          >
            {{ tag }}
          </el-tag>
        </div>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="content-sections">
      <!-- 热销商品 -->
      <div class="product-section hot-products">
        <div class="section-header">
          <div class="section-title-wrapper">
            <el-icon class="section-icon"><TrendCharts /></el-icon>
            <h2 class="section-title">热销商品</h2>
            <span class="section-subtitle">Hot Products</span>
          </div>

        </div>
        <div class="products-grid">
          <div
              v-for="product in productSalesVolumeTop"
              :key="product.id"
              class="product-card-wrapper"
          >
            <Product :product="product" class="bilibili-product-card" />
          </div>
        </div>
      </div>


    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import request from "@/utils/http.js";
import Product from "@/components/Product.vue";
import router from "@/router/index.js";
import ui from "@/utils/ui.js";
import ux from "@/utils/ux.js";
import feedback from "@/utils/feedback.js";
import {
  Search,
  TrendCharts,
  Star,
  ArrowRight
} from '@element-plus/icons-vue';
import kuq from '@/assets/kuq.png';

// 使用loading状态管理
const isLoading = ref(false);
const loadingInstance = ref(null);

// 轮播图相关状态
const currentSlide = ref(0);
const carouselRef = ref(null);

// 轮播图控制方法
function goToSlide(index) {
  currentSlide.value = index;
  if (carouselRef.value) {
    carouselRef.value.setActiveItem(index);
  }
}

// 上一张幻灯片
function prevSlide() {
  if (carouselRef.value) {
    carouselRef.value.prev();
  }
}

// 下一张幻灯片
function nextSlide() {
  if (carouselRef.value) {
    carouselRef.value.next();
  }
}

// 监听轮播图变化
function handleSlideChange(current, prev) {
  currentSlide.value = current;
}



// 了解更多功能
function learnMore(item) {
  // 可以添加更多详情展示逻辑
  console.log('了解更多:', item);
}

// 显示加载状态
function showLoading() {
  loadingInstance.value = feedback.loading.show({
    text: '加载中...',
    background: 'rgba(255, 255, 255, 0.7)'
  });
  isLoading.value = true;
}

// 隐藏加载状态
function hideLoading() {
  if (loadingInstance.value) {
    loadingInstance.value.hide();
    isLoading.value = false;
  }
}


const slideshow = ref([])
getSlideshowList()


// 获取轮播图列表
async function getSlideshowList() {
  try {
    showLoading();
    const res = await request.get("/slideshow/page", {
      params: {pageNum: 1, pageSize: 10}
    });
    if (res.data && res.data.list && res.data.list.length > 0) {
      slideshow.value = res.data.list;
    } else {
      throw new Error("Slideshow data is empty");
    }
  } catch (error) {
    feedback.toast.error('获取轮播图失败，加载默认数据');
    slideshow.value = [
      { mainImg: kuq, title: '默认图片1', link: 'https://www.bilibili.com' },
      { mainImg: kuq, title: '默认图片2', link: 'https://www.bilibili.com' },
      { mainImg: kuq, title: '默认图片3', link: 'https://www.bilibili.com' },
    ]
  } finally {
    hideLoading();
  }
}

const productSalesVolumeTop = ref([])
getProductSalesVolumeTopList()

// 获取热销商品列表
async function getProductSalesVolumeTopList() {
  try {
    const res = await request.get("/product/salesVolumeTop/12");
    productSalesVolumeTop.value = res.data;
  } catch (error) {
    feedback.toast.error('获取热销商品失败');
  }
}

const searchName = ref('')

// 热门搜索标签
const hotSearchTags = ref([
  '手机',
  '电脑',
  '家居',
  '男装'
]);

// 搜索商品
const isSearching = ref(false);
const searchDebounced = ux.performance.debounce(async () => {
  if (!searchName.value.trim()) {
    feedback.toast.warning('请输入搜索关键词');
    return;
  }
  try {
    isSearching.value = true;
    openLink('/productList?name=' + encodeURIComponent(searchName.value.trim()));
    searchName.value = ''; // 搜索后清空输入框，避免保留历史关键字
  } finally {
    isSearching.value = false;
  }
}, 300);

function search() {
  searchDebounced()
}

// 标签搜索
const searchByTag = (tag) => {
  searchName.value = tag;
  search();
};

const topAdvertising = ref({})
const leftAdvertising = ref({})
const rightAdvertising = ref({})


const advertisingList = ref([])
getAdvertisingList()

// 获取广告列表
async function getAdvertisingList() {
  try {
    const res = await request.get("/advertising/list");
    advertisingList.value = res.data;
    topAdvertising.value = res.data.find(item => item.position === '顶部');
    leftAdvertising.value = res.data.find(item => item.position === '轮播图左侧');
    rightAdvertising.value = res.data.find(item => item.position === '轮播图右侧');
  } catch (error) {
    feedback.toast.error('获取广告信息失败');
  }
}

// 打开链接
function openLink(link) {
  if (!link) return;
  try {
    window.location.href = link;
  } catch (error) {
    feedback.toast.error('链接跳转失败');
  }
}

// 生命周期钩子
onMounted(() => {
  // 预加载资源
  ux.loading.preload([
    '/assets/logo.png',
    ...slideshow.value.map(item => item.mainImg),
    topAdvertising.value?.mainImg,
    leftAdvertising.value?.mainImg,
    rightAdvertising.value?.mainImg
  ]);

  // 添加图片懒加载
  const lazyLoad = ux.loading.lazyLoad((element) => {
    element.src = element.dataset.src;
  });

  document.querySelectorAll('img[data-src]').forEach(img => {
    lazyLoad.observe(img);
  });
});

onUnmounted(() => {
  // 清理工作
  if (loadingInstance.value) {
    loadingInstance.value.hide();
  }
})



</script>

<style scoped>
/* 首页整体样式 */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');

.bilibili-home {
  background-color: #f8fafc; /* 更柔和的页面背景色 */
  min-height: 100vh;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
  'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji',
  'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
}

/* 轮播图区域 */
.hero-section {
  padding: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #e0e7ff 100%); /* 简化背景 */
}

.carousel-wrapper {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
}

.carousel-main {
  border-radius: 24px; /* 调整圆角 */
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1); /* 柔和的阴影 */
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.carousel-main:hover {
  transform: translateY(-8px);
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.15);
}

.premium-carousel {
  border-radius: 24px;
}

.carousel-slide {
  cursor: pointer;
  overflow: hidden;
}

.slide-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* 背景层设计 */
.bg-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
}

.bg-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  filter: brightness(0.75) saturate(1.15) contrast(1.1);
  animation: imageFloat 8s ease-in-out infinite;
}

@keyframes imageFloat {
  0%, 100% {
    transform: scale(1) rotate(0deg);
  }
  50% {
    transform: scale(1.02) rotate(0.5deg);
  }
}

.slide-container:hover .bg-image {
  transform: scale(1.12) rotate(1.5deg);
  filter: brightness(0.9) saturate(1.4) contrast(1.2) hue-rotate(5deg);
  animation-play-state: paused;
  transition: all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.slide-container:hover .bg-gradient {
  animation-duration: 5s;
  opacity: 0.9;
}

.slide-container:hover .bg-pattern {
  animation-duration: 8s;
  opacity: 0.8;
}

.slide-container:active {
  transform: scale(0.98);
  transition: transform 0.1s ease;
}

.slide-container:active .bg-image {
  transform: scale(1.05) rotate(0.5deg);
  filter: brightness(0.8) saturate(1.2) contrast(1.1);
}

.bg-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
      linear-gradient(
          135deg,
          rgba(71, 85, 105, 0.25) 0%,
          rgba(51, 65, 85, 0.35) 30%,
          rgba(30, 41, 59, 0.45) 70%,
          rgba(15, 23, 42, 0.5) 100%
      ),
      radial-gradient(
          ellipse at top left,
          rgba(251, 114, 153, 0.15) 0%,
          transparent 60%
      ),
      radial-gradient(
          ellipse at bottom right,
          rgba(59, 130, 246, 0.12) 0%,
          transparent 60%
      ),
      linear-gradient(
          45deg,
          rgba(168, 85, 247, 0.08) 0%,
          transparent 50%,
          rgba(251, 114, 153, 0.06) 100%
      );
  animation: gradientShift 10s ease-in-out infinite;
}

@keyframes gradientShift {
  0%, 100% {
    opacity: 1;
    background-position: 0% 0%, 0% 0%, 100% 100%, 0% 0%;
  }
  50% {
    opacity: 0.95;
    background-position: 0% 0%, 30% 20%, 70% 80%, 100% 100%;
  }
}

.bg-pattern {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
      radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.12) 0%, transparent 60%),
      radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.08) 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, rgba(251, 114, 153, 0.06) 0%, transparent 40%),
      linear-gradient(45deg,
      transparent 0%,
      rgba(255, 255, 255, 0.03) 25%,
      transparent 50%,
      rgba(59, 130, 246, 0.03) 75%,
      transparent 100%),
      conic-gradient(from 45deg at 30% 70%,
      transparent 0deg,
      rgba(168, 85, 247, 0.04) 90deg,
      transparent 180deg,
      rgba(251, 114, 153, 0.03) 270deg,
      transparent 360deg);
  opacity: 0.7;
  animation: patternMove 15s linear infinite;
}

@keyframes patternMove {
  0% {
    background-position: 0% 0%, 100% 100%, 50% 50%, 0% 0%, 0% 0%;
  }
  100% {
    background-position: 100% 100%, 0% 0%, 100% 0%, 100% 100%, 360deg;
  }
}

/* 内容层设计 */
.content-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  padding: 80px 60px;
}

.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 60px;
  width: 100%;
  align-items: center;
}

.content-left {
  color: white;
}

.content-wrapper {
  max-width: 600px;
  animation: slideInLeft 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  animation-delay: 0.4s;
  opacity: 0;
  transform: translateX(-100px) translateY(20px);
}

@keyframes slideInLeft {
  0% {
    opacity: 0;
    transform: translateX(-120px) translateY(30px) scale(0.9);
    filter: blur(10px);
  }
  60% {
    opacity: 0.8;
    transform: translateX(10px) translateY(-5px) scale(1.02);
    filter: blur(2px);
  }
  100% {
    opacity: 1;
    transform: translateX(0) translateY(0) scale(1);
    filter: blur(0);
  }
}

.content-wrapper.slide-out {
  animation: slideOutLeft 0.8s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards;
}

@keyframes slideOutLeft {
  0% {
    opacity: 1;
    transform: translateX(0) translateY(0) scale(1);
    filter: blur(0);
  }
  100% {
    opacity: 0;
    transform: translateX(-120px) translateY(-20px) scale(0.8);
    filter: blur(8px);
  }
}

.badge-container {
  margin-bottom: 24px;
}

.trending-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 12px 20px;
  border-radius: 50px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.badge-icon {
  font-size: 16px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.slide-title {
  font-size: 48px;
  font-weight: 900;
  line-height: 1.1;
  margin-bottom: 20px;
  background: linear-gradient(135deg,
  #ffffff 0%,
  #fce7f3 30%,
  #f1f5f9 60%,
  #dbeafe 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow:
      0 2px 12px rgba(0, 0, 0, 0.2),
      0 1px 6px rgba(251, 114, 153, 0.2),
      0 0 3px rgba(59, 130, 246, 0.1);
  letter-spacing: -0.02em;
  position: relative;
  animation: titleGlow 4s ease-in-out infinite;
}

.slide-title::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg,
  rgba(251, 114, 153, 0.8) 0%,
  rgba(59, 130, 246, 0.6) 50%,
  rgba(168, 85, 247, 0.4) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: -1;
}

.content-left:hover .slide-title {
  animation-duration: 2s;
  transform: translateY(-2px);
}

.content-left:hover .slide-title::before {
  opacity: 0.4;
  animation: titleShimmer 2s ease-in-out infinite;
}

@keyframes titleShimmer {
  0%, 100% {
    opacity: 0.4;
    transform: translateX(0);
  }
  50% {
    opacity: 0.6;
    transform: translateX(5px);
  }
}

@keyframes titleGlow {
  0%, 100% {
    filter: brightness(1) drop-shadow(0 0 10px rgba(255, 255, 255, 0.3));
  }
  50% {
    filter: brightness(1.1) drop-shadow(0 0 20px rgba(251, 114, 153, 0.4));
  }
}

.slide-description {
  font-size: 18px;
  line-height: 1.7;
  opacity: 0.95;
  margin-bottom: 40px;
  text-shadow:
      0 2px 8px rgba(0, 0, 0, 0.2),
      0 1px 4px rgba(251, 114, 153, 0.1);
  font-weight: 400;
  position: relative;
  animation: descriptionFloat 6s ease-in-out infinite;
}

.slide-description::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 0;
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg,
  rgba(251, 114, 153, 0.8) 0%,
  rgba(59, 130, 246, 0.6) 50%,
  rgba(168, 85, 247, 0.4) 100%);
  border-radius: 1px;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.content-left:hover .slide-description {
  color: rgba(255, 255, 255, 0.95);
  transform: translateY(-1px);
  animation-duration: 3s;
}

.content-left:hover .slide-description::after {
  transform: scaleX(1);
  animation: underlineGlow 2s ease-in-out infinite;
}

@keyframes underlineGlow {
  0%, 100% {
    box-shadow: 0 0 5px rgba(251, 114, 153, 0.3);
  }
  50% {
    box-shadow: 0 0 15px rgba(251, 114, 153, 0.6), 0 0 25px rgba(59, 130, 246, 0.3);
  }
}

@keyframes descriptionFloat {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}

.action-group {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.cta-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 16px 32px;
  border: none;
  border-radius: 50px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-decoration: none;
  position: relative;
  overflow: hidden;
}

.cta-button.primary {
  background: linear-gradient(135deg,
  #fb7299 0%,
  #ff6b9d 50%,
  #ff8fab 100%);
  color: white;
  box-shadow:
      0 10px 30px rgba(251, 114, 153, 0.4),
      0 5px 15px rgba(255, 107, 157, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  position: relative;
  overflow: hidden;
}

.cta-button.primary::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg,
  transparent 0%,
  rgba(255, 255, 255, 0.3) 50%,
  transparent 100%);
  transition: left 0.6s ease;
}

.cta-button.primary:hover::before {
  left: 100%;
}

.cta-button.primary:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow:
      0 20px 50px rgba(251, 114, 153, 0.5),
      0 10px 25px rgba(255, 107, 157, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      0 0 20px rgba(251, 114, 153, 0.3);
  background: linear-gradient(135deg,
  #ff6b9d 0%,
  #ff8fab 50%,
  #ffa8c5 100%);
  animation: buttonPulse 0.6s ease;
}

@keyframes buttonPulse {
  0% {
    box-shadow:
        0 10px 30px rgba(251, 114, 153, 0.4),
        0 5px 15px rgba(255, 107, 157, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  50% {
    box-shadow:
        0 25px 60px rgba(251, 114, 153, 0.6),
        0 15px 35px rgba(255, 107, 157, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.4),
        0 0 30px rgba(251, 114, 153, 0.4);
  }
  100% {
    box-shadow:
        0 20px 50px rgba(251, 114, 153, 0.5),
        0 10px 25px rgba(255, 107, 157, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.3),
        0 0 20px rgba(251, 114, 153, 0.3);
  }
}

.cta-button.secondary {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
}

.cta-button.secondary:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
}

.btn-icon, .btn-arrow {
  transition: transform 0.3s ease;
}

.cta-button:hover .btn-arrow {
  transform: translateX(4px);
}

.cta-button:hover .btn-icon {
  transform: rotate(180deg);
}

/* 右侧特性展示 */
.content-right {
  display: flex;
  justify-content: center;
  align-items: center;
}

.feature-showcase {
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: slideInRight 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  animation-delay: 0.6s;
  opacity: 0;
  transform: translateX(100px) translateY(20px);
}

@keyframes slideInRight {
  0% {
    opacity: 0;
    transform: translateX(120px) translateY(30px) scale(0.9) rotateY(-20deg);
    filter: blur(10px);
  }
  60% {
    opacity: 0.8;
    transform: translateX(-10px) translateY(-5px) scale(1.02) rotateY(5deg);
    filter: blur(2px);
  }
  100% {
    opacity: 1;
    transform: translateX(0) translateY(0) scale(1) rotateY(0deg);
    filter: blur(0);
  }
}

.feature-showcase.slide-out {
  animation: slideOutRight 0.8s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards;
}

@keyframes slideOutRight {
  0% {
    opacity: 1;
    transform: translateX(0) translateY(0) scale(1) rotateY(0deg);
    filter: blur(0);
  }
  100% {
    opacity: 0;
    transform: translateX(120px) translateY(-20px) scale(0.8) rotateY(20deg);
    filter: blur(8px);
  }
}

.feature-card {
  display: flex;
  align-items: center;
  gap: 18px;
  background: linear-gradient(135deg,
  rgba(255, 255, 255, 0.12) 0%,
  rgba(255, 255, 255, 0.06) 100%);
  backdrop-filter: blur(25px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 24px 28px;
  border-radius: 24px;
  color: white;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  box-shadow:
      0 8px 25px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg,
  transparent 0%,
  rgba(255, 255, 255, 0.1) 50%,
  transparent 100%);
  transition: left 0.6s ease;
}

.feature-card:hover::before {
  left: 100%;
}

.feature-card:hover {
  background: linear-gradient(135deg,
  rgba(255, 255, 255, 0.18) 0%,
  rgba(255, 255, 255, 0.08) 100%);
  transform: translateX(-8px) translateY(-3px);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow:
      0 15px 40px rgba(0, 0, 0, 0.15),
      0 5px 15px rgba(59, 130, 246, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.feature-icon {
  font-size: 28px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg,
  rgba(59, 130, 246, 0.2) 0%,
  rgba(29, 78, 216, 0.1) 100%);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
  position: relative;
  z-index: 1;
}

.feature-card:hover .feature-icon {
  transform: scale(1.1) rotate(5deg);
  background: linear-gradient(135deg,
  rgba(59, 130, 246, 0.3) 0%,
  rgba(29, 78, 216, 0.2) 100%);
  box-shadow: 0 5px 15px rgba(59, 130, 246, 0.2);
}

.feature-text {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.3px;
  transition: all 0.3s ease;
  position: relative;
  z-index: 1;
}

.feature-card:hover .feature-text {
  transform: translateX(2px);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* 导航控制区 */
.carousel-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40px;
  margin-top: 30px;
  padding: 0 20px;
}

.nav-arrow {
  width: 70px;
  height: 70px;
  border: none;
  border-radius: 50%;
  background:
      linear-gradient(135deg,
      rgba(255, 255, 255, 0.15) 0%,
      rgba(255, 255, 255, 0.08) 50%,
      rgba(255, 255, 255, 0.12) 100%),
      radial-gradient(circle at 30% 30%, rgba(251, 114, 153, 0.1) 0%, transparent 70%);
  backdrop-filter: blur(25px) saturate(1.2);
  border: 2px solid rgba(255, 255, 255, 0.25);
  color: white;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  box-shadow:
      0 8px 25px rgba(0, 0, 0, 0.2),
      0 4px 12px rgba(251, 114, 153, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.nav-arrow::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg,
  transparent 0%,
  rgba(255, 255, 255, 0.1) 50%,
  transparent 100%);
  border-radius: 50%;
  transform: translateX(-100%) rotate(45deg);
  transition: transform 0.6s ease;
}

.nav-arrow:hover:not(:disabled) {
  background:
      linear-gradient(135deg,
      rgba(255, 255, 255, 0.25) 0%,
      rgba(255, 255, 255, 0.15) 50%,
      rgba(255, 255, 255, 0.2) 100%),
      radial-gradient(circle at 30% 30%, rgba(251, 114, 153, 0.15) 0%, transparent 70%),
      radial-gradient(circle at 70% 70%, rgba(59, 130, 246, 0.1) 0%, transparent 70%);
  transform: scale(1.15) translateY(-2px);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow:
      0 15px 40px rgba(0, 0, 0, 0.3),
      0 8px 20px rgba(251, 114, 153, 0.2),
      0 4px 10px rgba(59, 130, 246, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.4),
      0 0 20px rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(30px) saturate(1.4);
}

.nav-arrow:hover:not(:disabled)::before {
  transform: translateX(100%) rotate(45deg);
}

.nav-arrow:active:not(:disabled) {
  transform: scale(1.05) translateY(0);
}

.nav-arrow:disabled {
  opacity: 0.2;
  cursor: not-allowed;
  transform: scale(0.9);
}

.nav-arrow svg {
  width: 32px;
  height: 32px;
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  z-index: 1;
  position: relative;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
}

.nav-arrow:hover:not(:disabled) svg {
  transform: scale(1.2);
  filter:
      drop-shadow(0 3px 12px rgba(0, 0, 0, 0.4))
      drop-shadow(0 1px 6px rgba(251, 114, 153, 0.3))
      drop-shadow(0 0 3px rgba(59, 130, 246, 0.2))
      drop-shadow(0 0 8px rgba(255, 255, 255, 0.4));
}

.nav-arrow.prev:hover:not(:disabled) svg {
  transform: scale(1.2) translateX(-3px);
  animation: arrowPulseLeft 0.6s ease-in-out;
}

.nav-arrow.next:hover:not(:disabled) svg {
  transform: scale(1.2) translateX(3px);
  animation: arrowPulseRight 0.6s ease-in-out;
}

@keyframes arrowPulseLeft {
  0%, 100% {
    transform: scale(1.2) translateX(-3px);
  }
  50% {
    transform: scale(1.3) translateX(-5px);
  }
}

@keyframes arrowPulseRight {
  0%, 100% {
    transform: scale(1.2) translateX(3px);
  }
  50% {
    transform: scale(1.3) translateX(5px);
  }
}

.progress-indicators {
  display: flex;
  gap: 20px;
  align-items: center;
  padding: 15px 25px;
  background:
      linear-gradient(135deg,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.05) 100%),
      radial-gradient(ellipse at center, rgba(251, 114, 153, 0.08) 0%, transparent 70%);
  backdrop-filter: blur(20px) saturate(1.2);
  border-radius: 50px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow:
      0 8px 25px rgba(0, 0, 0, 0.2),
      0 4px 12px rgba(251, 114, 153, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.progress-dot {
  position: relative;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background:
      linear-gradient(135deg,
      rgba(255, 255, 255, 0.3) 0%,
      rgba(255, 255, 255, 0.1) 100%),
      radial-gradient(circle at 30% 30%, rgba(251, 114, 153, 0.2) 0%, transparent 70%);
  cursor: pointer;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  border: 2px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.progress-dot::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  background: linear-gradient(135deg,
  rgba(251, 114, 153, 0.8) 0%,
  rgba(59, 130, 246, 0.6) 100%);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  transition: transform 0.3s ease;
}

.progress-dot:hover:not(.active) {
  background:
      linear-gradient(135deg,
      rgba(255, 255, 255, 0.6) 0%,
      rgba(255, 255, 255, 0.4) 100%),
      radial-gradient(circle at 30% 30%, rgba(251, 114, 153, 0.25) 0%, transparent 70%);
  transform: scale(1.2);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow:
      0 6px 18px rgba(0, 0, 0, 0.25),
      0 3px 10px rgba(251, 114, 153, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.4),
      0 0 15px rgba(255, 255, 255, 0.3);
}

.progress-dot:hover:not(.active)::before {
  transform: translate(-50%, -50%) scale(0.6);
  opacity: 0.6;
}

.progress-dot.active {
  background:
      linear-gradient(135deg,
      rgba(255, 255, 255, 0.9) 0%,
      rgba(255, 255, 255, 0.7) 100%),
      radial-gradient(circle at 30% 30%, rgba(251, 114, 153, 0.3) 0%, transparent 70%),
      radial-gradient(circle at 70% 70%, rgba(59, 130, 246, 0.2) 0%, transparent 70%);
  transform: scale(1.3);
  border-color: rgba(255, 255, 255, 0.6);
  box-shadow:
      0 8px 25px rgba(0, 0, 0, 0.3),
      0 4px 15px rgba(251, 114, 153, 0.4),
      0 2px 8px rgba(59, 130, 246, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.5),
      0 0 20px rgba(255, 255, 255, 0.6);
  animation: dotPulse 2s ease-in-out infinite;
}

.progress-dot.active::before {
  transform: translate(-50%, -50%) scale(1);
  animation: innerGlow 2s ease-in-out infinite;
}

@keyframes dotPulse {
  0%, 100% {
    box-shadow:
        0 8px 25px rgba(0, 0, 0, 0.3),
        0 4px 15px rgba(251, 114, 153, 0.4),
        0 2px 8px rgba(59, 130, 246, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.5),
        0 0 20px rgba(255, 255, 255, 0.6);
  }
  50% {
    box-shadow:
        0 10px 30px rgba(0, 0, 0, 0.4),
        0 6px 20px rgba(251, 114, 153, 0.6),
        0 3px 12px rgba(59, 130, 246, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.6),
        0 0 30px rgba(255, 255, 255, 0.8);
  }
}

@keyframes innerGlow {
  0%, 100% {
    opacity: 0.8;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.2);
  }
}

.dot-inner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.dot-progress {
  position: absolute;
  top: -2px;
  left: -2px;
  width: calc(100% + 4px);
  height: calc(100% + 4px);
  border-radius: 50%;
  background: conic-gradient(
      from 0deg,
      rgba(251, 114, 153, 0.9) 0deg,
      rgba(59, 130, 246, 0.7) 120deg,
      rgba(168, 85, 247, 0.8) 240deg,
      rgba(251, 114, 153, 0.9) 360deg
  );
  opacity: 0;
  transition: all 0.4s ease;
  animation: progressRotate 3s linear infinite;
}

.progress-dot.active .dot-progress {
  opacity: 1;
  animation: progressRotate 3s linear infinite, progressGlow 2s ease-in-out infinite;
}

@keyframes progressRotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes progressGlow {
  0%, 100% {
    filter:
        drop-shadow(0 0 8px rgba(251, 114, 153, 0.6))
        drop-shadow(0 0 4px rgba(59, 130, 246, 0.4));
    opacity: 1;
  }
  50% {
    filter:
        drop-shadow(0 0 20px rgba(251, 114, 153, 0.9))
        drop-shadow(0 0 12px rgba(59, 130, 246, 0.7))
        drop-shadow(0 0 6px rgba(168, 85, 247, 0.5));
    opacity: 0.8;
  }
}



/* 响应式设计 */
@media (max-width: 1200px) {
  .carousel-main {
    border-radius: 30px;
    margin: 0 20px;
  }

  .carousel-main::before {
    border-radius: 30px;
  }

  .premium-carousel {
    height: 400px !important;
  }

  .premium-carousel .el-carousel__item {
    height: 400px !important;
  }

  .content-grid {
    grid-template-columns: 1fr;
    gap: 40px;
    text-align: center;
  }

  .content-right {
    order: -1;
  }

  .content-layer {
    padding: 60px 40px;
  }

  .slide-title {
    font-size: 3rem;
    margin-bottom: 20px;
    animation-duration: 5s;
  }

  .slide-description {
    font-size: 1.1rem;
    margin-bottom: 30px;
    animation-duration: 7s;
  }

  .action-group {
    justify-content: center;
    gap: 15px;
  }

  .cta-button {
    padding: 14px 28px;
    font-size: 1rem;
  }

  .nav-arrow {
    width: 60px;
    height: 60px;
  }

  .nav-arrow svg {
    width: 28px;
    height: 28px;
  }

  .progress-indicators {
    padding: 12px 20px;
    gap: 15px;
  }

  .progress-dot {
    width: 14px;
    height: 14px;
  }

  .feature-showcase {
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
    gap: 15px;
  }

  .feature-card {
    padding: 20px;
  }

  .feature-icon {
    width: 50px;
    height: 50px;
    font-size: 24px;
  }

  .feature-text {
    font-size: 0.9rem;
  }
}

@media (max-width: 768px) {
  .hero-section {
    padding: 15px 0;
    margin: 0 0 30px 0;
  }

  .carousel-wrapper {
    padding: 0 16px;
    margin: 0 15px;
    max-width: 100%;
  }

  .carousel-main {
    border-radius: 25px;
    box-shadow:
        0 25px 80px rgba(0, 0, 0, 0.3),
        0 15px 40px rgba(251, 114, 153, 0.15),
        0 8px 20px rgba(59, 130, 246, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .carousel-main::before {
    border-radius: 25px;
    animation-duration: 10s;
  }

  .premium-carousel {
    height: 350px !important;
  }

  .premium-carousel .el-carousel__item {
    height: 350px !important;
  }

  .content-layer {
    padding: 40px 30px;
  }

  .slide-title {
    font-size: 32px;
    animation-duration: 6s;
  }

  .slide-description {
    font-size: 16px;
    animation-duration: 8s;
  }

  .slide-description::after {
    width: 40px;
  }

  .action-group {
    justify-content: center;
    flex-direction: column;
    gap: 15px;
  }

  .cta-button {
    padding: 14px 28px;
    font-size: 14px;
    width: 100%;
    max-width: 280px;
  }

  .carousel-controls {
    gap: 20px;
    margin-top: 20px;
    padding: 0 20px;
  }

  .nav-arrow {
    width: 44px;
    height: 44px;
  }

  .nav-arrow svg {
    width: 22px;
    height: 22px;
  }

  .progress-indicators {
    padding: 10px 15px;
    gap: 12px;
  }

  .progress-dot {
    width: 30px;
    height: 4px;
  }

  .progress-dot::before {
    width: 4px;
    height: 4px;
  }

  .feature-showcase {
    gap: 12px;
    animation-duration: 1.5s;
  }

  .feature-card {
    padding: 16px 20px;
  }

  .feature-icon {
    width: 32px;
    height: 32px;
    font-size: 18px;
  }

  .feature-text {
    font-size: 14px;
  }

  .bg-gradient {
    animation-duration: 12s;
  }

  .bg-pattern {
    animation-duration: 18s;
    opacity: 0.5;
  }
}

@media (max-width: 480px) {
  .hero-section {
    padding: 10px 0;
    margin: 0 0 20px 0;
  }

  .carousel-wrapper {
    margin: 0 10px;
    max-width: 100%;
  }

  .carousel-main {
    border-radius: 20px;
    box-shadow:
        0 20px 60px rgba(0, 0, 0, 0.25),
        0 10px 30px rgba(251, 114, 153, 0.12),
        0 5px 15px rgba(59, 130, 246, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  .carousel-main::before {
    border-radius: 20px;
    animation-duration: 12s;
  }

  .premium-carousel {
    height: 300px !important;
  }

  .premium-carousel .el-carousel__item {
    height: 300px !important;
  }

  .content-layer {
    padding: 30px 20px;
  }

  .slide-title {
    font-size: 28px;
    line-height: 1.2;
    animation-duration: 7s;
  }

  .slide-description {
    font-size: 14px;
    margin: 12px 0 20px;
    animation-duration: 9s;
  }

  .slide-description::after {
    width: 30px;
    height: 1.5px;
  }

  .action-group {
    flex-direction: column;
    align-items: center;
  }

  .cta-button {
    width: 100%;
    max-width: 280px;
    justify-content: center;
    padding: 12px 24px;
    font-size: 13px;
    min-height: 48px; /* 小屏幕上增加触摸目标 */
  }

  .feature-showcase {
    gap: 12px;
    flex-direction: column; /* 小屏幕垂直排列 */
    animation-duration: 1.8s;
  }

  .feature-card {
    flex: 1;
    min-width: 120px;
    flex-direction: column;
    text-align: center;
    gap: 8px;
    padding: 12px 16px;
    width: 100%; /* 全宽卡片 */
  }

  .feature-icon {
    width: 28px;
    height: 28px;
    font-size: 16px;
  }

  .feature-text {
    font-size: 13px;
  }

  .carousel-controls {
    gap: 15px;
    margin-top: 15px;
  }

  .nav-arrow {
    width: 48px; /* 增加触摸目标 */
    height: 48px;
    min-height: 48px;
  }

  .nav-arrow svg {
    width: 20px;
    height: 20px;
  }

  .progress-indicators {
    padding: 8px 12px;
    gap: 10px;
  }

  .progress-dot {
    width: 25px;
    height: 3px;
    min-height: 48px; /* 增加触摸区域 */
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .progress-dot::before {
    width: 3px;
    height: 3px;
  }

  .bg-gradient {
    animation-duration: 15s;
  }

  .bg-pattern {
    animation-duration: 20s;
    opacity: 0.4;
  }

  .premium-carousel::after {
    animation-duration: 8s;
  }

  /* 性能优化 */
  .premium-carousel {
    will-change: transform; /* 优化动画性能 */
    transform: translateZ(0); /* 启用硬件加速 */
    backface-visibility: hidden; /* 避免背面渲染 */
    perspective: 1000px; /* 3D渲染优化 */
  }

  .carousel-slide {
    will-change: transform, opacity;
    transform: translateZ(0);
    backface-visibility: hidden;
  }

  .bg-layer {
    will-change: transform, filter;
    transform: translateZ(0);
    backface-visibility: hidden;
  }

  .bg-image {
    will-change: transform;
    transform: translateZ(0);
    backface-visibility: hidden;
    image-rendering: optimizeQuality; /* 图片渲染优化 */
  }

  .content-layer {
    will-change: transform;
    transform: translateZ(0);
    contain: layout style; /* CSS包含优化 */
  }

  .nav-arrow,
  .progress-dot {
    will-change: transform;
    transform: translateZ(0);
    backface-visibility: hidden;
  }

  /* 预加载和内容可见性优化 */
  .carousel-slide:not(.active) {
    content-visibility: auto;
    contain: layout style paint;
    visibility: hidden; /* 隐藏非活动幻灯片 */
    pointer-events: none;
  }

  .carousel-slide.next,
  .carousel-slide.prev {
    visibility: visible; /* 显示相邻幻灯片 */
  }

  /* 加载状态优化 */
  .carousel-loading {
    position: relative;
    overflow: hidden;
  }

  .carousel-loading::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.1),
        transparent
    );
    animation: loadingShimmer 2s infinite;
    z-index: 10;
    transform: translateZ(0);
  }

  @keyframes loadingShimmer {
    0% { transform: translateX(-100%) translateZ(0); }
    100% { transform: translateX(100%) translateZ(0); }
  }

  /* 触摸设备优化 */
  @media (hover: none) and (pointer: coarse) {
    .carousel-main {
      touch-action: pan-y pinch-zoom; /* 优化触摸滚动 */
    }

    .nav-arrow {
      touch-action: manipulation; /* 优化触摸响应 */
    }

    /* 减少动画复杂度 */
    .shimmer,
    .progressGlow,
    .backgroundShift {
      animation: none;
    }
  }

  /* 低性能设备优化 */
  @media (prefers-reduced-motion: reduce) {
    .premium-carousel *,
    .premium-carousel *::before,
    .premium-carousel *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  /* GPU层合成优化 */
  .carousel-main::before,
  .premium-carousel::after {
    transform: translateZ(0);
    will-change: transform, opacity;
  }

  /* 减少动画复杂度 */
  .premium-carousel.touching .bg-layer {
    transform: scale(0.99) translateZ(0); /* 减少缩放幅度 */
    filter: brightness(0.95);
  }

  .premium-carousel.touching .content-layer {
    transform: translateZ(2px) scale(0.99);
  }
}

/* 搜索栏区域 */
.search-section {
  margin-top: 10px; /* 调整与轮播图的重叠距离 */
  position: relative;
  z-index: 10;
  padding: 0 24px;
  margin-bottom: 40px; /* 增加与下方内容的间距 */
}

.search-container {
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.search-wrapper {
  margin-bottom: 20px;
}

.bilibili-search .el-input__wrapper {
  height: 56px;
  border-radius: 16px 0 0 16px !important;
  background-color: #f1f5f9;
  border: 2px solid transparent;
  box-shadow: none;
  transition: border-color 0.3s ease;
}

.bilibili-search .el-input__wrapper:hover {
  border-color: #4f46e5;
}

.bilibili-search .el-input__wrapper.is-focus {
  border-color: #4f46e5;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
}

.search-icon {
  color: #64748b;
  font-size: 20px;
}

.search-btn {
  border-radius: 0 16px 16px 0 !important;
  background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%) !important;
  border: none !important;
  color: white;
  height: 56px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.search-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4) !important;
}

.search-tags {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}

.tag-label {
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
}

.search-tag {
  cursor: pointer;
  background-color: #eef2ff;
  color: #4f46e5;
  border: 1px solid #c7d2fe;
  border-radius: 12px !important;
  padding: 8px 16px;
  transition: all 0.3s ease;
}

.search-tag:hover {
  background-color: #c7d2fe;
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}

/* 内容区域 */
.content-sections {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.product-section {
  margin-bottom: 48px;
  background-color: #f8fafc;
  border-radius: 20px;
  padding: 40px 32px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.product-section:hover {
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
  transform: translateY(-4px);
}

.section-header {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 40px;
  padding-bottom: 10px;
  border-bottom: none;
  position: relative;
}

.section-title-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-direction: column;
}

.section-icon {
  display: none;
}

.section-title {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  position: relative;
  padding-bottom: 10px;
}

.section-title::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 4px;
  background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
  border-radius: 2px;
}

.section-subtitle {
  font-size: 16px;
  color: #64748b;
  font-weight: 500;
  opacity: 1;
}

.more-btn {
  display: none;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.product-card-wrapper {
  transition: all 0.3s ease;
}

.product-card-wrapper:hover {
  transform: translateY(-8px);
}

/* 特殊区域样式 */
.hot-products {
  background: #f8fafc;
  border: 1px solid #eef2ff;
}

.recommend-products {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #eef2ff;
}

/* 响应式调整 */
@media (max-width: 1024px) {
  .content-sections {
    padding: 0 16px;
  }

  .hero-section {
    padding: 0 16px;
  }

  .search-section {
    padding: 0 16px;
  }

  .products-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .hero-section {
    padding: 0 12px;
    margin-bottom: 24px;
  }

  .search-section {
    padding: 0 12px;
    margin-bottom: 32px;
  }

  .content-sections {
    padding: 0 12px;
  }

  .bilibili-carousel {
    height: 300px !important;
  }

  .carousel-title {
    font-size: 20px;
  }

  .carousel-desc {
    font-size: 14px;
  }

  .carousel-overlay {
    padding: 20px 16px 16px;
  }

  .product-section {
    padding: 20px;
    margin-bottom: 32px;
  }

  .section-title {
    font-size: 20px;
  }

  .section-icon {
    font-size: 20px;
    padding: 6px;
  }

  .products-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }

  .search-tags {
    justify-content: flex-start;
  }

  .bilibili-search .el-input__inner {
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .products-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .search-btn span {
    display: none;
  }
}
</style>

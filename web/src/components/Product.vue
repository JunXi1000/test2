<template>
  <!-- B站风格商品卡片 -->
  <div 
    class="bilibili-product-card" 
    @click="router.push('/productDetails/'+props.product.id)"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <!-- 商品图片区域 -->
    <div class="product-image-wrapper">
      <el-image 
        class="product-image" 
        :class="{ 'image-loaded': imageLoaded }"
        :src="props.product.mainImg"
        fit="cover"
        loading="lazy"
        :preview-src-list="[props.product.mainImg]"
        @load="handleImageLoad"
      >
        <template #placeholder>
          <div class="image-placeholder">
            <el-icon class="loading-icon"><Loading /></el-icon>
            <span class="loading-text">加载中...</span>
          </div>
        </template>
        <template #error>
          <div class="image-error">
            <el-icon><Picture /></el-icon>
            <span class="error-text">加载失败</span>
          </div>
        </template>
      </el-image>
      
      <!-- 悬浮遮罩层 -->
      <div class="image-overlay" :class="{ 'overlay-visible': hover }">
        <div class="overlay-content">
          <el-icon class="view-icon"><View /></el-icon>
          <span class="view-text">查看详情</span>
        </div>
      </div>
      
      <!-- 商品标签 -->
      <div class="product-tags">
        <div v-if="props.product.isHot" class="product-tag hot-tag">
          <el-icon><TrendCharts /></el-icon>
          <span>热销</span>
        </div>
        <div v-if="props.product.isNew" class="product-tag new-tag">
          <el-icon><Star /></el-icon>
          <span>新品</span>
        </div>
      </div>
    </div>
    
    <!-- 商品信息区域 -->
    <div class="product-content">
      <h3 class="product-title">
        {{ props.product.name }}
      </h3>
      
      <div class="product-details">
        <div class="price-section">
          <span class="price-symbol">￥</span>
          <span class="price-value">{{ formatPrice(props.product.price) }}</span>
          <span class="price-decimal">.{{ getPriceDecimal(props.product.price) }}</span>
        </div>
        
        <div class="sales-section">
          <div class="sales-badge">
            <el-icon class="sales-icon"><ShoppingBag /></el-icon>
            <span class="sales-text">{{ formatSales(props.product.salesVolume) }}</span>
          </div>
        </div>
      </div>
      
      <!-- 操作按钮 -->
      <div class="product-actions" :class="{ 'actions-visible': hover }">
        <el-button 
          type="primary" 
          size="small" 
          class="add-cart-btn"
          @click.stop="addToCart"
        >
          <el-icon><ShoppingCart /></el-icon>
          <span>加入购物车</span>
        </el-button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { defineProps, ref, computed } from "vue";
import { 
  Loading, 
  Picture, 
  View, 
  TrendCharts, 
  Star, 
  ShoppingBag, 
  ShoppingCart 
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import router from "@/router/index.js";

// 图片加载状态管理
const imageLoaded = ref(false);
const handleImageLoad = () => {
  imageLoaded.value = true;
};

// 悬浮状态控制
const hover = ref(false);

// 组件属性定义
const props = defineProps({
  product: {
    type: Object,
    required: true
  }
});

// 价格格式化函数
const formatPrice = (price) => {
  return Math.floor(price).toString();
};

const getPriceDecimal = (price) => {
  const decimal = (price % 1).toFixed(2).substring(2);
  return decimal;
};

// 销量格式化函数
const formatSales = (sales) => {
  if (sales >= 10000) {
    return `${(sales / 10000).toFixed(1)}万`;
  } else if (sales >= 1000) {
    return `${(sales / 1000).toFixed(1)}k`;
  }
  return sales.toString();
};

// 添加到购物车功能
const addToCart = () => {
  // 这里可以添加具体的购物车逻辑
  ElMessage.success('已添加到购物车');
};
</script>

<style scoped>
/* B站风格商品卡片 */
.bilibili-product-card {
  width: 100%;
  max-width: 280px;
  background: var(--el-bg-color);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  border: 1px solid var(--el-border-color-lighter);
  position: relative;
  box-shadow: 0 2px 8px rgba(251, 114, 153, 0.1);
}

.bilibili-product-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(251, 114, 153, 0.2);
  border-color: var(--el-color-primary-light-5);
}

/* 图片容器 */
.product-image-wrapper {
  position: relative;
  width: 100%;
  height: 200px;
  overflow: hidden;
  background: linear-gradient(135deg, #fef7ff 0%, #f3e8ff 100%);
}

.product-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.bilibili-product-card:hover .product-image {
  transform: scale(1.08);
  filter: brightness(1.1);
}

/* 悬浮遮罩层 */
.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(251, 114, 153, 0.8), rgba(147, 51, 234, 0.8));
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  backdrop-filter: blur(2px);
}

.overlay-visible {
  opacity: 1;
}

.overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: white;
  transform: translateY(10px);
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.overlay-visible .overlay-content {
  transform: translateY(0);
}

.view-icon {
  font-size: 24px;
}

.view-text {
  font-size: 14px;
  font-weight: 500;
}

/* 加载状态 */
.image-placeholder,
.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: var(--el-text-color-placeholder);
  background: linear-gradient(135deg, #fef7ff 0%, #f3e8ff 100%);
}

.loading-icon {
  font-size: 24px;
  animation: bilibili-spin 1.5s linear infinite;
}

.loading-text,
.error-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

@keyframes bilibili-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 商品标签 */
.product-tags {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
  z-index: 3;
}

.product-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  color: white;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.hot-tag {
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
}

.new-tag {
  background: linear-gradient(135deg, #4ecdc4, #44a08d);
}

/* 商品内容区域 */
.product-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.product-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  min-height: 44px;
  transition: color 0.3s ease;
}

.bilibili-product-card:hover .product-title {
  color: var(--el-color-primary);
}

/* 商品详情 */
.product-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price-section {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.price-symbol {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-color-primary);
}

.price-value {
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--el-color-primary), #ec4899);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.price-decimal {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-color-primary-light-3);
}

.sales-section {
  display: flex;
  align-items: center;
}

.sales-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9), var(--el-color-primary-light-8));
  border-radius: 16px;
  border: 1px solid var(--el-color-primary-light-7);
}

.sales-icon {
  font-size: 12px;
  color: var(--el-color-primary);
}

.sales-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-color-primary-dark-2);
}

/* 操作按钮 */
.product-actions {
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.actions-visible {
  opacity: 1;
  transform: translateY(0);
}

.add-cart-btn {
  width: 100%;
  border-radius: 20px;
  background: linear-gradient(135deg, var(--el-color-primary), #ec4899);
  border: none;
  font-weight: 500;
  transition: all 0.3s ease;
}

.add-cart-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.4);
}

.add-cart-btn .el-icon {
  margin-right: 6px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .bilibili-product-card {
    max-width: 100%;
    margin: 0 auto;
  }
  
  .product-image-wrapper {
    height: 180px;
  }
  
  .product-content {
    padding: 12px;
  }
  
  .product-title {
    font-size: 14px;
    min-height: 40px;
  }
  
  .price-value {
    font-size: 18px;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .bilibili-product-card {
    max-width: 240px;
  }
  
  .product-image-wrapper {
    height: 180px;
  }
}

@media (min-width: 1025px) {
  .bilibili-product-card {
    max-width: 280px;
  }
  
  .product-image-wrapper {
    height: 200px;
  }
}

/* 性能优化 */
.bilibili-product-card {
  contain: layout style paint;
  will-change: transform, box-shadow;
}

.product-image {
  contain: layout style paint;
  will-change: transform, filter;
}

/* 无障碍支持 */
.bilibili-product-card:focus {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.add-cart-btn:focus {
  box-shadow: 0 0 0 2px var(--el-color-primary-light-7);
}
</style>
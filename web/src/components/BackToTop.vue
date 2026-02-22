<template>
  <transition name="fade">
    <div 
      v-show="visible" 
      class="back-to-top" 
      @click="scrollToTop"
      :style="{ right: right + 'px', bottom: bottom + 'px' }"
    >
      <el-icon :size="20">
        <ArrowUp />
      </el-icon>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { ArrowUp } from '@element-plus/icons-vue';

// 组件属性定义
const props = defineProps({
  // 显示阈值，页面滚动超过这个距离才显示按钮
  visibilityHeight: {
    type: Number,
    default: 400
  },
  // 回到顶部的过渡时间（毫秒）
  duration: {
    type: Number,
    default: 500
  },
  // 按钮距离右侧的距离
  right: {
    type: Number,
    default: 30
  },
  // 按钮距离底部的距离
  bottom: {
    type: Number,
    default: 30
  }
});

// 按钮是否可见
const visible = ref(false);

// 监听滚动事件，控制按钮显示/隐藏
const handleScroll = () => {
  visible.value = window.pageYOffset > props.visibilityHeight;
};

// 平滑滚动到顶部
const scrollToTop = () => {
  const startTime = Date.now();
  const startPosition = window.pageYOffset;
  
  const scrollStep = () => {
    const currentTime = Date.now();
    const elapsed = currentTime - startTime;
    
    if (elapsed < props.duration) {
      // 使用缓动函数使滚动更自然
      const progress = 1 - Math.pow(1 - elapsed / props.duration, 2);
      window.scrollTo(0, startPosition * (1 - progress));
      requestAnimationFrame(scrollStep);
    } else {
      window.scrollTo(0, 0);
    }
  };
  
  requestAnimationFrame(scrollStep);
};

// 组件挂载时添加滚动监听
onMounted(() => {
  window.addEventListener('scroll', handleScroll);
});

// 组件卸载时移除滚动监听
onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<style scoped>
.back-to-top {
  position: fixed;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--primary-gradient, linear-gradient(135deg, #ff5000, #ff7e3e));
  color: white;
  border-radius: 50%;
  box-shadow: var(--box-shadow, 0 4px 12px rgba(0, 0, 0, 0.15));
  cursor: pointer;
  z-index: 999;
  transition: all var(--transition-duration, 0.3s) var(--transition-timing, cubic-bezier(0.4, 0, 0.2, 1));
}

.back-to-top:hover {
  transform: translateY(-5px);
  box-shadow: var(--box-shadow-dark, 0 6px 16px rgba(0, 0, 0, 0.2));
}

.back-to-top:active {
  transform: translateY(-2px);
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
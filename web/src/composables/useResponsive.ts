import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

/**
 * 响应式工具组合
 * 提供断点检测、响应式行为管理等功能
 */

// 断点定义
export const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

export type Breakpoint = keyof typeof BREAKPOINTS

/**
 * 断点检测
 */
export function useBreakpoint() {
  const width = ref(window.innerWidth)

  const updateWidth = () => {
    width.value = window.innerWidth
  }

  onMounted(() => {
    window.addEventListener('resize', updateWidth)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateWidth)
  })

  const breakpoint = computed<Breakpoint>(() => {
    if (width.value >= BREAKPOINTS['2xl']) return '2xl'
    if (width.value >= BREAKPOINTS.xl) return 'xl'
    if (width.value >= BREAKPOINTS.lg) return 'lg'
    if (width.value >= BREAKPOINTS.md) return 'md'
    if (width.value >= BREAKPOINTS.sm) return 'sm'
    return 'xs'
  })

  const isMobile = computed(() => width.value < BREAKPOINTS.md)
  const isTablet = computed(() => width.value >= BREAKPOINTS.md && width.value < BREAKPOINTS.lg)
  const isDesktop = computed(() => width.value >= BREAKPOINTS.lg)
  const isLargeDesktop = computed(() => width.value >= BREAKPOINTS.xl)

  return {
    width,
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
  }
}

/**
 * 响应式值
 * 根据断点返回不同的值
 */
export function useResponsiveValue<T>(
  values: Partial<Record<Breakpoint, T>> & { base: T }
) {
  const { breakpoint } = useBreakpoint()

  return computed(() => {
    return values[breakpoint.value] ?? values.base
  })
}

/**
 * 设备检测
 */
export function useDevice() {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  
  const isTouch = computed(() => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  })
  
  const isiOS = computed(() => {
    return /iPad|iPhone|iPod/.test(userAgent)
  })
  
  const isAndroid = computed(() => {
    return /Android/.test(userAgent)
  })
  
  const isMobileDevice = computed(() => {
    return /Mobi|Android|iPhone|iPad|iPod/.test(userAgent)
  })
  
  const isTabletDevice = computed(() => {
    return /iPad|Android(?!.*Mobile)|Tablet/.test(userAgent)
  })
  
  const isDesktopDevice = computed(() => {
    return !isMobileDevice.value && !isTabletDevice.value
  })

  return {
    isTouch,
    isiOS,
    isAndroid,
    isMobileDevice,
    isTabletDevice,
    isDesktopDevice,
  }
}

/**
 * 方向检测
 */
export function useOrientation() {
  const orientation = ref<OrientationType>(
    typeof screen !== 'undefined' && screen.orientation 
      ? screen.orientation.type 
      : 'portrait-primary'
  )

  const isPortrait = computed(() => orientation.value.includes('portrait'))
  const isLandscape = computed(() => orientation.value.includes('landscape'))

  const updateOrientation = () => {
    if (screen.orientation) {
      orientation.value = screen.orientation.type
    } else {
      // 降级方案
      orientation.value = window.innerWidth > window.innerHeight 
        ? 'landscape-primary' 
        : 'portrait-primary'
    }
  }

  onMounted(() => {
    window.addEventListener('orientationchange', updateOrientation)
    window.addEventListener('resize', updateOrientation)
  })

  onUnmounted(() => {
    window.removeEventListener('orientationchange', updateOrientation)
    window.removeEventListener('resize', updateOrientation)
  })

  return {
    orientation,
    isPortrait,
    isLandscape,
  }
}

/**
 * 响应式网格列数
 */
export function useGridColumns(options: {
  xs?: number
  sm?: number
  md?: number
  lg?: number
  xl?: number
  '2xl'?: number
} = {}) {
  const defaults = {
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 5,
    '2xl': 6,
  }

  const config = { ...defaults, ...options }
  const { breakpoint } = useBreakpoint()

  const columns = computed(() => {
    return config[breakpoint.value]
  })

  const gridTemplateColumns = computed(() => {
    return `repeat(${columns.value}, minmax(0, 1fr))`
  })

  return {
    columns,
    gridTemplateColumns
  }
}

/**
 * 响应式图片
 */
export function useResponsiveImage(sources: {
  xs?: string
  sm?: string
  md?: string
  lg?: string
  xl?: string
  '2xl'?: string
  fallback: string
}) {
  const { breakpoint } = useBreakpoint()

  const src = computed(() => {
    return sources[breakpoint.value] || sources.fallback
  })

  const srcset = computed(() => {
    const entries = Object.entries(sources)
      .filter(([key]) => key !== 'fallback')
      .map(([key, value]) => {
        const width = BREAKPOINTS[key as Breakpoint]
        return `${value} ${width}w`
      })
    
    return entries.join(', ')
  })

  return {
    src,
    srcset
  }
}

/**
 * 文本大小响应式
 */
export function useResponsiveText(sizes: Partial<Record<Breakpoint, string>> & { base: string }) {
  const { breakpoint } = useBreakpoint()
  
  const textSize = computed(() => {
    return sizes[breakpoint.value] ?? sizes.base
  })

  return {
    textSize
  }
}

/**
 * 间距响应式
 */
export function useResponsiveSpacing(spacing: Partial<Record<Breakpoint, string>> & { base: string }) {
  const { breakpoint } = useBreakpoint()
  
  const currentSpacing = computed(() => {
    return spacing[breakpoint.value] ?? spacing.base
  })

  return {
    currentSpacing
  }
}

/**
 * 显示/隐藏控制
 */
export function useShowOn(breakpoint: Breakpoint, direction: 'up' | 'down' = 'up') {
  const { width } = useBreakpoint()
  
  const shouldShow = computed(() => {
    const breakpointWidth = BREAKPOINTS[breakpoint]
    
    if (direction === 'up') {
      return width.value >= breakpointWidth
    } else {
      return width.value < breakpointWidth
    }
  })

  return {
    shouldShow
  }
}

/**
 * 响应式字体大小
 */
export const useResponsiveFontSize = () => {
  const { isMobile, isTablet } = useBreakpoint()

  const titleSize = computed(() => {
    if (isMobile.value) return 'text-xl'  // 20px
    if (isTablet.value) return 'text-2xl' // 24px
    return 'text-3xl' // 30px
  })

  const subtitleSize = computed(() => {
    if (isMobile.value) return 'text-lg'  // 18px
    if (isTablet.value) return 'text-xl'  // 20px
    return 'text-2xl' // 24px
  })

  const bodySize = computed(() => {
    if (isMobile.value) return 'text-sm'  // 14px
    return 'text-base' // 16px
  })

  return {
    titleSize,
    subtitleSize,
    bodySize
  }
}

/**
 * 响应式间距系统
 */
export const useResponsiveSpacingSystem = () => {
  const { isMobile, isTablet } = useBreakpoint()

  const containerPadding = computed(() => {
    if (isMobile.value) return 'px-4' // 16px
    if (isTablet.value) return 'px-6' // 24px
    return 'px-8' // 32px
  })

  const sectionPadding = computed(() => {
    if (isMobile.value) return 'py-8' // 32px
    if (isTablet.value) return 'py-12' // 48px
    return 'py-16' // 64px
  })

  const elementGap = computed(() => {
    if (isMobile.value) return 'gap-3' // 12px
    if (isTablet.value) return 'gap-4' // 16px
    return 'gap-6' // 24px
  })

  return {
    containerPadding,
    sectionPadding,
    elementGap
  }
}

/**
 * 触摸优化
 */
export function useTouchOptimization() {
  const { isTouch } = useDevice()

  const touchClasses = computed(() => {
    return isTouch.value ? {
      minHeight: 'min-h-[44px]', // 最小触摸目标
      spacing: 'space-y-4', // 更大的间距
      buttons: 'p-4', // 更大的按钮
    } : {
      minHeight: '',
      spacing: 'space-y-2',
      buttons: 'p-2',
    }
  })

  return {
    isTouch,
    touchClasses
  }
}

/**
 * 响应式图片尺寸
 */
export function useResponsiveImageSize() {
  const { isMobile, isTablet } = useBreakpoint()

  const cardImageHeight = computed(() => {
    if (isMobile.value) return 'h-48' // 192px
    if (isTablet.value) return 'h-56' // 224px
    return 'h-64' // 256px
  })

  const heroImageHeight = computed(() => {
    if (isMobile.value) return 'h-64' // 256px
    if (isTablet.value) return 'h-80' // 320px
    return 'h-96' // 384px
  })

  return {
    cardImageHeight,
    heroImageHeight
  }
}

/**
 * 响应式导航
 */
export function useResponsiveNavigation() {
  const { isMobile } = useBreakpoint()
  const isMenuOpen = ref(false)

  const toggleMenu = () => {
    isMenuOpen.value = !isMenuOpen.value
  }

  const closeMenu = () => {
    isMenuOpen.value = false
  }

  // 桌面端自动关闭移动端菜单
  onMounted(() => {
    watch(isMobile, (mobile) => {
      if (!mobile) {
        isMenuOpen.value = false
      }
    })
  })

  return {
    isMobile,
    isMenuOpen,
    toggleMenu,
    closeMenu
  }
}

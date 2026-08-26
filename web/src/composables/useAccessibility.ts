import { onMounted, onUnmounted, ref, type Ref } from 'vue'

/**
 * 可访问性工具组合
 * 提供焦点管理、ARIA标签、键盘导航等功能
 */

/**
 * 键盘快捷键管理
 */
export function useKeyboardShortcuts() {
  const shortcuts = new Map<string, (e: KeyboardEvent) => void>()

  const addShortcut = (key: string, handler: (e: KeyboardEvent) => void) => {
    shortcuts.set(key.toLowerCase(), handler)
  }

  const removeShortcut = (key: string) => {
    shortcuts.delete(key.toLowerCase())
  }

  const handleKeydown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase()
    const handler = shortcuts.get(key)
    
    if (handler) {
      // 阻止默认行为
      e.preventDefault()
      handler(e)
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
  })

  return {
    addShortcut,
    removeShortcut,
  }
}

/**
 * 焦点陷阱 - 用于模态框
 */
export function useFocusTrap(elementRef: Ref<HTMLElement | null>) {
  const trapFocus = () => {
    const element = elementRef.value
    if (!element) return

    const focusableElements = element.querySelectorAll<
      HTMLElement
    >('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')

    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    element.addEventListener('keydown', handleTabKey)
    firstElement.focus()

    return () => {
      element.removeEventListener('keydown', handleTabKey)
    }
  }

  return {
    trapFocus,
  }
}

/**
 * 跳过链接 - 用于屏幕阅读器
 */
export function useSkipLink() {
  const skipToContent = () => {
    const mainContent = document.querySelector('main') || document.querySelector('#main-content')
    if (mainContent) {
      (mainContent as HTMLElement).tabIndex = -1
      ;(mainContent as HTMLElement).focus()
    }
  }

  return {
    skipToContent,
  }
}

/**
 * 实时区域（Live Region）用于屏幕阅读器
 */
export function useLiveRegion() {
  const createLiveRegion = (politeness: 'polite' | 'assertive' = 'polite') => {
    const region = document.createElement('div')
    region.setAttribute('aria-live', politeness)
    region.setAttribute('aria-atomic', 'true')
    region.className = 'sr-only' // 视觉上隐藏但屏幕阅读器可读
    document.body.appendChild(region)

    const announce = (message: string) => {
      region.textContent = message
      setTimeout(() => {
        region.textContent = ''
      }, 1000)
    }

    return {
      announce,
      destroy: () => {
        document.body.removeChild(region)
      },
    }
  }

  return {
    createLiveRegion,
  }
}

/**
 * 键盘导航管理器
 */
export function useKeyboardNavigation() {
  const isKeyboardNav = ref(false)

  const handleMouseDown = () => {
    isKeyboardNav.value = false
    document.body.classList.remove('keyboard-nav')
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      isKeyboardNav.value = true
      document.body.classList.add('keyboard-nav')
    }
  }

  onMounted(() => {
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('mousedown', handleMouseDown)
    document.removeEventListener('keydown', handleKeyDown)
  })

  return {
    isKeyboardNav,
  }
}

/**
 * 颜色对比度检查
 */
export function useColorContrast() {
  const getContrastRatio = (color1: string, color2: string): number => {
    // 简化的对比度计算（实际项目中可以使用更复杂的算法）
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : null
    }

    const rgbToLuminance = (rgb: { r: number; g: number; b: number }) => {
      const srgb = [rgb.r, rgb.g, rgb.b].map((val) => {
        val = val / 255
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
      })

      return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
    }

    const rgb1 = hexToRgb(color1)
    const rgb2 = hexToRgb(color2)

    if (!rgb1 || !rgb2) return 1

    const lum1 = rgbToLuminance(rgb1)
    const lum2 = rgbToLuminance(rgb2)

    const brightest = Math.max(lum1, lum2)
    const darkest = Math.min(lum1, lum2)

    return (brightest + 0.05) / (darkest + 0.05)
  }

  const isAccessible = (color1: string, color2: string, level: 'AA' | 'AAA' = 'AA'): boolean => {
    const ratio = getContrastRatio(color1, color2)
    const threshold = level === 'AA' ? 4.5 : 7
    return ratio >= threshold
  }

  return {
    getContrastRatio,
    isAccessible,
  }
}

/**
 * ARIA标签生成器
 */
export function useAriaLabels() {
  const generatePaginationAria = (currentPage: number, totalPages: number) => ({
    'aria-label': `当前第 ${currentPage} 页，共 ${totalPages} 页`,
    'aria-current': currentPage === 1 ? 'page' : undefined,
  })

  const generateSortAria = (column: string, direction: 'asc' | 'desc' | null) => {
    if (!direction) {
      return {
        'aria-label': `点击按 ${column} 排序`,
        'aria-sort': 'none',
      }
    }
    return {
      'aria-label': `点击按 ${column} ${direction === 'asc' ? '升序' : '降序'} 排序`,
      'aria-sort': direction === 'asc' ? 'ascending' : 'descending',
    }
  }

  const generateMenuAria = (isExpanded: boolean, hasSubmenu: boolean = false) => ({
    'aria-expanded': isExpanded,
    'aria-haspopup': hasSubmenu ? 'true' : undefined,
  })

  const generateDialogAria = (_title: string, description?: string) => ({
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'dialog-title',
    'aria-describedby': description ? 'dialog-description' : undefined,
  })

  return {
    generatePaginationAria,
    generateSortAria,
    generateMenuAria,
    generateDialogAria,
  }
}

/**
 * 触摸目标检查
 */
export function useTouchTarget() {
  const MIN_SIZE = 44 // px, iOS和Android推荐的最小触摸目标

  const checkTouchTarget = (element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect()
    return rect.width >= MIN_SIZE && rect.height >= MIN_SIZE
  }

  const makeAccessible = (element: HTMLElement): void => {
    if (!checkTouchTarget(element)) {
      const currentPadding = window.getComputedStyle(element).padding
      element.style.minWidth = `${MIN_SIZE}px`
      element.style.minHeight = `${MIN_SIZE}px`
      element.style.padding = currentPadding || '8px'
    }
  }

  return {
    MIN_SIZE,
    checkTouchTarget,
    makeAccessible,
  }
}

import { ref, onMounted, onUnmounted, type Ref } from 'vue'

/**
 * 动画工具组合
 * 提供常用的动画和过渡功能
 */

/**
 * 进入视口动画
 * 元素滚动到视口时触发动画
 */
export function useInViewAnimation(options: {
  threshold?: number
  rootMargin?: string
  animationClass?: string
} = {}) {
  const {
    threshold = 0.1,
    rootMargin = '0px 0px -50px 0px',
    animationClass = 'fade-in'
  } = options

  const elementRef = ref<HTMLElement | null>(null)
  const isVisible = ref(false)

  onMounted(() => {
    if (!elementRef.value) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isVisible.value = true
            elementRef.value?.classList.add(animationClass)
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold,
        rootMargin
      }
    )

    observer.observe(elementRef.value)

    onUnmounted(() => {
      observer.disconnect()
    })
  })

  return {
    elementRef,
    isVisible
  }
}

/**
 * 悬停动画
 */
export function useHoverAnimation(elementRef: Ref<HTMLElement | null>, options: {
  scale?: number
  lift?: boolean
  rotate?: number
  duration?: number
} = {}) {
  const {
    scale = 1,
    lift = false,
    rotate = 0,
    duration = 300
  } = options

  const isHovered = ref(false)

  const onMouseEnter = () => {
    isHovered.value = true
    if (elementRef.value) {
      const transforms: string[] = []
      
      if (scale !== 1) transforms.push(`scale(${scale})`)
      if (lift) transforms.push('translateY(-4px)')
      if (rotate !== 0) transforms.push(`rotate(${rotate}deg)`)
      
      elementRef.value.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`
      elementRef.value.style.transform = transforms.join(' ')
    }
  }

  const onMouseLeave = () => {
    isHovered.value = false
    if (elementRef.value) {
      elementRef.value.style.transform = ''
    }
  }

  onMounted(() => {
    if (!elementRef.value) return
    
    elementRef.value.addEventListener('mouseenter', onMouseEnter)
    elementRef.value.addEventListener('mouseleave', onMouseLeave)
  })

  onUnmounted(() => {
    if (!elementRef.value) return
    
    elementRef.value.removeEventListener('mouseenter', onMouseEnter)
    elementRef.value.removeEventListener('mouseleave', onMouseLeave)
  })

  return {
    isHovered
  }
}

/**
 * 点击涟漪效果
 */
export function useRippleEffect(elementRef: Ref<HTMLElement | null>) {
  const createRipple = (event: MouseEvent) => {
    if (!elementRef.value) return

    const button = elementRef.value
    const rect = button.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const x = event.clientX - rect.left - size / 2
    const y = event.clientY - rect.top - size / 2

    const ripple = document.createElement('span')
    ripple.style.width = `${size}px`
    ripple.style.height = `${size}px`
    ripple.style.left = `${x}px`
    ripple.style.top = `${y}px`
    ripple.classList.add('ripple-effect')

    button.appendChild(ripple)

    setTimeout(() => {
      ripple.remove()
    }, 600)
  }

  onMounted(() => {
    if (!elementRef.value) return
    
    elementRef.value.addEventListener('click', createRipple)
  })

  onUnmounted(() => {
    if (!elementRef.value) return
    
    elementRef.value.removeEventListener('click', createRipple)
  })

  return {
    createRipple
  }
}

/**
 * 计数器动画
 */
export function useCountUp(target: number, options: {
  duration?: number
  start?: number
  decimals?: number
} = {}) {
  const {
    duration = 2000,
    start = 0
  } = options

  const current = ref(start)
  const isAnimating = ref(false)

  const animate = () => {
    isAnimating.value = true
    const startTime = performance.now()
    const startValue = current.value
    const diff = target - startValue

    const update = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // 使用缓动函数
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      
      current.value = startValue + diff * easeOutQuart
      
      if (progress < 1) {
        requestAnimationFrame(update)
      } else {
        current.value = target
        isAnimating.value = false
      }
    }

    requestAnimationFrame(update)
  }

  const reset = () => {
    current.value = start
    isAnimating.value = false
  }

  return {
    current,
    isAnimating,
    animate,
    reset
  }
}

/**
 * 打字机效果
 */
export function useTypewriter(text: string, options: {
  speed?: number
  delay?: number
} = {}) {
  const {
    speed = 50,
    delay = 0
  } = options

  const displayedText = ref('')
  const isTyping = ref(false)
  const isComplete = ref(false)

  const start = () => {
    isTyping.value = true
    isComplete.value = false
    displayedText.value = ''

    setTimeout(() => {
      let i = 0
      const type = () => {
        if (i < text.length) {
          displayedText.value += text.charAt(i)
          i++
          setTimeout(type, speed)
        } else {
          isTyping.value = false
          isComplete.value = true
        }
      }
      type()
    }, delay)
  }

  const reset = () => {
    displayedText.value = ''
    isTyping.value = false
    isComplete.value = false
  }

  return {
    displayedText,
    isTyping,
    isComplete,
    start,
    reset
  }
}

/**
 * 进度条动画
 */
export function useProgressAnimation(targetProgress: number, options: {
  duration?: number
  easing?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'
} = {}) {
  const {
    duration = 1000,
    easing = 'ease-out'
  } = options

  const progress = ref(0)
  const isAnimating = ref(false)

  const animate = () => {
    isAnimating.value = true
    const startTime = performance.now()
    const startProgress = progress.value
    const diff = targetProgress - startProgress

    const update = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const rawProgress = Math.min(elapsed / duration, 1)
      
      // 应用缓动函数
      let easedProgress = rawProgress
      switch (easing) {
        case 'ease-in':
          easedProgress = rawProgress * rawProgress
          break
        case 'ease-out':
          easedProgress = 1 - Math.pow(1 - rawProgress, 2)
          break
        case 'ease-in-out':
          easedProgress = rawProgress < 0.5
            ? 2 * rawProgress * rawProgress
            : 1 - Math.pow(-2 * rawProgress + 2, 2) / 2
          break
        case 'linear':
        default:
          easedProgress = rawProgress
      }
      
      progress.value = startProgress + diff * easedProgress
      
      if (rawProgress < 1) {
        requestAnimationFrame(update)
      } else {
        isAnimating.value = false
      }
    }

    requestAnimationFrame(update)
  }

  const setProgress = (value: number) => {
    progress.value = value
  }

  return {
    progress,
    isAnimating,
    animate,
    setProgress
  }
}

/**
 * 交错动画 - 为列表项添加交错延迟
 */
export function useStaggerAnimation(count: number, options: {
  delay?: number
  duration?: number
  stagger?: number
} = {}) {
  const {
    delay = 0,
    stagger = 50
  } = options

  const animatedItems = ref<Set<number>>(new Set())

  const animateItem = (index: number) => {
    setTimeout(() => {
      animatedItems.value.add(index)
    }, delay + (index * stagger))
  }

  const animateAll = () => {
    for (let i = 0; i < count; i++) {
      animateItem(i)
    }
  }

  const reset = () => {
    animatedItems.value.clear()
  }

  return {
    animatedItems,
    animateItem,
    animateAll,
    reset
  }
}

/**
 * 滚动进度动画
 */
export function useScrollProgress() {
  const scrollProgress = ref(0)
  const isScrolling = ref(false)
  let scrollTimeout: NodeJS.Timeout

  const handleScroll = () => {
    isScrolling.value = true
    clearTimeout(scrollTimeout)
    
    const windowHeight = window.innerHeight
    const documentHeight = document.documentElement.scrollHeight - windowHeight
    const scrolled = window.scrollY
    
    scrollProgress.value = (scrolled / documentHeight) * 100
    
    scrollTimeout = setTimeout(() => {
      isScrolling.value = false
    }, 150)
  }

  onMounted(() => {
    window.addEventListener('scroll', handleScroll)
    handleScroll()
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
    clearTimeout(scrollTimeout)
  })

  return {
    scrollProgress,
    isScrolling
  }
}

/**
 * 视差滚动效果
 */
export function useParallax(speed = 0.5) {
  const offset = ref(0)
  const isScrolling = ref(false)

  const handleScroll = () => {
    if (!isScrolling.value) {
      isScrolling.value = true
      window.requestAnimationFrame(updateParallax)
    }
  }

  const updateParallax = () => {
    const scrolled = window.pageYOffset
    offset.value = scrolled * speed
    isScrolling.value = false
  }

  onMounted(() => {
    window.addEventListener('scroll', handleScroll)
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
  })

  return {
    offset,
    isScrolling
  }
}

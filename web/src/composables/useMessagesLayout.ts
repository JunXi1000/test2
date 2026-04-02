import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export type MobileViewMode = 'list' | 'chat'
export type UltraWideMode = 'two' | 'three'

export function useMessagesLayout(options: {
  preferencesKey: string
  defaultSidebarWidth?: number
  minSidebarWidth?: number
  maxSidebarWidth?: number
}) {
  const {
    preferencesKey,
    defaultSidebarWidth = 320,
    minSidebarWidth = 260,
    maxSidebarWidth = 460
  } = options

  const sidebarWidth = ref(defaultSidebarWidth)
  const isSidebarCollapsed = ref(false)
  const mobileViewMode = ref<MobileViewMode>('list')
  const ultraWideMode = ref<UltraWideMode>('two')
  const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1440)
  const isResizingSidebar = ref(false)

  const isMobile = computed(() => viewportWidth.value < 768)
  const isUltraWide = computed(() => viewportWidth.value >= 1536)

  const showSidebar = computed(() => {
    if (isMobile.value) return mobileViewMode.value === 'list'
    return !isSidebarCollapsed.value
  })

  const showChat = computed(() => {
    if (isMobile.value) return mobileViewMode.value === 'chat'
    return true
  })

  const showInspector = computed(() => isUltraWide.value && ultraWideMode.value === 'three')

  const sidebarStyle = computed(() => {
    if (isMobile.value) return undefined
    return { width: `${sidebarWidth.value}px` }
  })

  function clampSidebarWidth(n: number) {
    return Math.min(maxSidebarWidth, Math.max(minSidebarWidth, n))
  }

  function updateViewportWidth() {
    viewportWidth.value = window.innerWidth
  }

  function applyPreferences() {
    try {
      const raw = localStorage.getItem(preferencesKey)
      if (!raw) return
      const prefs = JSON.parse(raw) as {
        sidebarWidth?: number
        isSidebarCollapsed?: boolean
        mobileViewMode?: MobileViewMode
        ultraWideMode?: UltraWideMode
      }
      if (typeof prefs.sidebarWidth === 'number') sidebarWidth.value = clampSidebarWidth(prefs.sidebarWidth)
      if (typeof prefs.isSidebarCollapsed === 'boolean') isSidebarCollapsed.value = prefs.isSidebarCollapsed
      if (prefs.mobileViewMode) mobileViewMode.value = prefs.mobileViewMode
      if (prefs.ultraWideMode) ultraWideMode.value = prefs.ultraWideMode
    } catch {
      // ignore invalid payload
    }
  }

  function persistPreferences() {
    localStorage.setItem(
      preferencesKey,
      JSON.stringify({
        sidebarWidth: sidebarWidth.value,
        isSidebarCollapsed: isSidebarCollapsed.value,
        mobileViewMode: mobileViewMode.value,
        ultraWideMode: ultraWideMode.value
      })
    )
  }

  function toggleSidebarCollapse() {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }

  function startSidebarResize(e: MouseEvent) {
    if (isMobile.value || isSidebarCollapsed.value) return
    isResizingSidebar.value = true
    const startX = e.clientX
    const startWidth = sidebarWidth.value
    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = startWidth + (moveEvent.clientX - startX)
      sidebarWidth.value = clampSidebarWidth(nextWidth)
    }
    const stopResize = () => {
      isResizingSidebar.value = false
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', stopResize)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', stopResize)
  }

  onMounted(() => {
    applyPreferences()
    updateViewportWidth()
    window.addEventListener('resize', updateViewportWidth)
  })

  watch([sidebarWidth, isSidebarCollapsed, mobileViewMode, ultraWideMode], persistPreferences)

  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateViewportWidth)
  })

  return {
    sidebarWidth,
    isSidebarCollapsed,
    mobileViewMode,
    ultraWideMode,
    viewportWidth,
    isResizingSidebar,
    isMobile,
    isUltraWide,
    showSidebar,
    showChat,
    showInspector,
    sidebarStyle,
    toggleSidebarCollapse,
    startSidebarResize
  }
}


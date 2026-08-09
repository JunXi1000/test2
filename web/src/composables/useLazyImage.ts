import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'

/**
 * Intersection Observer-based image lazy loading.
 * Usage: const { isLoaded, imgRef } = useLazyImage()
 *        <img ref="imgRef" :src="isLoaded ? actualSrc : placeholder" />
 */
export function useLazyImage(options?: { rootMargin?: string; threshold?: number }) {
  const isLoaded = ref(false)
  const imgRef = ref<HTMLElement | null>(null) as Ref<HTMLElement | null>
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    if (!imgRef.value) {
      isLoaded.value = true
      return
    }
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            isLoaded.value = true
            observer?.disconnect()
            observer = null
          }
        }
      },
      { rootMargin: options?.rootMargin || '200px', threshold: options?.threshold ?? 0 }
    )
    observer.observe(imgRef.value)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
  })

  return { isLoaded, imgRef }
}

import { ref } from 'vue'

export interface Toast {
  id: string
  title?: string
  description?: string
  /**
   * warning 是阶段 4c 补的：admin/merchant 页面原来用 ElMessage.warning，
   * 统一过来时不能把「警告」压成「普通提示」或拔高成「错误」，两边都会误导。
   */
  variant?: 'default' | 'destructive' | 'success' | 'warning'
  duration?: number
}

const toasts = ref<Toast[]>([])

export function useToast() {
  const toast = (options: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = {
      id,
      duration: 3000,
      variant: 'default',
      ...options,
    }

    toasts.value.push(newToast)

    if (newToast.duration !== Infinity) {
      setTimeout(() => {
        dismiss(id)
      }, newToast.duration)
    }

    return id
  }

  const dismiss = (id: string) => {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  return {
    toasts,
    toast,
    dismiss,
  }
}

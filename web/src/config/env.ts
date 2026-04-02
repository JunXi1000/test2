import { ref } from 'vue'

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api'

const getRuntimeMockValue = () => {
  try {
    const v = localStorage.getItem('RUNTIME_USE_MOCK')
    if (v === null) return null
    return v === 'true'
  } catch {
    return null
  }
}

const runtimeMock = getRuntimeMockValue()
export const USE_MOCK: boolean = runtimeMock !== null ? runtimeMock : String(import.meta.env.VITE_USE_MOCK) === 'true'

// Reactive version for components/watchers if needed, though usually we reload page
export const RUNTIME_USE_MOCK = ref(USE_MOCK)

export const FEATURE_DEV_LOGOUT: boolean =
  String(import.meta.env.VITE_FEATURE_DEV_LOGOUT) === 'true' || import.meta.env.DEV

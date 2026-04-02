interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_USE_MOCK: string
  readonly VITE_FEATURE_DEV_LOGOUT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

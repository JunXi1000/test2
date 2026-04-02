/// <reference types="vite/client" />

import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    guestOnly?: boolean
    /** Which portal this login route serves; fixed role, no tab switcher. */
    loginPortal?: 'user' | 'admin' | 'merchant'
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

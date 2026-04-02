# Environment & Build Configuration

This document explains how to configure environments for development, staging, and production, and how environment variables interact with the runtime.

## Variables

- VITE_API_BASE_URL
  - Base URL for the backend API.
  - Example: https://api.example.com
- VITE_USE_MOCK
  - Build-time flag enabling mock APIs when set to 'true'.
  - Read once at app initialization.
- VITE_FEATURE_DEV_LOGOUT
  - Enables developer helpers (Debug Panel, Force Logout buttons).
  - Recommended: true for local dev, false for production.

## Runtime Override

To enable/disable mock APIs without rebuilding:

- localStorage.RUNTIME_USE_MOCK = 'true' | 'false'
- Effective priority:
  - USE_MOCK = (RUNTIME_USE_MOCK ?? VITE_USE_MOCK)
- Debug Panel offers Mock Mode toggles and Reload action.
- Source: src/config/env.ts

## Recommended .env Files

Create environment-specific files by copying from .env.example:

- .env.local (developer machines)
  - VITE_API_BASE_URL=https://api.dev.example.com
  - VITE_USE_MOCK=true
  - VITE_FEATURE_DEV_LOGOUT=true
- .env.staging
  - VITE_API_BASE_URL=https://api.staging.example.com
  - VITE_USE_MOCK=false
  - VITE_FEATURE_DEV_LOGOUT=true
- .env.production
  - VITE_API_BASE_URL=https://api.example.com
  - VITE_USE_MOCK=false
  - VITE_FEATURE_DEV_LOGOUT=false

Notes:
- Vite loads the most specific .env.* file for the current mode.
- Do not commit real secrets; environment files should contain non-sensitive values only.

## Debug Panel Interactions

- Location: src/components/ui/debug/DebugPanel.vue
- Visible when FEATURE_DEV_LOGOUT is true.
- Provides:
  - Mock Mode enable/disable (runtime)
  - Quick auth/cart/storage clearing
  - Quick role login (dev)
  - Checkout prefill & navigation
  - Data seeding (cart, orders, addresses) for UI verification
  - Auto reload toggle

## Build & Run

- npm run dev
  - Starts local dev server (Vite).
- npm run prod or npm run build-prod
  - Builds for production.
- npm run preview
  - Serves built assets for local verification.

## Troubleshooting

- Blank page after login:
  - Cause: Stale/invalid auth session. Guard resets session (auth_cleared flag) and redirects to /login.
  - Solution: Use Force Logout (dev only) or clear local/session storage.
- Mock not reflecting changes:
  - Ensure RUNTIME_USE_MOCK aligns with intended behavior (Debug Panel -> Mock Mode). Reload to apply.
- After toggling Debug features:
  - If APIs or data don’t update, enable Auto reload in Debug Panel or manually refresh.

## Security

- Never put API keys or secrets in .env.* for client-side apps.
- Use backend-side environment variables and secure endpoints for sensitive data.

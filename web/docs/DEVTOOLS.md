# Dev Tools & Environment

This document describes the developer helpers available in the project and how to enable them safely.

## Feature Flags

- `VITE_FEATURE_DEV_LOGOUT`
  - Controls visibility of debug helpers and the “Force Logout” buttons.
  - When set to `true`, helpers are shown even outside local development.
  - Defaults to `true` in local dev (`import.meta.env.DEV`).
  - Configure in your `.env.*` files:
    - `.env.local`: `VITE_FEATURE_DEV_LOGOUT=true`
    - `.env.production`: `VITE_FEATURE_DEV_LOGOUT=false`

- `VITE_USE_MOCK`
  - Builds with mock backend enabled when `true`. This is read at initialization time.
  - You can override it at runtime via the Debug Panel (see below).

## Runtime Mock Override

At runtime, you can toggle mock mode without rebuilding:

- `localStorage.RUNTIME_USE_MOCK = 'true' | 'false'`
- The Debug Panel provides buttons for this and a Reload action to apply.
- Source: `src/config/env.ts`:
  - `USE_MOCK` reads `RUNTIME_USE_MOCK` first, falling back to `VITE_USE_MOCK`.

## Debug Panel

Visible when `FEATURE_DEV_LOGOUT` is enabled (via `VITE_FEATURE_DEV_LOGOUT` or dev mode).

- Location: `src/components/ui/debug/DebugPanel.vue`
- Rendered globally from `App.vue`
- Open via the “Debug” button fixed at the bottom-left.

### Features

- Inspect:
  - `API_BASE_URL`
  - `USE_MOCK` (effective value)
- Actions:
  - Clear Auth — logs out current session
  - Clear Cart — removes the local cart cache
  - Clear All Storage — clears both `localStorage` and `sessionStorage`
  - Mock Mode — Enable/Disable runtime mock flag, with Reload
  - Quick Nav — open common routes (Home, Login, User Dashboard, Admin Login)
- Auto Reload:
  - Toggle “Auto reload after actions” to automatically reload the page after modifying local storage or mock settings
  - Preference is preserved in `localStorage.DEBUG_AUTO_RELOAD`

### Quick Role Login (dev)

- Buttons for `User`, `Admin`, and `Merchant` generate a temporary test user and log in instantly.
- Navigation:
  - User → `/dashboard`
  - Admin → `/admin/dashboard`
  - Merchant → `/merchant/dashboard`
- Only available when helpers are enabled (`FEATURE_DEV_LOGOUT`).

### Checkout Prefill (dev)

- “Prepare Prefill” writes a development payload to `localStorage.DEBUG_CHECKOUT_PREFILL`.
- “Go Checkout” navigates to `/checkout`. On first load, Checkout reads the payload and pre-populates:
  - Email, name, address, city, country, zip
  - Card number, expiry, cvc
- After applying, the prefill key is removed automatically.

### Seed Data (dev)

- Cart:
  - Adds two demo items into the cart store for quick UI verification.
  - The cart persists in `localStorage.nexus_cart_items`.
- Orders:
  - Writes a sample array into `localStorage.DEBUG_ORDERS`.
  - The Orders API (`getOrders`) returns this array when `USE_MOCK` is enabled.
  - “Clear Orders” removes the override.

## Force Logout Buttons

- Appear in:
  - `DefaultLayout.vue` (user site header + mobile menu)
  - `AdminLayout.vue` (admin header)
  - `MerchantLayout.vue` (merchant header)
- Shown only when `FEATURE_DEV_LOGOUT` is `true`
- Clears session and cart, then navigates to the appropriate login page

## Route Guard Hardening

When the app detects an invalid or outdated auth session:

- It writes `sessionStorage.auth_cleared = '1'`
- Logs out and redirects to the Login page
- On the Login page, you’ll see a green banner and a toast indicating the session was cleared

## Recommended Workflow

1. Enable helpers locally:
   - `.env.local`: `VITE_FEATURE_DEV_LOGOUT=true`
2. Use the Debug Panel:
   - Toggle Mock Mode for backend switching
   - Clear caches when testing edge cases
3. For production:
   - `.env.production`: `VITE_FEATURE_DEV_LOGOUT=false`
   - Rely on guard logic; enable helpers temporarily only when debugging incidents

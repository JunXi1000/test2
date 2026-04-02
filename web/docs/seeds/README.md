# Seed Data Guide

This folder contains sample seed data for local development and UI demos.

## Available Seeds

- orders.sample.json — Matches the Orders API override shape used when USE_MOCK is enabled.
- addresses.sample.json — Matches the Address model shape.
- cart.sample.json — Matches the Pinia cart item shape.

## How to Apply Seeds

### Preferred: Debug Panel

Open the in-app Debug button (bottom-left) and use:

- Seed Data → Orders — writes sample orders into `localStorage.DEBUG_ORDERS` and enables `RUNTIME_USE_MOCK`.
- Seed Data → Addresses — writes sample addresses into `localStorage.DEBUG_ADDRESSES` and enables `RUNTIME_USE_MOCK`.
- Seed Data → Cart — writes demo items directly into the cart store (persisted to `localStorage.nexus_cart_items`).

Tip: enable "Auto reload after actions" to refresh automatically.

### Manual: Browser Console

You can paste JSON directly into localStorage and reload. Example snippets:

- Orders

```js
// Paste JSON from docs/seeds/orders.sample.json into the variable below
const data = [/* ...orders JSON... */];
localStorage.setItem('DEBUG_ORDERS', JSON.stringify(data));
localStorage.setItem('RUNTIME_USE_MOCK', 'true');
location.reload();
```

- Addresses

```js
// Paste JSON from docs/seeds/addresses.sample.json into the variable below
const data = [/* ...addresses JSON... */];
localStorage.setItem('DEBUG_ADDRESSES', JSON.stringify(data));
localStorage.setItem('RUNTIME_USE_MOCK', 'true');
location.reload();
```

- Cart

```js
// Paste JSON from docs/seeds/cart.sample.json into the variable below
const items = [/* ...cart JSON... */];
localStorage.setItem('nexus_cart_items', JSON.stringify(items));
location.reload();
```

## Notes

- Orders & Addresses overrides only take effect when mock mode is enabled.
  - Runtime: `localStorage.RUNTIME_USE_MOCK = 'true'` (Debug Panel toggles this for you)
  - Build-time: `VITE_USE_MOCK=true`
- To clear overrides:
  - `localStorage.removeItem('DEBUG_ORDERS')`
  - `localStorage.removeItem('DEBUG_ADDRESSES')`
- The cart persists in `localStorage.nexus_cart_items` — clear via Debug Panel or remove the key manually.

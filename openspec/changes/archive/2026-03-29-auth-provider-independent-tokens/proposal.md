## Why

AuthProvider currently processes tokens as a linear dependency chain — if any token fails, downstream tokens are blocked. This was designed for a simple `AUTH_IDENTITY → REZICS_SESSION` pipeline, but as the platform grows to include more service tokens (notification, search, future services), the model breaks down. A failing `REZICS_SESSION` should not prevent `NOTIFICATION_SESSION` from refreshing. Additionally, the refresh logic is hardcoded via a switch statement in AuthProvider, requiring code changes for every new service token. The admin panel also needs multi-token support since it manages both the auth server and the main server.

## What Changes

- **AuthProvider treats `AUTH_IDENTITY` as the sole gateway token.** All other tokens are independent service tokens that fan out from `AUTH_IDENTITY`. If `AUTH_IDENTITY` fails non-retryably, all service tokens stop. But if one service token fails, others are unaffected.
- **Service tokens refresh independently and in parallel.** After ensuring `AUTH_IDENTITY` is valid, all service tokens that need refresh are processed via `Promise.allSettled` rather than sequentially. Each has its own retry policy and dormant state.
- **Introduce a token refresh registry** to replace the hardcoded switch statement. Each service token declares how to refresh itself via a configurable map. AuthProvider looks up the refresh function from the registry — adding a new service token requires a registry entry, not an AuthProvider change.
- **AuthProvider no longer imports service-specific APIs** (`userApi`, etc.). Refresh functions are injected via the registry, making AuthProvider a generic, reusable token lifecycle manager.
- **Admin and app each configure their own token sets** with appropriate registry entries. Admin uses `[AUTH_IDENTITY, REZICS_SESSION]`; app uses `[AUTH_IDENTITY, REZICS_SESSION]` (and later `NOTIFICATION_SESSION`, `SEARCH_SESSION`, etc.).
- **AuthProvider accepts `tokens` as `undefined`** for backward compatibility with consumers that don't need service tokens — it defaults to managing `AUTH_IDENTITY` only.

## Capabilities

### New Capabilities

- `token-refresh-registry`: A configurable map from `NormalizedTokenName` to refresh function, allowing service tokens to declare their refresh strategy without modifying AuthProvider. Lives in `@rezics/api` alongside the existing token infrastructure.

### Modified Capabilities

- `auth-token-lifecycle-provider`: AuthProvider refactored from linear chain to gateway + independent fan-out model. Service tokens refresh in parallel. Refresh logic delegated to the token refresh registry instead of hardcoded switch.

## Impact

- **package/app-shell**: AuthProvider rewritten to use gateway + fan-out model with registry lookup. `AuthProviderProps` extended to optionally accept a registry override. `refreshRetryPolicy` unchanged.
- **package/api**: New `tokenRefreshRegistry.ts` module exporting the default registry and a `registerTokenRefresh()` helper. Existing `jwt.ts` unchanged.
- **package/app**: `App.tsx` updated to register service token refresh entries before mounting AuthProvider.
- **package/admin**: `App.tsx` updated with appropriate token set and registry. Admin proxy `AuthProvider.tsx` already removed.
- **package/contract**: No changes. `NormalizedTokenName` and transport maps are sufficient.
- **Backward compatibility**: AuthProvider still accepts `tokens` prop as before. Existing `[AUTH_IDENTITY, REZICS_SESSION]` configurations continue to work. The registry provides defaults for known token types, so existing consumers don't break.

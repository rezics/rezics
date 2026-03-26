## 1. Server-Side Eligibility Check

- [ ] 1.1 Add `assertMainServerEligibility()` call to `POST /session/token` in `package/server/src/session/session.api.ts` — fetch auth session state via `getAuthSessionState()` and reject if `canAcquireMemberToken` is false (403) or session is missing (401). Handle auth service unavailability with 503.
- [ ] 1.2 Add tests for `POST /session/token` eligibility enforcement: verified user succeeds, unverified user gets 403, missing session gets 401.

## 2. AUTH_CONTEXT Ephemeralization

- [ ] 2.1 Remove AUTH_CONTEXT from `NormalizedTokenName` management in `package/api/src/react-query/jwt.ts` — remove its localStorage persistence (`setToken`/`getToken`/`removeToken` for AUTH_CONTEXT). Keep the `getContextToken()` function in `auth.api.ts` but have it return the token value directly without storing it.
- [ ] 2.2 Update `ensure()` in `package/api/src/user/user.api.ts` to accept AUTH_CONTEXT as a parameter rather than reading it from localStorage. Update `buildTokenHeaders()` to no longer include AUTH_CONTEXT by default.
- [ ] 2.3 Remove AUTH_CONTEXT from `clearAllTokens()` in `jwt.ts`. Verify no other code reads AUTH_CONTEXT from localStorage.

## 3. Eliminate authStore

- [ ] 3.1 Audit all imports of `authStore` / `useAuthStore` across the codebase (`package/app`, `package/app-shell`, `package/api`). Document each consumer and what it reads.
- [ ] 3.2 Update `authSessionStore` in `package/app-shell/src/state/authSessionStore.ts` to expose any fields previously only available on `authStore` (e.g., ensure `hasAuthSession` can serve as `isAuthenticated`).
- [ ] 3.3 Update `useAuth()` in `package/app/src/user/page/useAuth.ts` to derive all state from `authSessionStore` + `userProfileStore`. Remove `authStore` dependency. Ensure the public interface (`isAuthenticated`, `capabilityLevel`, `user`, etc.) remains compatible.
- [ ] 3.4 Migrate all direct `authStore` consumers to use `useAuth()` or `authSessionStore`. Remove `package/app-shell/src/state/authStore.ts` and re-export file `package/app/src/user/state/authStore.ts`.
- [ ] 3.5 Verify build succeeds across `package/app`, `package/app-shell`, `package/admin` after authStore removal.

## 4. Extract Shared Provisioning Utility

- [ ] 4.1 Extract `establishBusinessSession()` function in `package/app/src/user/model/handler.ts` (or a new dedicated module) that performs the one-shot sequence: `ensureAuthIdentityToken()` → `getContextToken()` (in memory) → `ensure(identity, context)` → `issueSessionToken()` → `hydrateAuthSessionState()`.
- [ ] 4.2 Refactor `handler.login()` and `handler.register()` to call `establishBusinessSession()` instead of inlining the token acquisition and provisioning steps.
- [ ] 4.3 Remove `acquireMemberAccessIfReady()` and `ensureMemberAccess()` — replaced by `establishBusinessSession()`.
- [ ] 4.4 Add tests for `establishBusinessSession()`: first-time user (ensure creates), returning user (ensure returns alreadyCreated), AUTH_CONTEXT not persisted after completion.

## 5. Rewrite AuthProvider

- [ ] 5.1 Rewrite `AuthProvider` in `package/app-shell/src/provider/AuthProvider.tsx` to accept a `tokens` prop (array of `NormalizedTokenName`). Remove all Zustand/store sync logic, all `ensure()` calls, all verification/onboarding checks.
- [ ] 5.2 Implement per-token state machine: `obtain → managing | dormant`. On success: schedule refresh. On retryable error: backoff retry. On non-retryable error (user not found): enter dormant.
- [ ] 5.3 Implement dormant-state reactivation: listen for `AUTH_TOKEN_STORAGE_EVENT` (same-tab) and `StorageEvent` (cross-tab) on the dormant token's localStorage key. On detection, exit dormant and begin managing.
- [ ] 5.4 Implement dependency chain: process tokens in array order. If an upstream token fails, do not attempt downstream tokens.
- [ ] 5.5 Implement visibility-change recovery: on `visibilitychange` to visible, check all managed tokens and refresh expired/missing ones.
- [ ] 5.6 Remove the AuthProvider re-export proxy in `package/app/src/app/provider/AuthProvider.tsx` — import directly from `@package/app-shell`.
- [ ] 5.7 Update AuthProvider usage in `package/app` to pass `tokens={[NormalizedTokenName.AUTH_IDENTITY, NormalizedTokenName.REZICS_SESSION]}`.
- [ ] 5.8 Add tests for AuthProvider: refresh scheduling, backoff on retryable error, dormant on non-retryable, reactivation on localStorage write, dependency chain ordering, visibility recovery.

## 6. Simplify Pages

- [ ] 6.1 Simplify `LoginPage` (`package/app/src/user/page/LoginPage.tsx`): remove direct calls to `hydrateAuthSessionState()`, `ensureAuthIdentityToken()`. Delegate to `handler.login()` and navigate via `resolvePostAuthDestination()`.
- [ ] 6.2 Simplify `OAuthOnboardingPage` (`package/app/src/user/page/OAuthOnboardingPage.tsx`): after onboarding submit, call `establishBusinessSession()` if auth registration is complete. Remove inline token acquisition and `acquireMemberAccessIfReady()` calls.
- [ ] 6.3 Simplify `VerifyEmailPage` (`package/app/src/user/page/VerifyEmailPage.tsx`): "refresh status" re-fetches session state only. If verified, call `establishBusinessSession()` and navigate. Remove `acquireMemberAccessIfReady()` call.
- [ ] 6.4 Update `resolvePostAuthDestination()` in `package/app/src/user/model/authRedirect.ts` to accept optional `redirectTo` parameter with readiness-based priority overrides (onboarding > verification > redirect target > `/`).

## 7. Cleanup and Validation

- [ ] 7.1 Remove unused imports and re-exports: `syncFromStorage()`, `init()` from authStore, AUTH_CONTEXT localStorage key, `authSessionStore` re-export in `package/app/src/user/state/`.
- [ ] 7.2 Grep for orphaned references to `acquireMemberAccessIfReady`, `ensureMemberAccess`, `authStore`, `useAuthStore` across the repo. Remove all.
- [ ] 7.3 Verify full build: `bun run build` in `package/app`, `package/app-shell`, `package/server`.
- [ ] 7.4 Run existing test suites: `bun test` in `package/app`, `package/api`, `package/server`. Fix any regressions.

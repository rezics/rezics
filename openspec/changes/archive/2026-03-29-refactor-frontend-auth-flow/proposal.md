## Why

Frontend authentication orchestration is fragmented across AuthProvider, handler.ts, and individual pages (LoginPage, OAuthOnboardingPage, VerifyEmailPage). Each independently calls `hydrateAuthSessionState()`, `ensureAuthIdentityToken()`, and `acquireMemberAccessIfReady()`, duplicating the same convergence sequence. `authStore` mirrors JWT claims into Zustand state that is redundant with `authSessionStore`. AuthProvider mixes pure token lifecycle management with business logic (user provisioning, verification checks). This coupling makes the auth flow brittle, hard to reason about, and difficult to extend to new frontends (e.g., `package/admin`) that have different login flows but share the same token pipeline.

## What Changes

- **AuthProvider becomes a pure, stateless token lifecycle manager.** It accepts a configurable array of token names (e.g., `[AUTH_IDENTITY, REZICS_SESSION]`), handles refresh scheduling, and reacts to failure type: retryable errors trigger backoff; "user not found" errors put that token into a dormant state that reactivates when the token appears in localStorage externally.
- **Eliminate `authStore`.** Token presence is no longer mirrored into Zustand. `authSessionStore` (hydrated from `get-session-state`) becomes the sole source of truth for UI auth state. `useAuth()` derives exclusively from `authSessionStore` + `userProfileStore`.
- **Login flow owns first-time session establishment.** The login/register handler performs the one-shot sequence: identity token → context token (ephemeral) → `ensure()` → `issueSessionToken()`. AUTH_CONTEXT is fetched on-demand during provisioning and discarded — not stored or managed.
- **Pages become thin.** Pages trigger Better Auth actions and read auth state for navigation. They no longer call `hydrateAuthSessionState()`, `ensureAuthIdentityToken()`, or `acquireMemberAccessIfReady()` directly.
- **Server enforces verification on `POST /session/token`.** Add `assertMainServerEligibility()` check so the business server rejects unverified users, allowing AuthProvider to be purely reactive to failures rather than encoding business rules.

## Capabilities

### New Capabilities

- `auth-token-lifecycle-provider`: Declarative, stateless AuthProvider that manages token refresh/recovery for a configurable set of tokens, with failure-type-aware retry (backoff vs dormant) and localStorage observation for reactivation.
- `auth-login-orchestration`: Centralized first-time session establishment flow (identity → context → ensure → session token) owned by the login handler, with AUTH_CONTEXT as an ephemeral provisioning artifact.

### Modified Capabilities

- `frontend-auth-state-separation`: `authStore` is eliminated. `authSessionStore` becomes the sole UI state source. `useAuth()` no longer reads from token-mirrored state.
- `server-permission-guards`: `POST /session/token` gains a server-side eligibility check via `assertMainServerEligibility()` to reject unverified users.

## Impact

- **package/app-shell**: AuthProvider rewritten; `authStore` removed; `authSessionStore` simplified.
- **package/app**: LoginPage, OAuthOnboardingPage, VerifyEmailPage simplified to thin pages; `handler.ts` becomes the sole orchestrator for first-time session establishment; `useAuth()` updated to derive from `authSessionStore` only.
- **package/api**: AUTH_CONTEXT token storage/management removed from jwt.ts; `buildTokenHeaders()` simplified.
- **package/server**: `session.api.ts` updated to call `assertMainServerEligibility()` before issuing session tokens.
- **package/admin**: Can adopt the same AuthProvider with a different token array (e.g., `[AUTH_IDENTITY]` only).
- **Backward compatibility**: No API contract changes. `get-session-state`, `context-token`, and `session/token` endpoints remain unchanged. The server-side eligibility check is additive (rejects requests that the frontend previously prevented — no valid existing flow is broken).

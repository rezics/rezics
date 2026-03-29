## Context

The frontend authentication pipeline involves four token stages: auth presence cookie → AUTH_IDENTITY → AUTH_CONTEXT → REZICS_SESSION. Currently, the convergence logic (hydrate session state → check readiness → acquire member token) is duplicated across AuthProvider, handler.ts, OAuthOnboardingPage, and VerifyEmailPage. `authStore` mirrors JWT claims into Zustand state that overlaps with `authSessionStore`. AuthProvider embeds business logic (user provisioning, verification checks) alongside token refresh scheduling.

The auth service (Better Auth) and the business server (Elysia) are two separate domains with different concerns:

- **Auth service**: handles sign-in, sign-up, OAuth, email verification, onboarding. Issues AUTH_IDENTITY. Pages interact with it directly via Better Auth's API.
- **Business server**: requires AUTH_IDENTITY + REZICS_SESSION for member-level access. First-time access requires user provisioning (`ensure()`) with an ephemeral AUTH_CONTEXT token.

Different frontends (app, admin) share the token pipeline but have different login flows. The current tight coupling prevents reuse.

## Goals / Non-Goals

**Goals:**

- AuthProvider becomes a pure, stateless, configurable token lifecycle manager — no business logic, no provisioning, no verification awareness
- Eliminate `authStore` — `authSessionStore` (from `get-session-state`) becomes the sole UI state source
- Login flow (handler.ts) owns first-time session establishment as a single orchestration point
- AUTH_CONTEXT is ephemeral — fetched during provisioning, never stored or managed
- Pages are thin — they trigger Better Auth actions and read auth state, never touch token internals
- Server enforces verification eligibility on `POST /session/token`

**Non-Goals:**

- Changing backend API contracts (`get-session-state`, `context-token`, `session/token` remain as-is)
- Introducing new backend endpoints
- Refactoring the auth service (Better Auth) itself
- Changing token transport headers or JWT structure
- Supporting multi-tenant or cross-origin token sharing

## Decisions

### Decision 1: AuthProvider accepts a token array and manages lifecycle per-token

AuthProvider receives a configuration like `[AUTH_IDENTITY, REZICS_SESSION]` and manages each token independently with failure-type-aware behavior:

- **Success**: store in localStorage, schedule refresh before expiry
- **Retryable error** (network, 5xx): retry with exponential backoff
- **Non-retryable error** ("user not found", 404/specific error codes): enter dormant state for that token; observe localStorage via `StorageEvent` / custom event; resume management when the token appears externally

Each token has a known refresh endpoint:
- AUTH_IDENTITY → `GET /api/auth/token` (cookie-authenticated)
- REZICS_SESSION → `POST /session/token` (requires AUTH_IDENTITY in header)

The ordering of the array defines the dependency chain — if AUTH_IDENTITY refresh fails, REZICS_SESSION is not attempted.

**Why not a generic refresh callback per token?** The refresh endpoints are stable and well-defined. Hardcoding the mapping in AuthProvider (or a small token-config registry) avoids unnecessary abstraction while keeping the provider free of business logic.

**Alternative considered**: Having the API client (`apiFetch`) lazily acquire REZICS_SESSION on first 401. Rejected because it introduces latency on the first real API call and requires complex mutex/dedup logic to prevent concurrent acquisition from parallel requests.

### Decision 2: Eliminate `authStore`, derive all UI state from `authSessionStore`

`authStore` currently exists to mirror JWT claims (isAuthenticated, id, slug, role) into reactive Zustand state. This is redundant — `authSessionStore` already holds session/user data from `get-session-state`, which is the authoritative source.

After this change:
- `useAuth()` reads from `authSessionStore` + `userProfileStore` only
- `isAuthenticated` is derived from `authSessionStore.hasAuthSession`
- Identity fields (id, slug) come from `authSessionStore.user`
- `capabilityLevel`, `needsVerification`, `needsOnboarding` remain on `authSessionStore`

Components that currently import from `authStore` will be migrated to use `useAuth()` or `authSessionStore` directly.

**Alternative considered**: Keeping `authStore` but making it derived from `authSessionStore`. Rejected because it adds an unnecessary indirection layer — consumers should read from the source of truth directly.

### Decision 3: Login flow owns the one-shot provisioning sequence

The login handler (handler.ts) performs the complete first-time sequence after successful Better Auth authentication:

1. `ensureAuthIdentityToken()` → AUTH_IDENTITY in localStorage
2. `getContextToken()` → AUTH_CONTEXT (held in memory, not stored)
3. `ensure(AUTH_IDENTITY, AUTH_CONTEXT)` → user provisioned on business server
4. `issueSessionToken(AUTH_IDENTITY)` → REZICS_SESSION in localStorage
5. `hydrateAuthSessionState()` → authSessionStore updated

After step 4, AuthProvider detects the tokens in localStorage and begins managing refresh. AUTH_CONTEXT is not passed to AuthProvider and is not stored.

For returning users where provisioning already happened, `ensure()` is idempotent (returns `alreadyCreated: true`).

This sequence is called from:
- `handler.login()` (email sign-in)
- `handler.register()` (email sign-up)
- Post-OAuth callback handler (after auth registration is complete)
- OAuthOnboardingPage (after onboarding submit, when auth registration completes)

**Why not factor this into a shared `establishBusinessSession()` utility?** It should be — the one-shot sequence is extracted as a single function in handler.ts (or a dedicated module) and called from the 2-3 entry points above. This is simpler than the current 4+ places that independently reconstruct the convergence.

### Decision 4: AUTH_CONTEXT is ephemeral

AUTH_CONTEXT carries user metadata (slug, name, avatar) needed only by `POST /users/ensure` for first-time provisioning. After provisioning, it serves no purpose.

Changes:
- Remove AUTH_CONTEXT from localStorage persistence in `jwt.ts`
- Remove AUTH_CONTEXT from `NormalizedTokenName` management in `buildTokenHeaders()` (it's passed explicitly by `ensure()` only)
- `getContextToken()` returns the token value directly, not stored
- AuthProvider does not manage AUTH_CONTEXT

### Decision 5: Server-side eligibility check on session token issuance

`POST /session/token` currently only requires `requireLogin` (valid AUTH_IDENTITY). It does not verify that the user's auth session is eligible for member access (e.g., email verified).

Add a call to `assertMainServerEligibility()` (already exists in `session-state.ts`) before signing the session token. This requires `POST /session/token` to call the auth service's `get-session-state` endpoint to check `canAcquireMemberToken`.

This is a one-time check per session token issuance (every 15 minutes at most), not per request. The performance impact is negligible.

**Why this matters**: With a pure AuthProvider that simply tries to obtain tokens and reacts to failures, the server must be the enforcement point. Without this, an unverified user's AuthProvider could successfully obtain a REZICS_SESSION.

### Decision 6: Page responsibility redefinition

Pages become thin consumers:

- **LoginPage**: form validation, trigger Better Auth sign-in, navigate based on `resolvePostAuthDestination()`
- **OAuthOnboardingPage**: submit onboarding data to Better Auth, then trigger the provisioning sequence if auth registration completes, navigate based on result
- **VerifyEmailPage**: resend verification email (Better Auth), refresh session state, navigate when verified
- **Header / useAuth()**: purely derived from store state, no side effects

`resolvePostAuthDestination()` is updated to support original redirect target with readiness-based priority overrides:
1. `needsOnboarding` → `/onboarding`
2. `needsVerification` → `/verify-email`
3. Otherwise → original target or `/`

## Risks / Trade-offs

**[AuthProvider dormant state may delay recovery]** → If AuthProvider enters dormant state for REZICS_SESSION (user not provisioned), it relies on localStorage observation to resume. If the login handler writes the token and the event is missed (e.g., same-tab synchronous write), AuthProvider may not resume promptly. Mitigation: ensure the custom `AUTH_TOKEN_STORAGE_EVENT` is dispatched reliably after any token write, and AuthProvider listens for both `StorageEvent` (cross-tab) and the custom event (same-tab).

**[Server-side eligibility check adds a network call]** → `POST /session/token` will call auth service `get-session-state` before issuing. This adds ~1 network hop per session token issuance (every 15 min). Mitigation: acceptable latency for a low-frequency operation; can be cached if needed later.

**[Removing authStore affects many consumers]** → 13+ files currently import from `useAuth()` or `authStore` directly. Mitigation: `useAuth()` interface remains largely the same — most consumers won't notice the internal change. The re-export files in `package/app/src/user/state/` that proxy `authStore` will be removed.

**[OAuth email change verification is pre-auth]** → When an OAuth user changes their email during onboarding, verification happens before the auth server considers registration complete. The user has no auth session yet. The frontend must handle this as a Better Auth concern, not a business server concern. This is already the case but must be preserved during the refactor.

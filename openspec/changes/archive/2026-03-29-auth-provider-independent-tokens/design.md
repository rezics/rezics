## Context

The previous `refactor-frontend-auth-flow` change introduced a rewritten AuthProvider that accepts a configurable `tokens` array and manages their lifecycle. However, it models tokens as a linear dependency chain — tokens are processed sequentially, and a failure in one blocks all downstream tokens. The refresh logic is hardcoded via a switch statement that knows about specific token types (`AUTH_IDENTITY`, `REZICS_SESSION`).

The platform is expanding to include additional services (notification, search, future domains). Each service issues its own session token. The current linear-chain model means:
- A failing `REZICS_SESSION` prevents `NOTIFICATION_SESSION` from refreshing
- Every new service token requires modifying the AuthProvider switch statement
- AuthProvider directly imports service-specific API modules (`userApi`)

The admin panel also needs multiple tokens since it manages both the auth server and the main server.

## Goals / Non-Goals

**Goals:**

- `AUTH_IDENTITY` is the sole gateway — all service tokens depend on it, nothing else
- Service tokens are independent peers — they refresh in parallel, fail in isolation
- Token refresh logic is configurable via a registry — no AuthProvider modifications for new services
- AuthProvider has zero direct imports of service-specific modules
- Admin and app each declare their token sets and registry entries

**Non-Goals:**

- Adding new service tokens (notification, search) — this change only builds the infrastructure
- Changing how `establishBusinessSession()` works — login flow provisioning is unaffected
- Modifying the server-side token issuance endpoints
- Changing the `@rezics/contract` token types or transport maps

## Decisions

### Decision 1: Gateway + fan-out model replaces linear chain

AuthProvider recognizes exactly one gateway token: `AUTH_IDENTITY`. All other tokens in the `tokens` array are service tokens that fan out independently from the gateway.

The refresh cycle becomes:
1. Ensure `AUTH_IDENTITY` is valid (refresh if needed)
2. If `AUTH_IDENTITY` fails non-retryably → clear everything, stop
3. For all service tokens that need refresh → `Promise.allSettled()` in parallel
4. Each service token handles its own result (success/retryable/dormant) independently

```
runRefreshCycle():
  ┌─────────────────────┐
  │ Refresh AUTH_IDENTITY│
  └──────────┬──────────┘
             │
      ┌──────┴──────┐
      │ success?    │
      └──┬──────┬───┘
     yes │      │ no (non-retryable)
         │      └──→ handleAuthSessionExpired()
         │
  ┌──────▼──────────────────────────┐
  │ Promise.allSettled([            │
  │   refreshIfNeeded(REZICS),     │
  │   refreshIfNeeded(NOTIF),      │
  │   refreshIfNeeded(SEARCH),     │
  │ ])                             │
  └─────────────────────────────────┘
         │
  Each settles independently:
    success  → state = 'managing', schedule next refresh
    retryable → schedule retry with backoff (that token only)
    non-retryable → state = 'dormant' (that token only)
```

**Why not keep the linear chain?** The linear model was correct for two tokens but breaks with three or more. `REZICS_SESSION` failure should not block `NOTIFICATION_SESSION`. They are separate services with no relationship.

**Alternative considered:** Per-token independent timers instead of a single refresh cycle. Rejected because it adds complexity (N timers instead of one) and makes the common case (all tokens healthy, schedule based on earliest expiry) harder to optimize.

### Decision 2: Token refresh registry in `@rezics/api`

A new module `package/api/src/react-query/tokenRefreshRegistry.ts` exports:

```typescript
type TokenRefreshFn = () => Promise<{token: string}>;

type TokenRefreshRegistry = Partial<
  Record<NormalizedTokenName, TokenRefreshFn>
>;

// Default registry with known service tokens
const defaultRegistry: TokenRefreshRegistry = {
  [NormalizedTokenName.REZICS_SESSION]: () => userApi.issueSessionToken(),
  // Future: NOTIFICATION_SESSION, SEARCH_SESSION, etc.
};

function createTokenRefreshRegistry(
  overrides?: TokenRefreshRegistry,
): TokenRefreshRegistry;
```

AuthProvider receives a `registry` prop (optional, defaults to `defaultRegistry`). When refreshing a service token, it calls `registry[tokenName]()`. If no entry exists for a token, it enters dormant immediately (unknown token type = non-retryable).

**Why in `@rezics/api`?** The refresh functions call API client methods that live in `@rezics/api`. Colocating the registry with the API layer keeps the dependency direction clean: `app-shell` (AuthProvider) → `api` (registry + API clients). The API package already exports token utilities from `jwt.ts`.

**Why not pass refresh functions as AuthProvider props?** The registry pattern keeps the component API clean. `tokens` declares *what* to manage, the registry declares *how*. Passing individual refresh functions per token would make the props unwieldy as tokens grow.

**Alternative considered:** Putting the registry in `@rezics/contract`. Rejected because the registry contains runtime functions (API calls), not type definitions.

### Decision 3: AUTH_IDENTITY refresh remains special-cased

`AUTH_IDENTITY` refresh uses `queryAccessToken()` which is cookie-based and fundamentally different from service token refresh (which uses Bearer-authenticated POST endpoints). Rather than forcing it into the registry, AuthProvider handles `AUTH_IDENTITY` as a known special case in the gateway phase.

This is acceptable because:
- There is exactly one gateway token, always `AUTH_IDENTITY`
- Its refresh mechanism (cookie → JWT) is unique and unlikely to change
- Keeping it explicit in the gateway phase makes the code clearer

### Decision 4: Per-service-token retry scheduling

In the linear model, a single `scheduleRefresh()` timer managed the whole chain. In the fan-out model, we need to handle the case where different service tokens have different retry schedules.

Approach: Keep a single timer for the next refresh cycle, but compute the delay as the minimum of:
- Earliest service token expiry (minus buffer)
- Earliest retry delay for any token in backoff

When the cycle runs, it only refreshes tokens that actually need it (expired or in retry). Tokens that are healthy or dormant are skipped.

This keeps the simplicity of one timer while correctly handling heterogeneous schedules.

### Decision 5: AuthProvider `tokens` prop defaults to `[AUTH_IDENTITY]`

When `tokens` is `undefined` or omitted, AuthProvider manages only `AUTH_IDENTITY`. This provides backward compatibility and a safe default for consumers that don't need service tokens (e.g., a future minimal frontend).

The admin `App.tsx` currently reverted to using the proxy `AuthProvider` without props. After this change, it will pass `tokens={[AUTH_IDENTITY, REZICS_SESSION]}` with the registry configured.

### Decision 6: `syncBusinessToken` side-effect stays in the registry callback

Currently, after refreshing `REZICS_SESSION`, AuthProvider calls `useAuthSessionStore.getState().syncBusinessToken(token)`. This store sync is a side effect specific to `REZICS_SESSION`.

Rather than having AuthProvider know about store syncing, the registry entry for `REZICS_SESSION` returns the token, and AuthProvider handles the generic part (write to localStorage, dispatch event). Any token-specific side effects (like store syncing) are performed inside the refresh function itself, before returning.

```typescript
// In the registry:
[NormalizedTokenName.REZICS_SESSION]: async () => {
  const response = await userApi.issueSessionToken();
  useAuthSessionStore.getState().syncBusinessToken(response.token);
  return {token: response.token};
},
```

This keeps AuthProvider generic — it only knows about tokens and localStorage.

## Risks / Trade-offs

**[Parallel refresh may cause brief inconsistency]** → If `REZICS_SESSION` refreshes slightly before `NOTIFICATION_SESSION`, there's a brief window where one is fresh and the other is stale. Mitigation: Both tokens are independently valid; there's no cross-token consistency requirement. Each API request includes only the tokens it needs.

**[Registry adds indirection]** → Debugging token refresh requires looking up the registry entry rather than reading a switch statement. Mitigation: The registry is a simple object literal in one file. The indirection is minimal and the extensibility benefit outweighs it.

**[Single timer for heterogeneous schedules is approximate]** → A token might wait slightly longer than optimal if another token's schedule is earlier. Mitigation: The maximum extra wait is bounded by the refresh buffer (60s). In practice, most service tokens will have similar expiry times.

**[Admin backward compatibility]** → The admin `App.tsx` was reverted to omit the `tokens` prop. This change must update it again. Mitigation: The default behavior (`tokens` undefined → `[AUTH_IDENTITY]` only) is safe; admin will explicitly pass its token set.

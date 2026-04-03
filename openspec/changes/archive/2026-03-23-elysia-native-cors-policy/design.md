## Context

CORS handling in `package/server` and `package/auth` currently uses three overlapping mechanisms:

1. **`@elysiajs/cors` plugin** — applied per-router via `withCredentialedCors` / `withPublicCors` wrappers. Works well for single-policy routers but cannot vary policy per-route.
2. **CorsResponder mini-instances** — full Elysia apps created at module scope solely to generate CORS headers via `.handle()`. Used by `withPolicyCorsResponse` to work around `@elysiajs/cors`'s lack of per-route granularity.
3. **Raw header manipulation** — `withCorsResponse` / `createCorsPreflightResponse` do direct `Headers` math. Used by preflight handlers.

Mixed-policy routers (session APIs) must split into two sub-routers, declare manual `.options()` preflight routes, and wire per-route `afterHandle` hooks — all boilerplate that the new plugin eliminates.

Both packages duplicate ~220 lines of structurally identical CORS code differing only in header lists and credentials configuration.

## Goals / Non-Goals

**Goals:**

- Single declarative API: `use(corsPolicy('credentialed'))` + route-level `{ corsPolicy: 'public' }` overrides
- Shared `@rezics/cors` package eliminating duplication between server and auth
- Drop `@elysiajs/cors` — own the header logic directly for full per-route control
- Eliminate manual `.options()` preflight declarations from API files
- Preserve all existing CORS header behavior exactly

**Non-Goals:**

- Changing any CORS policy definitions (allowed origins, methods, headers, credentials)
- Adding new policies beyond `credentialed`, `public`, `internal`
- Per-route preflight policy differentiation (default policy for all preflights is sufficient — see Decision 3)
- Modifying `package/auth/src/auth/trusted-origins.ts` (orthogonal concern)

## Decisions

### Decision 1: Macro `resolve` for policy propagation (Option C)

**Choice:** Use Elysia `macro` with `resolve` return to set effective policy, plus a scoped `resolve` for the default.

**Mechanism:**
```
scoped resolve → sets __corsPolicy = defaultPolicy (runs first)
macro resolve  → sets __corsPolicy = routePolicy  (runs second, overwrites)
single onAfterHandle → reads __corsPolicy, applies headers
```

**Verified:** Spike test at `package/server/src/cors/macro-resolve-order.test.ts` confirms macro resolve runs after scoped resolve and correctly overwrites the default.

**Alternatives considered:**
- *Macro + WeakSet guard* — works but uses a side-channel; not idiomatic Elysia
- *Macro-only (no default)* — every route must declare `{ corsPolicy: '...' }` explicitly; worse than current wrappers
- *`@elysiajs/cors` under the hood* — the plugin's scope model fights per-route selection; the CorsResponder hack exists precisely because of this mismatch

### Decision 2: Drop `@elysiajs/cors`, own header logic

**Choice:** Implement CORS headers directly in ~40 lines of header math.

**Rationale:** The existing `withCorsResponse` already does this correctly. `@elysiajs/cors` adds complexity (its own lifecycle hooks, its own preflight handling) that conflicts with per-route policy selection. The CorsResponder pattern — creating throwaway Elysia instances to extract headers — exists solely to work around this conflict.

**Header logic (complete):**
```
1. Check Origin against allowedOrigins → set Access-Control-Allow-Origin + Vary: Origin
2. Set Access-Control-Allow-Methods from policy config
3. Set Access-Control-Allow-Headers from policy config
4. Set Access-Control-Expose-Headers from policy config (if non-empty)
5. Set/delete Access-Control-Allow-Credentials based on policy
6. For preflight: add Access-Control-Max-Age
```

### Decision 3: `onRequest` for preflight interception

**Choice:** Use a scoped `onRequest` hook to intercept OPTIONS requests and respond with the default policy headers.

**Rationale:** Spike test confirmed that:
- `onRequest` successfully intercepts OPTIONS before routing (returns 204)
- A catch-all `.options('/*')` route cannot see macro overrides from other HTTP methods (GET, POST, etc.) because macros are bound to the route they're declared on

Per-route preflight policy differentiation would require registering parallel OPTIONS routes for every route with a macro override — significant complexity for negligible benefit. Browsers cache preflight responses by path+method, and the default policy's header superset is always valid.

**Trade-off:** A `corsPolicy: 'public'` route's preflight will carry the `credentialed` default's headers (wider `Allow-Methods`, extra `Allow-Headers`). This is safe — CORS headers are permissive, not restrictive. The actual response enforces the correct narrow policy.

### Decision 4: Shared `@rezics/cors` with per-service config injection

**Choice:** The plugin factory accepts a policy config map. Each service provides its own configs.

```ts
// @rezics/cors — shared plugin
export function corsPolicy(
  defaultPolicy: CorsPolicyName,
  configs: Record<CorsPolicyName, CorsPolicyConfig>,
): Elysia

// package/server/src/cors/index.ts — thin wrapper
export const serverCorsPolicy = (defaultPolicy: CorsPolicyName) =>
  corsPolicy(defaultPolicy, {
    credentialed: serverCredentialedConfig,
    public: serverPublicConfig,
    internal: serverInternalConfig,
  })
```

**Rationale:** The plugin mechanics are identical between server and auth. Only the concrete header lists differ (`x-rezics_session_token` vs `x-internal-auth-token`, different `exposeHeaders`). Injecting configs keeps the shared package free of service-specific knowledge.

### Decision 5: Plugin scoping — `local` (default)

**Choice:** The plugin's resolve and lifecycle hooks use Elysia's default `local` scope.

**Rationale:** Local scope means the plugin only affects routes registered on the same instance or its descendants. This matches the desired behavior: `use(corsPolicy('credentialed'))` affects that router's routes, not sibling routers mounted elsewhere. Using `scoped` or `global` would leak CORS config across unrelated routers.

## Risks / Trade-offs

**[Risk] Resolve key collision** — The plugin uses `__corsPolicy` as the resolve key. If another plugin or route uses the same key, it will conflict.
→ *Mitigation:* Use a sufficiently unique key name. If this becomes a problem in practice, switch to a Symbol-based store key.

**[Risk] Preflight uses default policy, not route-specific policy** — As noted in Decision 3, OPTIONS responses carry the default policy headers.
→ *Mitigation:* This is intentionally accepted. The actual response enforces the correct policy. Preflight headers are a superset and remain valid.

**[Risk] All-or-nothing migration per package** — The old wrappers (`withCredentialedCors`) and the new plugin (`corsPolicy`) both register lifecycle hooks. Using both on the same router would double-apply CORS headers.
→ *Mitigation:* Migrate one API file at a time, but ensure each file fully switches. The old CORS module is deleted only after all files are migrated.

**[Risk] Elysia version sensitivity** — The macro resolve ordering behavior was verified on Elysia 1.4.x. A future Elysia update could change resolve execution order.
→ *Mitigation:* The spike test (`macro-resolve-order.test.ts`) serves as a canary. It will fail immediately if ordering changes.

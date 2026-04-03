## Context

Both `package/server` and `package/auth` currently use a custom `@rezics/cors` package that implements CORS via Elysia lifecycle hooks (`onRequest`, `onAfterHandle`, `onError`) and a `corsPolicy` macro for per-route policy overrides. This package defines three policies (`credentialed`, `public`, `internal`) but in practice only `credentialed` is meaningfully used — `internal` is never referenced, and `public` is used on 2 JWKS endpoints (server-to-server, CORS irrelevant) and 1 token sub-router (external API, doesn't need browser CORS).

The header-setting logic is duplicated across three functions (`applyHeaders`, `applyCorsToSet`, inline in `onError`), and each service's root `onError` handler has a manual fallback to ensure error responses get CORS headers.

## Goals / Non-Goals

**Goals:**
- Replace `@rezics/cors` with `@elysiajs/cors` — one `cors()` call per service
- Eliminate all custom CORS code: plugin, macro, header utilities, config wrappers
- Maintain identical browser-facing CORS behavior for SPA routes
- Remove the `applyCorsToSet` fallback from root `onError` handlers

**Non-Goals:**
- Per-route CORS policy overrides (no longer needed)
- CORS configuration for server-to-server routes (JWKS, token API)
- Changes to authentication, token transport, or any non-CORS middleware

## Decisions

### 1. Single `cors()` instance per service, applied at the app level

Each service gets one `cors()` call with the credentialed config. No per-route overrides.

**Rationale:** The multi-policy system existed for edge cases that don't need CORS at all. The official plugin handles preflight, error responses, and all lifecycle hooks internally — no custom code needed.

**Alternative considered:** Scoped `cors()` instances on sub-routers (e.g., one for browser routes, one for token routes). Rejected because the token routes are external API — CORS headers are harmless there and not worth the added wiring.

### 2. Remove `@rezics/cors` package entirely

Delete `package/cors/` and all references. Don't keep it as a wrapper around the official plugin.

**Rationale:** The official plugin's config API directly accepts `origin`, `credentials`, `methods`, `allowedHeaders`, `exposeHeaders`, `maxAge` — all fields the custom package defined. No abstraction layer needed.

### 3. Origin config stays per-service

Each service defines its own allowed origins (dev vs prod) inline where `cors()` is called, same as today's `middleware/cors.ts` / `cors/index.ts`.

**Rationale:** Server and auth have slightly different `allowedHeaders` (auth needs `x-internal-auth-token`). Keeping config inline in each service is simpler than a shared config package.

### 4. Drop `corsPolicy: 'public'` from JWKS and token routes

JWKS endpoints are fetched server-to-server by JWT verifiers. Token API routes use `Authorization` header with API tokens, called by external servers/CLI. Neither needs browser CORS.

**Rationale:** These routes get the default credentialed CORS from the app-level `cors()` — harmless and correct. No override needed.

### 5. Remove `applyCorsToSet` from root `onError`

The official `@elysiajs/cors` plugin handles error responses internally via its own lifecycle hooks.

**Rationale:** The manual fallback existed because the custom plugin's scoped hooks didn't always fire for app-level errors. The official plugin registers globally and covers this case.

## Risks / Trade-offs

- **[Risk] Official plugin may not cover all error paths** → Verify with a test that error responses from both services include CORS headers. If the plugin misses app-level errors, add a minimal `onError` hook (but this is unlikely given the plugin registers globally).
- **[Risk] Token routes get credentialed CORS instead of none** → This is strictly more permissive and harmless. External API consumers don't send `Origin` headers, so CORS headers go unused.
- **[Trade-off] Lose per-route policy granularity** → Acceptable because it was barely used and added significant complexity.

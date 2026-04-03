## Why

CORS handling across `package/server` and `package/auth` is scattered across three abstraction layers: `@elysiajs/cors` plugin wrappers, "CorsResponder" mini-Elysia instances that spin up full request pipelines just to extract headers, and raw `withCorsResponse` header manipulation. Mixed-policy routers (e.g. session APIs serving both credentialed `/token` and public `/jwks`) require manual `.options()` preflight declarations, route-level `afterHandle` hooks, and split sub-routers — all to work around the fact that `@elysiajs/cors` applies at plugin scope, not per-route. The two packages duplicate ~220 lines of near-identical CORS code with 14+ exports each.

## What Changes

- **New shared `@rezics/cors` package** containing a single `corsPolicy` Elysia plugin factory that replaces all existing CORS wrappers, responders, and manual header utilities.
- **Drop `@elysiajs/cors` dependency** from both `package/server` and `package/auth`. The plugin owns CORS header logic directly (~80 lines of straightforward header math).
- **Elysia `macro` for route-level policy override**: routes declare `{ corsPolicy: 'public' }` in route options to override the inherited default. The macro uses `resolve` to set the effective policy per-request, which a single scoped `onAfterHandle` reads.
- **Scoped `resolve` for inherited default**: the plugin sets a default policy via scoped `resolve`; routes without a macro override inherit it automatically.
- **Centralized preflight handling**: the plugin registers an `onRequest` hook that intercepts `OPTIONS` requests and responds with the default policy headers, eliminating manual `.options()` declarations in API files.
- **Refactor all existing CORS usages** (~20 simple APIs, 2 mixed-policy session APIs) to the new plugin API.
- **Remove old CORS modules** (`package/server/src/cors/index.ts`, `package/auth/src/cors/index.ts`) and their 14+ exports once migration is complete.

## Capabilities

### New Capabilities

- `cors-policy-plugin`: The shared Elysia-native CORS policy plugin — macro contract, resolve-based policy propagation, preflight interception, and header application.

### Modified Capabilities

_(none — no existing spec-level requirements change; this is an internal refactoring of how CORS headers are applied)_

## Impact

- **Affected packages**: `package/server`, `package/auth`, new `@rezics/cors`
- **Dependencies**: `@elysiajs/cors` removed from `package/server` and `package/auth`
- **APIs**: No external API changes. All existing CORS header behavior is preserved exactly.
- **Backward compatibility**: The old wrapper functions (`withCredentialedCors`, `withPublicCors`, etc.) are removed. All call sites must migrate to `corsPolicy(...)`. No incremental rollout — the migration is all-or-nothing within each package since the old and new approaches cannot coexist on the same router.
- **Testing**: Existing CORS tests in `echokv.api.test.ts` and `auth-openapi.test.ts` must continue passing with identical header assertions. New unit tests for the shared plugin cover resolve ordering, policy override, and preflight behavior.

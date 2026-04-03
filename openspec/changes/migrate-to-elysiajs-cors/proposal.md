## Why

The custom `@rezics/cors` package duplicates what `@elysiajs/cors` already provides, with added complexity: three near-identical policy configs, dual header-setting functions (`Headers` vs `set.headers`), manual `Response` wrapping in `onAfterHandle`, and a fallback `applyCorsToSet` in each service's root `onError`. The per-route macro system exists to serve only 2 JWKS endpoints and 1 token sub-router — not enough to justify a bespoke CORS implementation.

## What Changes

- **BREAKING**: Remove `@rezics/cors` package entirely (custom plugin, types, headers, tests)
- Replace with `@elysiajs/cors` in both `package/server` and `package/auth`
- Remove `serverCorsPolicy` / `authCorsPolicy` wrappers and the `corsPolicy` macro usage from route files
- Remove `applyCorsToSet` fallback calls from each service's root `onError` handler
- Remove the `internal` policy (never used) and `public` policy override on JWKS routes (server-to-server, CORS irrelevant)
- Remove `corsPolicy: 'public'` from `tokenExternalRoutes` in `package/server` — external API token routes don't need credentialed CORS; either open CORS or none
- Configure `@elysiajs/cors` once per service with the credentialed config as the single policy

## Capabilities

### New Capabilities

- `elysiajs-cors-integration`: Configuration and usage of the official `@elysiajs/cors` plugin across both services

### Modified Capabilities

- `cors-policy-plugin`: Requirements change fundamentally — moving from custom multi-policy plugin to single-config official plugin. The per-route policy override, custom header functions, and shared package are all removed.

## Impact

- **Affected packages**: `package/cors` (deleted), `package/server`, `package/auth`
- **Dependencies**: Add `@elysiajs/cors` to `package/server` and `package/auth`; remove `@rezics/cors` peer dependency
- **APIs**: No external API changes — CORS headers are transparent to consumers
- **Backward compatibility**: No breaking changes for API consumers. The only behavioral change is that JWKS and token routes may get credentialed CORS headers instead of public ones, which is strictly more permissive and harmless
- **Migration**: Delete `package/cors/`, update imports in both services, replace plugin usage with `cors()` calls

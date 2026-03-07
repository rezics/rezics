## Why

The auth service uses a single catch-all route (`.all('/api/auth/*', ...)`) that forwards every request to `auth.handler(request)`. Because no explicit Elysia routes define `schema` or `detail`, the `@elysiajs/openapi` plugin has nothing to document — the OpenAPI spec is empty for all auth endpoints. Developers and API consumers have no auto-generated reference for authentication, session, admin, organization, or OAuth endpoints.

## What Changes

- **Add explicit Elysia route definitions** for every better-auth endpoint the app uses, each declaring `body`/`query`/`response` schemas and `detail` (summary, description, tags) for OpenAPI generation. Handlers delegate to `auth.handler(request)` so behavior is unchanged.
- **Create shared auth contract schemas** in `package/contract/src/auth/` using Elysia `t.*` types, split by domain (sign-in, session, admin, organization, OAuth).
- **Create a multi-file Elysia auth router** under `package/auth/src/openapi/`, split by domain (sign-in, session, admin, organization, OAuth), with an `index.ts` that composes all sub-routers and adds the catch-all fallback.
- **Integrate the router** into `package/auth/src/index.ts` so the OpenAPI plugin generates the complete auth API spec.

## Capabilities

### New Capabilities
- `auth-openapi-routes`: Multi-file Elysia router under `src/openapi/` with domain-specific route files (sign-in, session, admin, organization, OAuth), each defining schema + detail for OpenAPI, plus catch-all fallback.
- `auth-openapi-contracts`: Shared Elysia `t.*` request/response schemas in `package/contract/src/auth/` for all documented auth operations.

### Modified Capabilities

_(none — no existing spec-level requirements are changing)_

## Impact

- **`package/auth`**: New router file; `index.ts` updated to mount the documented router instead of the bare catch-all.
- **`package/contract`**: New/expanded schema files under `src/auth/` (currently empty `index.ts`).
- **Dependencies**: No new runtime dependencies — uses existing `elysia`, `@elysiajs/openapi`, and `better-auth`.
- **Backward compatibility**: Fully backward-compatible. All requests still reach `auth.handler(request)`. The catch-all fallback ensures undocumented or future better-auth endpoints continue to work. No API behavior changes.
- **Affected packages**: `package/auth`, `package/contract`.

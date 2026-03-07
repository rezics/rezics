## Context

The auth service (`package/auth`) uses better-auth with Elysia. All auth traffic is handled by a single catch-all route `.all('/api/auth/*', ({request}) => handleAuthRequest(request))` in `index.ts`. The `@elysiajs/openapi` plugin is already installed and mounted in dev mode, but produces an empty spec because no routes declare `schema` or `detail`.

The `package/contract/src/auth/index.ts` file exists but is empty — no shared auth schemas are defined yet.

Better-auth is configured with: email/password, social providers (Google, Microsoft, GitHub, Twitter), JWT (ES256/JWKS), OAuth provider, admin plugin, and organization plugin.

## Goals / Non-Goals

**Goals:**
- Generate complete OpenAPI documentation for all better-auth endpoints by adding explicit Elysia route definitions with schemas and detail metadata.
- Centralize auth request/response schemas in `package/contract/src/auth/` so they can be reused across packages.
- Maintain full backward compatibility — all requests still reach `auth.handler(request)` via the same code path.

**Non-Goals:**
- Changing any better-auth behavior or configuration.
- Adding request validation or enforcement via Elysia schemas (schemas are documentation-only; better-auth handles its own validation).
- Documenting internal/private better-auth endpoints that are not part of the public API surface.
- Generating client SDKs from the OpenAPI spec (future work).

## Decisions

### 1. Multi-file router structure in `package/auth/src/openapi/`

**Decision**: Create a `package/auth/src/openapi/` directory with domain-specific router files:
- `index.ts` — composes all sub-routers into a single Elysia instance with prefix `/api/auth`, adds the catch-all fallback, and re-exports.
- `sign-in.ts` — sign-in, sign-up, sign-out routes
- `session.ts` — get-session, list-sessions, revoke-session routes
- `admin.ts` — admin plugin routes
- `organization.ts` — organization plugin routes
- `oauth.ts` — OAuth provider routes (authorize, token, userinfo, revoke, jwks, register, callback)

**Rationale**: Splitting by domain mirrors the contract schema layout in `package/contract/src/auth/` and keeps each file focused. Adding or updating routes for a single domain only touches one file. The `index.ts` barrel composes everything so `index.ts` (app entry) still has a single `.use()` import.

**Alternative considered**: Single `auth-openapi-router.ts` file. Rejected because a single file would grow large and mix unrelated endpoint domains, making maintenance harder.

### 2. Schemas in `package/contract/src/auth/` split by domain

**Decision**: Create multiple schema files split by domain:
- `sign-in.ts` — email/password sign-in, sign-up, sign-out
- `session.ts` — session get/list/revoke
- `admin.ts` — admin plugin endpoints (user management)
- `organization.ts` — organization plugin endpoints (create, invite, members)
- `oauth.ts` — OAuth provider endpoints (authorize, token, userinfo, etc.)
- `index.ts` — re-exports all schemas

**Rationale**: Domain-based splitting keeps each file focused and mirrors the plugin structure of better-auth. Re-exporting from `index.ts` gives consumers a single import point.

**Alternative considered**: Single large schema file. Rejected — would grow unwieldy as endpoints are added and makes code review harder.

### 3. Documentation-only schemas (no validation enforcement)

**Decision**: Elysia route schemas describe the shape for OpenAPI generation, but better-auth continues to handle its own request validation internally. The Elysia schemas do not enforce stricter validation than better-auth expects.

**Rationale**: Enforcing schema validation at the Elysia layer could reject valid better-auth requests or break when better-auth changes its internal API. The schemas exist solely for documentation.

### 4. Mount order: documented routes first, then catch-all

**Decision**: The auth router defines explicit documented routes first, followed by a single `.all('/*', ({request}) => handleAuthRequest(request))` catch-all as the last route.

**Rationale**: Elysia matches routes in definition order. Documented routes take precedence for OpenAPI generation, and the catch-all ensures any undocumented or future better-auth endpoints continue to work without code changes.

### 5. Integration via `.use()` in `index.ts`

**Decision**: Replace the existing `.all('/api/auth/*', ...)` in `index.ts` with `.use(authOpenApiRouter)` where the router is imported from `./openapi`.

**Rationale**: Elysia's `.use()` composes the sub-router's routes, schemas, and metadata into the main app, so the OpenAPI plugin sees all route definitions. The change is minimal — one import and one `.use()` call replaces one `.all()` call.

## Risks / Trade-offs

- **Schema drift** → Better-auth may change request/response shapes across versions. Mitigation: schemas are best-effort documentation; the catch-all ensures nothing breaks even if schemas are outdated. Schemas can be updated incrementally.
- **Incomplete coverage** → Some better-auth internal endpoints may not be documented. Mitigation: the catch-all handles undocumented routes; coverage can be expanded over time.
- **Maintenance overhead** → Adding documented routes for every endpoint requires manual effort. Mitigation: schemas are split by domain so updates are localized; this is a one-time effort with incremental maintenance.

## Why

Rezics needs a production-grade identity foundation before services go live: the current `package/server` auth flow is service-local, uses symmetric JWT signing, and cannot provide centralized OAuth/OIDC or cross-service offline verification. We need a dedicated auth server now to standardize identity, reduce coupling, and unlock stateless microservice authentication across the monorepo.

### Problem
- Auth logic is currently embedded in `package/server`, creating tight coupling between business APIs and authentication concerns.
- Existing JWT model uses shared symmetric secrets, which is not aligned with asymmetric key distribution for microservices.
- No centralized OAuth 2.1 / OIDC provider exists for Rezics as an external platform capability.
- No standardized JWKS-based verification path exists for downstream services.

### Goals
- Build an independent auth service in `package/auth` using Elysia + Better Auth + Prisma.
- Use a single `User.id` field (UUIDv7, DB-generated) as the canonical user identifier in auth DB.
- Standardize same-origin JWT issuance and offline verification via JWKS with ES256 asymmetric signatures.
- Expose Rezics as an OAuth 2.1/OIDC authorization server with required discovery endpoints.
- Migrate `package/server` to stateless JWT verification against auth-issued tokens (no compatibility window required).

### Non-goals
- No phased backward compatibility layer for legacy server-local auth.
- No rollout of additional OAuth providers beyond required minimum (Google, Microsoft, GitHub, Twitter) in this change.
- No frontend UX redesign for login beyond integration requirements.

## What Changes

- Introduce a dedicated auth backend in `package/auth` with Better Auth, Prisma, t3-env, and DB `rezics_auth`.
- Define auth Prisma schema using a single primary key field `id String @id @default(dbgenerated("uuidv7()")) @db.Uuid` and unique `slug String @unique`.
- Whenever better-auth supports it, any UUID primary key should use UUID-v7.
- Configure Better Auth explicitly with `baseURL`, `basePath` (`/api/auth`), `BETTER_AUTH_SECRET`, and secret rotation readiness.
- Enable Better Auth JWT plugin endpoints (`/api/auth/token`, `/api/auth/jwks`) and Bearer token access for service use.
- Enable `@better-auth/oauth-provider` for Rezics OAuth 2.1/OIDC provider capabilities.
- Add required well-known endpoints:
  - `/.well-known/openid-configuration`
  - `/.well-known/oauth-authorization-server` (when supported)
  - `/.well-known/jwks.json` (equivalent to `/api/auth/jwks`)
- Enforce ES256 signing with key IDs and JWKS multi-key publication for rotation.
- Define and implement a shared JWT verification utility and Elysia hook for resource services (if Better Auth built-ins are insufficient), validating `alg`, `kid`, `iss`, `aud`, `exp`, and `nbf`.
- Migrate `package/server` to trust same-origin JWTs from auth server and remove service-local token issuance paths.
- Apply strict internal/external boundary on `/api/auth/token`: retained for same-origin/internal service workflows, isolated from public OAuth attack surface with explicit security controls.
- Set canonical audience strategy to `{"aud":"rezics-api","scope":"user"}` and apply best-practice claim validation.
- Configure external social login providers with account linking by email merge.

## Capabilities

### New Capabilities
- `independent-auth-server`: Dedicated Elysia + Better Auth + Prisma auth service with explicit env and schema contracts.
- `rezics-oauth-oidc-provider`: Rezics OAuth 2.1/OIDC authorization server behavior, discovery, provider integrations, and endpoint isolation.
- `es256-jwks-jwt-verification`: Asymmetric ES256 token issuance, JWKS publication/rotation, and reusable offline verification contracts for backend services.

### Modified Capabilities
- (none)

## Impact

### Scope
- Affected packages:
  - `package/auth` (new independent auth implementation)
  - `package/server` (JWT trust/verification migration, removal of local issuance usage)
  - potentially `package/app` and `package/admin` (auth client integration and token acquisition behavior)

### API and behavior impact
- **BREAKING**: `package/server` authentication model changes from service-local token issuance to externally issued same-origin JWT verification.
- New auth endpoints and well-known metadata/jwks surfaces are introduced.
- Public OAuth/OIDC flows and internal token surfaces are explicitly separated.

### Dependencies and infra
- New Better Auth plugins and OAuth providers.
- ES256 key material management, JWKS caching, and rotation lifecycle procedures.
- Prisma schema/migration setup for `rezics_auth`.

### Backward compatibility and migration
- No compatibility window is planned; services migrate directly before launch.
- Resource services must switch to JWKS-based verification and audience/issuer enforcement in the same rollout.

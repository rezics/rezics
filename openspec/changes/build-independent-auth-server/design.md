## Context

Current state:
- `package/server` currently owns authentication routes and signs JWTs locally with symmetric secrets.
- `package/auth` exists as a workspace package but has no production auth implementation yet.
- Resource APIs validate JWTs with local secret verification (`verifyAuth`) rather than JWKS-based asymmetric validation.

Constraints and requirements:
- Build a dedicated auth server at `package/auth` with Elysia + Better Auth + Prisma.
- Use `rezics_auth` PostgreSQL database.
- Use a single user primary key field `id` (`uuidv7`, db-generated) and unique `slug`.
- Enable OAuth 2.1/OIDC provider capabilities via `@better-auth/oauth-provider`.
- Keep `/api/auth/token` for same-origin/internal stateless service workflows, but isolate from external/public OAuth attack surface.
- Use ES256 asymmetric signing and JWKS publication, including `/.well-known/jwks.json` compatibility endpoint.
- Migrate `package/server` directly to auth-issued JWT verification (no compatibility window).
- Audience strategy is fixed to `{"aud":"rezics-api","scope":"user"}`.

Stakeholders:
- Backend services (`package/server` now; future microservices later).
- Frontend clients (`package/app`, `package/admin`) consuming auth flows.
- External OAuth/OIDC clients integrating with Rezics as Authorization Server.

## Goals / Non-Goals

**Goals:**
- Separate identity responsibilities into `package/auth` and remove service-local auth coupling.
- Establish consistent, verifiable JWT contracts for all backend services using JWKS offline verification.
- Deliver minimum OAuth/OIDC external capability with required discovery and provider integrations (Google, Microsoft, GitHub, Twitter).
- Enforce explicit secure configuration (`baseURL`, `basePath`, `BETTER_AUTH_SECRET`, key rotation readiness).

**Non-Goals:**
- Backward compatibility bridge for old server-local JWT issuance.
- Implementing unrelated identity features (RBAC redesign, org-level SSO policy engine, custom consent UI framework).
- Supporting providers beyond required set in this change.

## Decisions

### 1) Dedicated auth service boundary in `package/auth`
Decision:
- Auth concerns move to `package/auth` and are organized by feature modules under `/src` (flat-by-name style, matching `package/server` conventions; no `feature/` umbrella folder).
- `package/server` becomes a pure resource service that verifies incoming JWTs and does not issue auth JWTs.

Rationale:
- Reduces coupling and clarifies trust boundaries for microservice-ready stateless architecture.

Alternatives considered:
- Keep auth in `package/server`: rejected due to boundary mixing and scale/security constraints.
- Build auth as an external repository: rejected for now to preserve monorepo velocity and shared contracts.

### 2) Prisma data model contract for auth DB
Decision:
- Auth DB (`rezics_auth`) uses Prisma with a dedicated schema for `package/auth`.
- User identity key is a single `id` field with DB-generated UUIDv7 (`id String @id @default(dbgenerated("uuidv7()")) @db.Uuid`) and `slug String @unique`.
- Account linking for social providers uses email-merge strategy.

Rationale:
- Keeps compatibility with existing unit-like identity semantics while minimizing mapping complexity (single canonical id field).

Alternatives considered:
- Dual identifiers (`id` + `unitId`): rejected due to avoidable complexity and mismatch risk.
- Application-side UUID generation only: rejected; DB generation provides canonical consistency.

### 3) Better Auth core configuration must be explicit
Decision:
- Explicitly set `baseURL` (or `BETTER_AUTH_URL`) and `basePath` (`/api/auth`).
- Explicitly set `BETTER_AUTH_SECRET` (high entropy, >=32 chars) and reserve secret rotation window.
- Use t3-env schema validation for all auth env contracts.

Rationale:
- Prevents host/header inference ambiguity and enforces reproducible deployment behavior.

Alternatives considered:
- Dynamic base URL inference: rejected by requirement and considered operationally fragile.

### 4) JWT issuance and verification model: ES256 + JWKS
Decision:
- Auth server signs with a single active ES256 private key and includes `kid` in JWT headers.
- Publish JWKS via `/api/auth/jwks` and compatibility `/.well-known/jwks.json` (equivalent content).
- Resource services verify offline via JWKS cache and re-fetch on unknown `kid`.
- Verification contract enforces `alg===ES256`, `kid`, `iss`, `aud`, `exp`, `nbf`, configurable clock tolerance.

Rationale:
- Asymmetric signing enables secure decentralized verification across services.

Alternatives considered:
- Symmetric HS256 shared secret: rejected for cross-service key exposure risk.
- EdDSA default path: rejected because requirement explicitly mandates ES256.

### 5) `/api/auth/token` internal retention with external isolation
Decision:
- Keep `/api/auth/token` enabled for same-origin/internal flows and machine-to-machine style stateless resource access.
- Treat `/api/auth/token` as internal surface with strict controls (network boundary, origin policy, auth requirements, and auditability).
- Public OAuth/OIDC entry remains provider endpoints/discovery metadata, not general external token minting.

Rationale:
- Satisfies platform need for JWT retrieval while addressing OAuth-provider-mode safety concerns through boundary control.

Alternatives considered:
- Disable `/token` entirely in OAuth mode: rejected because internal architecture requires it.
- Expose `/token` broadly to public clients: rejected as unnecessary and higher-risk.

### 6) OAuth/OIDC provider capability scope
Decision:
- Enable `@better-auth/oauth-provider` and satisfy minimum required capabilities:
  - OIDC: `openid` scope, `userinfo`, `id_token`
  - Issuer validation in auth response (`iss`)
  - Discovery endpoints (`/.well-known/openid-configuration`, `/.well-known/oauth-authorization-server` when available)
  - RP-initiated logout compatibility
  - DCR policy separation if dynamic registration is enabled (public/confidential/trusted, trusted can skip consent)
- Enable external social login providers: Google, Microsoft, GitHub, Twitter.

Rationale:
- Meets external platform needs with standards-compatible surface.

Alternatives considered:
- OAuth-only without OIDC compatibility: rejected due to interoperability requirements.

## Risks / Trade-offs

- [Risk] Misconfigured token surface isolation could expose internal `/api/auth/token` behavior.
  → Mitigation: enforce strict routing/policy boundaries, explicit auth requirements, and environment-gated exposure policy.

- [Risk] Key rotation can invalidate active tokens if old keys are removed too early.
  → Mitigation: publish multiple JWKS keys; retain old keys for at least max token TTL + buffer.

- [Risk] Direct migration (no compatibility window) can break local dev/clients if rollout sequence is wrong.
  → Mitigation: sequence rollout: auth server first, then resource verifier switch, then remove legacy issuance.

- [Risk] Email-merge account linking can accidentally unify identities with compromised email ecosystems.
  → Mitigation: enforce verified-email checks and maintain account-link audit logs.

- [Trade-off] Centralized auth increases dependency on auth service availability.
  → Mitigation: stateless resource verification via JWKS minimizes runtime coupling for token verification path.

## Migration Plan

1. Establish `package/auth` baseline (Elysia app skeleton, env contracts, Prisma schema/migrations for `rezics_auth`).
2. Integrate Better Auth core + Prisma adapter + required plugins (JWT, Bearer, OAuth provider).
3. Add ES256 signing key configuration, JWKS publication, and well-known metadata endpoints including `/.well-known/jwks.json` compatibility behavior.
4. Implement shared verification utility and Elysia auth hook for resource services (used by `package/server`).
5. Update `package/server` auth middleware/routes to trust auth-issued JWTs and stop service-local issuance flows.
6. Configure social providers and email-merge account-link policy.
7. Validate end-to-end flows (same-origin token retrieval, offline verification, OAuth/OIDC metadata, provider login).
8. Cut over fully (no compatibility window), then delete obsolete local issuance code paths.

Rollback strategy:
- If cutover fails before launch, revert to previous branch state and disable new auth routes; because service is not live, rollback is code/deploy rollback rather than dual-runtime fallback.

## Open Questions

- Should internal `/api/auth/token` access be restricted by network layer only, or also by explicit client credential policy and allowlist at app layer?
- Should `scope` claim remain a flat string (`"user"`) initially, or be expanded to space-delimited multi-scope contract before launch?
- What exact JWKS cache TTL and unknown-`kid` refresh backoff policy should all services standardize on?

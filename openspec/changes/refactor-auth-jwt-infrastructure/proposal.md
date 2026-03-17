## Why

The current JWT setup is split across `package/auth` and `package/server`, mixes session concerns with OAuth-oriented routing, and keeps verification and signing behavior coupled through cross-package imports and env-heavy helpers. This refactor is needed now to make Better Auth the source of truth for session handling, introduce a typed shared JWT rotation package, and remove the legacy verification paths before they become harder to unwind.

## What Changes

- Create `package/jwt` as a storage-agnostic shared package for jose-based JWT key rotation orchestration, key lifecycle contracts, JWKS serialization, and verification helpers.
- Refactor `package/auth` so Better Auth owns session issuance while JWT and JWKS concerns move under session-oriented modules and routes instead of the old OAuth-centric layout.
- Refactor `package/server` so it owns its own signing and verification flow through the shared contracts, exposes its own JWKS endpoint, and drops unnecessary runtime dependency on `@package/auth`.
- Standardize the monorepo on one private signing key and one JWKS endpoint per server, regardless of how many token types that server issues.
- Replace direct database assumptions in JWT infrastructure with injected persistence adapters typed by `package/jwt`.
- Use Elysia JWT integration where appropriate in Elysia services while keeping core rotation and JWKS behavior framework-agnostic.
- **BREAKING** Delete the legacy verify-related implementation and compatibility paths instead of preserving shadow abstractions.
- **BREAKING** Remove obsolete auth and JWT environment variables that only exist for the current tightly coupled design.
- Review and tighten auth/server CORS behavior so public OAuth and JWKS endpoints stay reachable while session-protected surfaces remain correctly restricted.

## Capabilities

### New Capabilities
- `shared-jwt-rotation`: Defines the shared `package/jwt` contracts, rotation defaults, adapter injection model, and JWKS/key lifecycle behavior used by all issuing services.

### Modified Capabilities
- `es256-jwks-jwt-verification`: Changes JWT issuance and verification from auth-owned helpers and server-local one-offs to per-server ownership using shared rotation and verification contracts.
- `auth-openapi-routes`: Changes auth JWT/JWKS route ownership and pathing so session-related endpoints live under the session domain while required OAuth public endpoints remain explicitly exposed.
- `independent-auth-server`: Changes the auth service boundary so session handling stays in Better Auth, JWT responsibilities are modularized, and downstream services depend only on public contracts such as `AUTH_JWKS_URL`.

## Impact

Problem:
- JWT signing, JWKS publication, token verification, and auth route ownership are currently fragmented across `package/auth` and `package/server`.

Goals:
- Establish a single maintainable JWT architecture shared across services.
- Keep database access inside each server package while sharing typed rotation orchestration.
- Remove legacy verification code and reduce auth-to-server coupling.
- Make public endpoint exposure and CORS rules explicit and auditable.

Non-goals:
- Reworking frontend auth UX flows beyond contract adjustments needed by the backend refactor.
- Adding compatibility layers for deprecated verify paths unless a temporary migration shim is strictly required during rollout.

Scope:
- Affected packages: `package/auth`, `package/server`, `package/contract`, `package/api`, and new `package/jwt`.
- Affected runtime surfaces: session token issuance, JWKS endpoints, token verification, env validation, OpenAPI/session routing, and related tests/docs.

Backward compatibility and migration:
- This change intentionally removes old verify implementations and stale JWT env variables.
- Services and clients must migrate to the new session-owned JWKS and verification contracts during implementation.

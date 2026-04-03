## Context

`package/auth` currently mixes Better Auth session ownership, Better Auth JWT plugin persistence, custom jose verification helpers, OAuth-oriented JWKS routes, and OpenAPI session routes. `package/server` separately signs its own session JWTs, imports verification helpers from `@rezics/auth/jwt`, derives auth JWKS URLs from auth issuer env vars, and keeps its own env surface for local JWT material. The result is a cross-cutting security subsystem with duplicated logic, inconsistent CORS behavior, and a server-to-auth dependency that is stronger than the runtime contract actually requires.

The target state is a shared `package/jwt` package that centralizes storage-agnostic JWT contracts, rotation orchestration, JWKS serialization, and jose-based verification helpers. Each issuing service remains responsible for its own persistence adapter and framework wiring. Better Auth owns session handling in `package/auth`; Elysia JWT remains the service integration layer where it fits; jose-backed logic lives in the shared package. JWT/JWKS routes move under session ownership, while OAuth endpoints remain public and explicitly documented.

Constraints:
- `package/jwt` must not read Prisma or any database client directly.
- Every server gets one private signing key and one JWKS endpoint, regardless of token count.
- Old verify paths are removed, not preserved.
- Issuer and audience information remain mandatory for verification, but runtime services should source them from persisted service metadata rather than ad hoc auth-specific env once migrations complete.

Stakeholders:
- `package/auth` maintainers responsible for Better Auth and OAuth/OIDC surfaces.
- `package/server` maintainers responsible for protected APIs and local session/JWT issuance.
- `package/api` and frontend packages consuming auth/session contracts.

## Goals / Non-Goals

**Goals:**
- Introduce a production-grade `package/jwt` package with explicit interfaces, strict typing, and repo-consistent export boundaries.
- Separate core JWT logic, rotation orchestration, persistence contracts, and Elysia/Better Auth adapters.
- Move auth JWT/JWKS concerns from OAuth-oriented ownership into session-oriented ownership without breaking required OAuth public reachability.
- Make auth and server each responsible for their own issuing and verification logic through shared contracts.
- Delete legacy verify paths, dead abstractions, and obsolete env variables.
- Review and tighten CORS rules for auth and server, especially around JWKS and externally reachable OAuth routes.

**Non-Goals:**
- Changing Better Auth's session model or replacing Better Auth for auth-server session handling.
- Introducing a generic multi-tenant key-management service outside the monorepo.
- Preserving deprecated verify helpers or auth-to-server imports beyond the minimal migration window.
- Redesigning unrelated frontend state management beyond any contract alignment needed for backend path changes.

## Decisions

### Decision: Create `package/jwt` as a framework-agnostic shared package

`package/jwt` will follow the monorepo convention of `src/export.ts` plus narrowly scoped submodule exports. Proposed structure:

```text
package/jwt/
  package.json
  src/
    export.ts
    core/
      export.ts
      jwt-algorithm.ts
      jwt-errors.ts
      jwt-claims.ts
      jwk.ts
      jwks.ts
      verification.ts
    rotation/
      export.ts
      rotation-config.ts
      rotation-types.ts
      rotation-engine.ts
      key-selection.ts
    contracts/
      export.ts
      persistence.ts
      issuer.ts
      verifier.ts
    adapters/
      export.ts
      elysia-jwt.ts
      jose-verifier.ts
      better-auth-jwks.ts
    testing/
      export.ts
      fixtures.ts
```

`src/export.ts` will export only stable package-level contracts and builders. Subpath exports such as `@rezics/jwt/rotation` or `@rezics/jwt/contracts` can be added only if they mirror the existing package style used in `package/auth`.

Why this design:
- Keeps jose-specific code in one place without leaking Prisma or Elysia concerns into the core package.
- Matches current repo preference for explicit folder boundaries and small `export.ts` barrel files.

Alternatives considered:
- Extend `@rezics/auth/jwt`: rejected because it keeps `package/server` coupled to auth ownership.
- Put all JWT code directly in each server: rejected because it recreates duplicated security logic and drift.

### Decision: Split core package responsibilities into contracts, rotation, and adapters

Core contracts will define the strongly typed boundary:

```ts
export type JwtIssuerDescriptor = {
  issuer: string;
  audience: string | string[];
  algorithm: 'ES256';
  jwksPath: string;
};

export type JwtRotationConfig = {
  rotationIntervalMs: number;
  checkIntervalMs: number;
  gracePeriodMs: number;
  tokenTtlMs: number;
};

export type JwtKeyRecord = {
  kid: string;
  algorithm: 'ES256';
  publicKeyPem: string;
  privateKeyPem: string;
  createdAt: Date;
  activatesAt: Date;
  retiresAt: Date | null;
  expiresAt: Date | null;
};

export type JwtKeyPersistence = {
  listKeys(params: {issuer: string}): Promise<JwtKeyRecord[]>;
  saveKey(params: {issuer: string; key: JwtKeyRecord}): Promise<void>;
  markKeyRetiring(params: {
    issuer: string;
    kid: string;
    retiresAt: Date;
    expiresAt: Date;
  }): Promise<void>;
  getKeyByKid(params: {
    issuer: string;
    kid: string;
  }): Promise<JwtKeyRecord | null>;
};
```

The rotation engine will consume only contracts and time/config providers:
- `createRotationEngine(config, persistence, cryptoProvider, clock)`
- `ensureActiveKey()`
- `rotateIfDue()`
- `getActiveSigningKey()`
- `getPublicJwks()`

Verification helpers will be jose-based and env-free:
- `createJwtVerifier({issuer, audience, jwks, clockToleranceSeconds})`
- `verifyBearerToken()`
- `verifyTokenFromHeader()`
- `createRemoteJwksCache()`

Why this design:
- Keeps security behavior testable without booting Elysia or Better Auth.
- Allows each service to adapt its own storage layer with strongly typed parameters.

Alternatives considered:
- Expose raw jose objects only: rejected because it leaves too much service-specific interpretation and typing drift.
- Put rotation and verification in one large service object: rejected because it obscures boundaries and makes adapter leakage likely.

### Decision: Use injected persistence adapters instead of database access inside `package/jwt`

Persistence stays in service packages:
- `package/auth` provides a Prisma-backed adapter for Better Auth key records.
- `package/server` provides its own Prisma-backed adapter for its main/session key records.

The shared package will never import Prisma types or database clients. Instead, service code maps Prisma rows to `JwtKeyRecord` and back at the boundary. This is also where service-specific table names or schema differences live.

Why this design:
- Satisfies the database-isolation constraint.
- Prevents the shared package from becoming coupled to a single persistence model or auth-specific schema.

Alternatives considered:
- Share Prisma schema types in `package/jwt`: rejected because it hard-codes storage assumptions into the core package.

### Decision: Persist per-service JWT metadata in each service database

Both `package/auth` and `package/server` will own a local JWT metadata registry table that stores JWT-related information for trusted issuers, including the local service itself. This registry will be the source of truth for:
- `issuer`
- `audience`
- canonical `jwksUrl` or `jwksPath`
- service identity / ownership marker
- activation state and timestamps needed for safe rollout

Recommended shape:

```ts
type JwtServiceRegistryRecord = {
  id: string;
  serviceKey: string;
  issuer: string;
  audience: string;
  jwksUrl: string;
  isLocalIssuer: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};
```

Recommended relational direction:
- Auth DB:
  - add a `JwtService`-style table for auth itself plus downstream servers that verify or consume auth-issued JWTs;
  - update auth-owned key material rows to reference the local auth service record.
- Server DB:
  - add a `JwtService`-style table for the server itself plus trusted upstream issuers such as auth;
  - add a local signing-key table or equivalent linkage so server-owned keys reference the server’s own registry record.

Why this design:
- Retains explicit `iss` and `aud` validation, which is a security requirement rather than optional metadata.
- Scales beyond a single auth-server relationship to multiple trusted issuers without re-expanding env sprawl.
- Creates a durable migration path where env can bootstrap initial records, but steady-state runtime reads from the database.

Alternatives considered:
- Keep issuer/audience only in env: rejected because it recreates drift and makes multi-server rollout brittle.
- Derive issuer/audience purely from JWKS URL: rejected because JOSE verification still needs an independently trusted `iss` and expected `aud`.

### Decision: Standardize on one signing keypair and one JWKS endpoint per server

Each server will issue all of its JWT token types from one active private signing key and publish one JWKS document containing the active key plus retained grace-period keys.

Auth server:
- Better Auth remains the session owner.
- Auth JWT/JWKS responsibilities move into session-owned modules such as `src/session/jwt/*` and `src/openapi/session.ts`.
- OAuth endpoints remain available, but JWT/JWKS route ownership is expressed under the session domain.

Main server:
- Keeps its own issuer, audience definitions, signing flow, and verification flow.
- Exposes its own JWKS endpoint, likely under `/api/session/jwks` plus optional `/.well-known/jwks.json` if external verification is needed.

Why this design:
- Reduces key sprawl and operator confusion.
- Keeps verification simple and aligns with JOSE/JWKS best practices.

Alternatives considered:
- One key per token type: rejected because it increases operational complexity without a stated need.

### Decision: Auth verification becomes a shared contract, not a package dependency

`package/server` stops importing `@rezics/auth/jwt`. Instead it will:
- use `@rezics/jwt` verification helpers directly;
- load auth verifier inputs from its local JWT metadata registry, with `AUTH_JWKS_URL` retained only as a bootstrap or migration input if needed;
- maintain its own verification wrapper local to the server package for route ergonomics.

This reduces auth-to-server coupling to a runtime contract: auth publishes JWKS, and server consumes auth metadata through persisted trusted-issuer records rather than auth-owned helper code.

Alternatives considered:
- Keep auth-owned helper wrappers for convenience: rejected because it preserves the exact coupling this refactor is trying to remove.

### Decision: Prefer Better Auth first, then shared jose package, then Elysia JWT plugin integration

Auth server:
- Better Auth continues to own session issuance and session lifecycle.
- If Better Auth cannot satisfy the needed rotation/JWKS ownership model directly, `package/auth` wraps or supplements it with `@rezics/jwt` abstractions rather than adding more ad hoc auth-local JWT code.

Elysia servers:
- Use `@elysiajs/jwt` as the route/plugin integration layer for signing and verification ergonomics.
- Back the plugin with key material and JWKS data sourced through the shared package contracts, noting that the plugin itself is jose-based.

Why this design:
- Honors the requested technology precedence.
- Keeps framework-specific concerns at the edges.

### Decision: Move JWT and JWKS routes under session-oriented ownership

Auth-server public layout will be clarified as:
- Session-owned endpoints under `/api/auth/session/*` for JWT/JWKS/session-related concerns.
- OAuth/OIDC endpoints remain under `/api/auth/oauth/*` and required well-known routes.

JWKS exposure strategy:
- Auth: publish one canonical JWKS endpoint under the session domain and keep `/.well-known/jwks.json` as a public compatibility/discovery endpoint if required by OAuth/OIDC clients.
- Server: publish one canonical JWKS endpoint under its session domain; add well-known alias only if external consumers need a standards-based path.
- Both services must permit unauthenticated access to JWKS routes.

Why this design:
- Makes route ownership explicit.
- Separates public OAuth surfaces from session concerns while preserving externally reachable OAuth/OIDC endpoints.

### Decision: Adopt explicit rotation defaults in the shared package

Default config:
- `rotation_interval = 90 days`
- `check_interval = 60 seconds`
- `grace_period = token_ttl * 2`

The engine computes effective grace period from TTL unless explicitly overridden for testing. Rotation checks run on a lightweight interval or on-demand hook. Services may call `rotateIfDue()` during boot and on periodic timers. The engine must guarantee:
- exactly one active signing key at a time;
- previous public keys remain published until after grace expiry;
- unknown `kid` verification triggers one JWKS refresh before failure.

Why this design:
- Matches the requested defaults.
- Keeps rollover safe without hard-coding storage behavior.

### Decision: Use explicit database migrations and backfill steps for JWT metadata

This refactor now includes schema evolution, so the rollout must treat migrations as first-class work:
- add new JWT metadata tables and foreign keys in auth and server;
- backfill one local-service record in each DB before switching readers;
- backfill auth trusted-issuer metadata into server DB and server trusted-issuer metadata into auth DB where cross-service verification is required;
- only remove env-backed fallback reads after code and data have converged.

Engineering practices to enforce:
- unique constraints on `serviceKey`, `issuer`, and any canonical JWKS URL field;
- foreign keys from signing-key rows to the owning local service record;
- repository-level tests for backfill and lookup behavior;
- idempotent migration scripts that can run safely across environments.

## Risks / Trade-offs

- [Better Auth plugin behavior may not align perfectly with the desired session-owned route model] -> Mitigation: treat Better Auth as session authority, but move custom route ownership and JWKS publishing into explicit session modules even if Better Auth internals remain plugin-driven.
- [Deleting legacy verify code may temporarily break downstream callers] -> Mitigation: complete a repository-wide import/env cleanup in the same change and update tests before removing exports.
- [Per-server JWKS introduces more operational surfaces than auth-only JWKS] -> Mitigation: standardize contracts, route naming, env docs, and test coverage so every service follows the same pattern.
- [Rotation bugs can create token-verification outages] -> Mitigation: isolate the rotation engine behind deterministic unit tests, fake clocks, and adapter contract tests.
- [CORS tightening may regress browser flows] -> Mitigation: explicitly enumerate public origins, credential rules, allowed headers, and public unauthenticated endpoints for both auth and server.

## Migration Plan

1. Create `package/jwt` with typed contracts, rotation engine, jose verifier helpers, and adapter-facing tests.
2. Refactor `package/auth` JWT modules into session-owned modules and route ownership, with Prisma adapter implementations kept local to auth.
3. Update Better Auth integration to consume the new auth-local adapter wrapper built on `@rezics/jwt` contracts.
4. Replace auth-local verify exports and server imports with direct `@rezics/jwt` verifier usage.
5. Refactor `package/server` session signing and JWKS publication to use local adapter + shared rotation engine + Elysia JWT integration.
6. Remove `@rezics/auth` dependency from `package/server` where no longer needed.
7. Add auth/server DB migrations and backfill steps for JWT service metadata before removing runtime env fallbacks.
8. Update OpenAPI/session route documentation, CORS policies, and public endpoint tests.
9. Delete legacy verify implementations, stale helpers, dead env vars, and compatibility code.

Rollback strategy:
- Roll back as a unit by reverting the change if integration issues surface before deployment completes.
- Do not keep permanent compatibility layers; if rollout needs staging, keep it behind a short-lived branch, not long-lived code paths.

## Open Questions

- Whether auth should retain both `/api/auth/session/jwks` and `/.well-known/jwks.json` permanently, or keep only the compatibility alias required for OAuth/OIDC discovery.
- Whether `package/server` needs a standards-based well-known JWKS alias or only an internal canonical session JWKS route.
- Whether Better Auth's built-in JWT plugin can be adapted cleanly through the new contracts, or whether auth should own JWKS persistence/orchestration outside the plugin while still letting Better Auth manage session issuance.

## Target Integration Notes

### Auth integration strategy

- Introduce `package/auth/src/session/jwt/` for auth-owned adapter glue, route handlers, and Better Auth bridging.
- Replace `src/jwt/verify.ts`, `src/jwt/auth-local.ts`, and related exports with service-local verifier wrappers built on `@rezics/jwt`.
- Move current JWKS logic out of `src/openapi/oauth.ts` and into session-owned route modules, leaving OAuth docs to reference the public compatibility endpoints where required.
- Keep OAuth discovery, authorization, token, userinfo, revoke, and callback endpoints public and correctly documented.

### Server integration strategy

- Introduce local modules such as `package/server/src/session/jwt/issuer.ts`, `rotation-adapter.ts`, `jwks-route.ts`, and `verify-auth.ts`.
- Replace `package/server/src/session/jwt.ts` with a composition root that sources its active key from the shared rotation engine and wires that into `@elysiajs/jwt`.
- Replace `package/server/src/user/util/index.ts` auth verification imports from `@rezics/auth/jwt` with direct `@rezics/jwt` verifier creation.

### Verification flow redesign

- Auth-issued token verification in `package/server` becomes:
  1. Read `AUTH_JWKS_URL`.
  2. Build a jose verifier from `@rezics/jwt`.
  3. Validate `alg`, `kid`, `iss`, `aud`, `exp`, `nbf`, transport, and required claims.
  4. On unknown `kid`, refresh JWKS once and retry.
- Server-issued token verification follows the same contract, but uses server-local issuer/audience/JWKS settings.
- No legacy verify helper or shadow implementation remains after the refactor.

### Env variable cleanup plan

Auth remove or reduce:
- `AUTH_JWT_ISSUER`
- `AUTH_JWT_AUDIENCE`
- `AUTH_JWT_TTL_SECONDS`
- `AUTH_JWKS_ROTATION_INTERVAL_SECONDS`
- `AUTH_JWKS_GRACE_PERIOD_SECONDS`

Auth retain:
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_SECRETS` if Better Auth rotation still needs it
- `AUTH_TRUSTED_ORIGINS`
- provider/mail settings

Server remove:
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET` if no longer used elsewhere
- `AUTH_API_URL`
- `MAIN_SESSION_JWT_PRIVATE_KEY`
- `MAIN_SESSION_JWT_PUBLIC_KEY`
- `MAIN_SESSION_JWT_ISSUER`
- `MAIN_SESSION_JWT_AUDIENCE`
- `MAIN_SESSION_JWT_TTL_SECONDS`

Server retain:
- bootstrap-only env needed to seed local DB records during migration
- server-local issuer/audience/TTL settings only if still required during transitional backfill, with the steady-state source of truth moved into the server DB

Service metadata persistence replaces long-lived runtime auth verifier env:
- auth DB stores auth-local issuer/audience/JWKS metadata and any trusted downstream issuer records it must reason about;
- server DB stores server-local issuer/audience/JWKS metadata plus trusted auth issuer metadata used for offline verification.

### CORS review checklist

- Auth:
  - confirm credentialed browser routes use explicit allowed origins, not wildcard defaults;
  - confirm public JWKS endpoints are accessible without credentials;
  - confirm OAuth/OIDC public endpoints remain reachable from required external origins;
  - confirm allowed headers are minimal and case-consistent.
- Server:
  - replace `cors()` default usage in `src/core.ts` with explicit policy;
  - align `src/index.ts` and `src/core.ts` so they do not diverge;
  - ensure JWKS endpoints are public where verification requires it;
  - confirm session-protected APIs do not accidentally inherit overly broad public exposure.

### Code deletion and cleanup checklist

- Delete `package/auth/src/jwt/verify.ts`
- Delete `package/auth/src/jwt/auth-local.ts`
- Delete any auth re-exports that expose verifier helpers as shared public API
- Delete server imports from `@rezics/auth/jwt`
- Delete legacy verify tests and replace them with `@rezics/jwt` contract tests plus service integration tests
- Delete stale OAuth-centric JWKS route ownership where session ownership replaces it
- Delete obsolete env declarations and docs
- Delete any dead token helper, fallback path, or transport shim left behind by the migration

### Consumption examples

Auth server consumption:

```ts
const rotation = createRotationEngine(config, authJwtPersistence, joseKeyFactory, clock);
const activeKey = await rotation.getActiveSigningKey();
const authSessionJwt = jwt({ name: 'authSessionJwt', secret: createPrivateKey(activeKey.privateKeyPem), alg: 'ES256' });
const authJwksHandler = () => Response.json(await rotation.getPublicJwks());
```

Elysia server consumption:

```ts
const rotation = createRotationEngine(config, serverJwtPersistence, joseKeyFactory, clock);
const activeKey = await rotation.getActiveSigningKey();

export const mainSessionJwtPlugin = jwt({
  name: 'jwt',
  secret: createPrivateKey(activeKey.privateKeyPem),
  alg: 'ES256',
  iss: serverIssuer,
  aud: serverAudience,
  exp: `${tokenTtlSeconds}s`,
});

export const verifyAuthIdentity = createJwtVerifier({
  issuer: authIssuer,
  audience: authAudience,
  jwks: createRemoteJwksCache({jwksUrl: env.AUTH_JWKS_URL}),
});
```

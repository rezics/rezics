## 1. Create shared JWT package

- [x] 1.1 Add `package/jwt/package.json` and `package/jwt/src/export.ts` using the repo's package export conventions.
- [x] 1.2 Create `package/jwt/src/core`, `package/jwt/src/contracts`, `package/jwt/src/rotation`, and `package/jwt/src/adapters` modules with typed exports for JWT claims, JWKS models, verifier options, and rotation configuration.
- [x] 1.3 Implement the jose-based verification helpers in `package/jwt` with explicit issuer, audience, transport, and JWKS inputs and no env access.
- [x] 1.4 Implement the storage-agnostic rotation engine in `package/jwt` with default `rotation_interval = 90 days`, `check_interval = 60 seconds`, and `grace_period = token_ttl * 2`.
- [x] 1.5 Add unit tests for rotation scheduling, active-key selection, JWKS serialization, and unknown-`kid` refresh behavior in `package/jwt`.

## 2. Refactor auth service ownership

- [x] 2.1 Introduce `package/auth/src/session/jwt/` modules for auth-local adapter composition, Better Auth integration, signing/JWKS orchestration, and session-domain route handlers.
- [x] 2.2 Add an auth-side JWT service metadata table plus migration/backfill for auth-local issuer, audience, canonical JWKS path, and ownership flags.
- [x] 2.3 Update the auth JWKS key table or related persistence shape so auth-owned keys reference the local auth JWT service metadata record and satisfy shared-package lifecycle needs cleanly.
- [x] 2.4 Replace auth-local JWT persistence logic in `package/auth/src/auth/instance.ts` with a Prisma-backed adapter that implements `package/jwt` contracts without leaking Prisma into the shared package.
- [x] 2.5 Add repository/service tests for auth JWT metadata lookup, key ownership linkage, and migration/backfill safety.
- [x] 2.6 Move auth JWT and JWKS route ownership from the old OAuth-centric arrangement into session-owned routes and keep any required `/.well-known/jwks.json` compatibility endpoint public.
- [x] 2.7 Update `package/auth/src/openapi/session.ts`, `package/auth/src/openapi/oauth.ts`, and related contract/docs modules so session-owned JWT/JWKS routes and public OAuth/OIDC routes remain explicit and correctly documented.
- [x] 2.8 Replace auth-local verifier wrappers and exports with auth-internal wrappers built on `@rezics/jwt`, then delete `package/auth/src/jwt/verify.ts`, `package/auth/src/jwt/auth-local.ts`, and any dead re-exports.

## 3. Refactor server service ownership

- [x] 3.1 Add a server-side JWT service metadata table plus migration/backfill for this server’s own issuer, audience, canonical JWKS endpoint, and trusted upstream issuers such as auth.
- [x] 3.2 Add a server-owned signing-key persistence table or linkage that references the local server JWT service metadata record and supports shared rotation contracts.
- [x] 3.3 Replace `package/server/src/session/jwt.ts` with a composition root that sources active signing keys through a server-local adapter plus `@rezics/jwt` rotation contracts and wires them into `@elysiajs/jwt`.
- [x] 3.4 Add server-local JWKS publication under the session domain and ensure the server exposes exactly one canonical JWKS endpoint for all server-issued JWTs.
- [x] 3.5 Replace `package/server/src/user/util/index.ts` auth verification imports from `@rezics/auth/jwt` with direct `@rezics/jwt` verifier creation based on `AUTH_JWKS_URL`.
- [x] 3.6 Switch server auth verification wrappers to read trusted auth issuer/audience/JWKS values from the local JWT service metadata table instead of runtime auth env.
- [x] 3.7 Remove any unnecessary `@rezics/auth` dependency usage from `package/server` and update local verification helpers, route guards, and tests to use shared contracts only.
- [x] 3.8 Confirm every server-issued token type uses the same active private signing key and the same published JWKS surface.

## 4. Clean env, CORS, and public surface contracts

- [x] 4.1 Audit `package/auth/src/env.ts` and reduce JWT/JWKS env variables to bootstrap-only inputs used for migration or emergency override rather than steady-state runtime reads.
- [x] 4.2 Audit `package/server/src/env.ts` and reduce legacy JWT/auth verification env variables so persisted JWT service metadata becomes the steady-state source of truth.
- [x] 4.3 Replace implicit or duplicated CORS setup in `package/auth/src/core.ts`, `package/server/src/core.ts`, and `package/server/src/index.ts` with explicit public-versus-credentialed policies for session, JWKS, and OAuth routes.
- [x] 4.4 Review route accessibility and ensure JWKS endpoints are publicly reachable while protected session-only routes continue enforcing auth boundaries.
- [x] 4.5 Update docs and deployment references for the new env model, DB-backed JWT metadata, JWKS routes, and session-owned pathing.

## 5. Delete legacy coupling and stale code paths

- [x] 5.1 Grep the repo for legacy verify helpers, JWKS derivation fallbacks, auth-owned JWT imports, and obsolete env references, then migrate remaining call sites to the new contracts.
- [x] 5.2 Delete compatibility-only code paths, dead abstractions, and stale tests that preserved the old verify design.
- [x] 5.3 Remove unused exports and package dependencies created by the old auth-to-server coupling and verify the workspace still builds cleanly.
- [x] 5.4 Review `package/api`, `package/contract`, and any frontend consumers for path or contract changes caused by session-domain routing updates and migrate them as needed.

## 6. Validate the refactor

- [x] 6.1 Add or update targeted tests for auth JWT metadata persistence, server JWT metadata persistence, auth JWKS exposure, server JWKS exposure, auth-issued token verification, server-issued token verification, and rotation grace-period behavior.
- [x] 6.2 Run targeted tests for `package/auth`, `package/server`, and the new `package/jwt` package, including any JWT/JWKS integration coverage introduced by the refactor.
- [x] 6.3 Run workspace build or typecheck commands that cover changed public exports and confirm there are no remaining imports from deleted verify modules.
- [x] 6.4 Perform a final repo-wide search for legacy verify names, removed env variables, shadow JWT implementations, and missing JWT metadata backfill paths to ensure the cleanup is complete.

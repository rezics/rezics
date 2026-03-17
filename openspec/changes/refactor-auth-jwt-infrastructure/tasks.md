## 1. Create shared JWT package

- [ ] 1.1 Add `package/jwt/package.json` and `package/jwt/src/export.ts` using the repo's package export conventions.
- [ ] 1.2 Create `package/jwt/src/core`, `package/jwt/src/contracts`, `package/jwt/src/rotation`, and `package/jwt/src/adapters` modules with typed exports for JWT claims, JWKS models, verifier options, and rotation configuration.
- [ ] 1.3 Implement the jose-based verification helpers in `package/jwt` with explicit issuer, audience, transport, and JWKS inputs and no env access.
- [ ] 1.4 Implement the storage-agnostic rotation engine in `package/jwt` with default `rotation_interval = 90 days`, `check_interval = 60 seconds`, and `grace_period = token_ttl * 2`.
- [ ] 1.5 Add unit tests for rotation scheduling, active-key selection, JWKS serialization, and unknown-`kid` refresh behavior in `package/jwt`.

## 2. Refactor auth service ownership

- [ ] 2.1 Introduce `package/auth/src/session/jwt/` modules for auth-local adapter composition, Better Auth integration, signing/JWKS orchestration, and session-domain route handlers.
- [ ] 2.2 Replace auth-local JWT persistence logic in `package/auth/src/auth/instance.ts` with a Prisma-backed adapter that implements `package/jwt` contracts without leaking Prisma into the shared package.
- [ ] 2.3 Move auth JWT and JWKS route ownership from the old OAuth-centric arrangement into session-owned routes and keep any required `/.well-known/jwks.json` compatibility endpoint public.
- [ ] 2.4 Update `package/auth/src/openapi/session.ts`, `package/auth/src/openapi/oauth.ts`, and related contract/docs modules so session-owned JWT/JWKS routes and public OAuth/OIDC routes remain explicit and correctly documented.
- [ ] 2.5 Replace auth-local verifier wrappers and exports with auth-internal wrappers built on `@package/jwt`, then delete `package/auth/src/jwt/verify.ts`, `package/auth/src/jwt/auth-local.ts`, and any dead re-exports.

## 3. Refactor server service ownership

- [ ] 3.1 Replace `package/server/src/session/jwt.ts` with a composition root that sources active signing keys through a server-local adapter plus `@package/jwt` rotation contracts and wires them into `@elysiajs/jwt`.
- [ ] 3.2 Add server-local JWKS publication under the session domain and ensure the server exposes exactly one canonical JWKS endpoint for all server-issued JWTs.
- [ ] 3.3 Replace `package/server/src/user/util/index.ts` auth verification imports from `@package/auth/jwt` with direct `@package/jwt` verifier creation based on `AUTH_JWKS_URL`.
- [ ] 3.4 Remove any unnecessary `@package/auth` dependency usage from `package/server` and update local verification helpers, route guards, and tests to use shared contracts only.
- [ ] 3.5 Confirm every server-issued token type uses the same active private signing key and the same published JWKS surface.

## 4. Clean env, CORS, and public surface contracts

- [ ] 4.1 Audit `package/auth/src/env.ts` and remove obsolete JWT or JWKS env variables that are replaced by Better Auth ownership or shared-package defaults.
- [ ] 4.2 Audit `package/server/src/env.ts` and remove legacy JWT, verify, issuer, audience, and local key env variables so `AUTH_JWKS_URL` remains the only auth-specific runtime dependency.
- [ ] 4.3 Replace implicit or duplicated CORS setup in `package/auth/src/core.ts`, `package/server/src/core.ts`, and `package/server/src/index.ts` with explicit public-versus-credentialed policies for session, JWKS, and OAuth routes.
- [ ] 4.4 Review route accessibility and ensure JWKS endpoints are publicly reachable while protected session-only routes continue enforcing auth boundaries.
- [ ] 4.5 Update docs and deployment references for the new env model, JWKS routes, and session-owned pathing.

## 5. Delete legacy coupling and stale code paths

- [ ] 5.1 Grep the repo for legacy verify helpers, JWKS derivation fallbacks, auth-owned JWT imports, and obsolete env references, then migrate remaining call sites to the new contracts.
- [ ] 5.2 Delete compatibility-only code paths, dead abstractions, and stale tests that preserved the old verify design.
- [ ] 5.3 Remove unused exports and package dependencies created by the old auth-to-server coupling and verify the workspace still builds cleanly.
- [ ] 5.4 Review `package/api`, `package/contract`, and any frontend consumers for path or contract changes caused by session-domain routing updates and migrate them as needed.

## 6. Validate the refactor

- [ ] 6.1 Add or update targeted tests for auth JWKS exposure, server JWKS exposure, auth-issued token verification, server-issued token verification, and rotation grace-period behavior.
- [ ] 6.2 Run targeted tests for `package/auth`, `package/server`, and the new `package/jwt` package, including any JWT/JWKS integration coverage introduced by the refactor.
- [ ] 6.3 Run workspace build or typecheck commands that cover changed public exports and confirm there are no remaining imports from deleted verify modules.
- [ ] 6.4 Perform a final repo-wide search for legacy verify names, removed env variables, and shadow JWT implementations to ensure the cleanup is complete.

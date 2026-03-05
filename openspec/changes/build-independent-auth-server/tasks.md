## 1. Auth package foundation

- [ ] 1.1 Create `package/auth/src` app entrypoints (`index`, `core`, `export`) and align scripts in `package/auth/package.json` with actual source files.
- [ ] 1.2 Add `package/auth/src/env.ts` using t3-env with explicit auth env contracts (`BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `DATABASE_URL`, key and provider settings).
- [ ] 1.3 Add dedicated Prisma schema/migration scaffold in `package/auth/prisma` targeting `rezics_auth`.
- [ ] 1.4 Define auth user model with single primary key `id` (`uuidv7` db-generated) and unique `slug` plus required Better Auth tables.

## 2. Better Auth and auth feature modules

- [ ] 2.1 Implement Better Auth instance module with explicit `baseURL` and `basePath` (`/api/auth`) and secret rotation-ready configuration.
- [ ] 2.2 Enable Better Auth Prisma adapter integration for `package/auth` Prisma client.
- [ ] 2.3 Add auth modules under `package/auth/src/<name>` (no `feature/` folder), including routing composition and shared error handling.
- [ ] 2.4 Enable Better Auth JWT plugin endpoints (`/api/auth/token`, `/api/auth/jwks`) and bearer-token flow for internal usage.
- [ ] 2.5 Add compatibility endpoint `/.well-known/jwks.json` returning JWKS equivalent to `/api/auth/jwks`.

## 3. OAuth/OIDC provider capability

- [ ] 3.1 Enable `@better-auth/oauth-provider` with OIDC minimum capability (`openid`, `userinfo`, `id_token`).
- [ ] 3.2 Expose discovery endpoints `/.well-known/openid-configuration` and `/.well-known/oauth-authorization-server` when supported.
- [ ] 3.3 Configure issuer validation (`iss` response behavior), RP-initiated logout compatibility, and dynamic client policy classes (public/confidential/trusted) if registration is enabled.
- [ ] 3.4 Configure required external providers (Google, Microsoft, GitHub, Twitter) and implement verified-email merge linking policy.

## 4. ES256 signing, JWKS rotation, and verifier utilities

- [ ] 4.1 Configure ES256 signing with a single active private key and deterministic `kid` assignment.
- [ ] 4.2 Implement key rotation support to publish multiple JWKS keys and retain old keys for `max token TTL + buffer`.
- [ ] 4.3 Create shared JWT verify utility module (claims and header checks: `alg`, `kid`, `iss`, `aud`, `exp`, `nbf`, `clockTolerance`).
- [ ] 4.4 Implement reusable Elysia auth hook wrapper using the shared verifier for resource-service route protection.
- [ ] 4.5 Enforce audience strategy contract (`aud=rezics-api`, scoped claim containing `user`) in issuance and verification paths.

## 5. Server migration to auth-issued JWT

- [ ] 5.1 Replace `package/server` local JWT verification/signing dependency path with shared JWKS-based verification hook.
- [ ] 5.2 Remove or isolate server-local auth issuance flows that conflict with dedicated auth-server ownership.
- [ ] 5.3 Update `package/server` protected routes to consume auth-issued bearer JWTs only and keep stateless behavior.
- [ ] 5.4 Add migration updates for any changed public exports/imports across workspace packages (repo-wide search and import adjustments).

## 6. Security hardening and validation

- [ ] 6.1 Implement explicit internal/external boundary controls for `/api/auth/token` (policy checks, exposure controls, structured auth errors).
- [ ] 6.2 Add tests for JWKS retrieval, unknown-`kid` refresh behavior, and ES256 verification failure modes.
- [ ] 6.3 Add tests for OAuth/OIDC discovery endpoints and required provider login wiring.
- [ ] 6.4 Run package-level build/typecheck for `package/auth` and `package/server` and fix integration failures.
- [ ] 6.5 Run end-to-end verification for login -> token issuance -> bearer call to `package/server` with offline JWKS validation.

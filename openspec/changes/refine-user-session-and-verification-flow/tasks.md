## 1. Auth context token and verifier refactor

- [x] 1.1 Add the auth-server endpoint and shared client contract for `auth_context_token` in `package/auth/src/openapi/session.ts`, `package/auth/src/openapi/index.ts`, and the matching `package/api/src/auth/*` helpers.
- [x] 1.2 Implement `auth_context_token` issuance in `package/auth` with the same signing key material as `auth_identity_token`, and include the claims needed for onboarding and first-time user creation such as verification status, avatar, name, slug, and id.
- [x] 1.3 Refactor `package/auth/src/jwt/verify.ts` into a parameter-driven verification core that accepts issuer settings and keys explicitly, then move env-bound auth-only wrappers into separate files under `package/auth/src/jwt/` and re-export them through `package/auth/src/jwt/index.ts`.
- [x] 1.4 Update `package/auth/src/jwt/verify.test.ts` and related auth tests to cover `auth_identity_token`, `auth_context_token`, the pure verifier API, and the auth-local env wrapper behavior.

## 2. Main-server ensure and session separation

- [x] 2.1 Update `package/server/src/user/api/user.core.api.ts`, `package/server/src/user/service/user.service.ts`, and related DTO/contracts so `GET /users/ensure` verifies `auth_identity_token`, checks whether the user already exists, returns an explicit already-created result when it does, and never issues the main-server JWT.
- [x] 2.2 Add `auth_context_token` verification to the missing-user path in `package/server` and map its verified claims to the local `User` creation fields without introducing any direct call from `package/server` to auth-server APIs.
- [x] 2.3 Implement the dedicated main-server JWT issuance endpoint in `package/server/src/session/*` and its API surface as `/session/token`, ensuring it is separate from `/users/ensure` and uses only verified client-supplied tokens plus local server state.
- [x] 2.4 Disable or remove `/jwt-payload` in the server token/session surface, and update any server-side contract or route registration that still exposes it.
- [x] 2.5 Add a server-local wrapper around the parameterized auth verifier where needed, and verify that `package/server` imports only the pure verification entry points rather than auth env-bound wrappers.

## 3. Frontend bootstrap and onboarding flow

- [x] 3.1 Update `package/api/src/react-query/jwt.ts`, auth query/mutation helpers, and related token utilities so the client stores `auth_identity_token`, `auth_context_token`, and the main-server session token separately and no longer depends on `/jwt-payload`.
- [x] 3.2 Update `package/app-shell/src/provider/AuthProvider.tsx`, `package/app-shell/src/state/authStore.ts`, and `package/app-shell/src/state/authSessionStore.ts` so the bootstrap sequence becomes auth identity -> auth context -> `/users/ensure` -> `/session/token`.
- [x] 3.3 Update `package/app/src/app/provider/AuthProvider.tsx`, `package/app/src/user/state/*`, and header/onboarding components so pending-verification and ready states are derived from `auth_context_token` claims plus ensured-user/session status.
- [x] 3.4 Ensure logout, token-expiry handling, and verification failure paths clear all three token contexts and reset any derived user/session state consistently.

## 4. Validation

- [x] 4.1 Add or update targeted tests in `package/auth`, `package/server`, `package/api`, `package/app-shell`, and `package/app` for auth-context issuance, ensure existing-user behavior, ensure new-user creation from `auth_context_token`, `/session/token`, and `/jwt-payload` removal.
- [x] 4.2 Run the relevant build, lint, and targeted test commands for `package/auth`, `package/server`, `package/api`, `package/app-shell`, and `package/app`, and fix any repo-wide compile errors caused by the verifier export changes.

## Why

The current auth split between `package/auth` and `package/server` is incomplete for the real login and registration lifecycle. The app can authenticate against the auth service, but `package/server` no longer owns a lightweight session token for its own permission snapshot, `/users/ensure` is unfinished, and the frontend still treats "has user profile" as the only authenticated header state.

This change is needed now because registration and login must converge on a verified handoff: the frontend should use `auth_identity_token` to prove identity to `package/server`, `package/server` should treat the auth service as the single source of truth for session readiness by consulting the existing auth session-state API before provisioning or refresh, and the app should render a pending-verification account state until a `rezics_session_token` is available.

## What Changes

- Complete `GET /users/ensure` in `package/server` so login and registration flows can create or load the business user from a verified `auth_identity_token`.
- Reintroduce `@elysiajs/jwt` in `package/server` and let the main server issue its own asymmetric `rezics_session_token` with an independent main-server signing secret for server-side permission prefiltering.
- Standardize token naming and transport conventions across services: `auth_identity_token` stays in `Authorization: Bearer <token>`, and server-issued tokens use dedicated `x-<token-name>` headers such as `x-rezics_session_token`.
- Refactor shared JWT verification so `package/auth/src/jwt/verify.ts` becomes the primary issuer-aware verification entry point with injected verification secrets or JWKS configuration, while `package/server/src/user/util/index.ts` only re-exports auth-owned helpers.
- Add a main-server refresh flow so expired `rezics_session_token` values can be renewed only after `auth_identity_token` has been refreshed or confirmed first, then re-check auth session state before signing a replacement token.
- Update permission-protected main-server routes to check `rezics_session_token.permission.role` before database access, then re-check persisted user permissions from the database to support immediate freezes or permission downgrades.
- Update `package/app` header behavior so newly registered or otherwise unverified users render a new `PendingVerificationSection` instead of `AuthenticatedSection`, showing basic auth-owned user info, a verify-email action, and `MoreHorizMenu` without the authenticated avatar dropdown.
- Update `package/api/src/react-query/jwt.ts` and `package/app-shell/src/provider/AuthProvider.tsx` to support a parameterized multi-token strategy driven by props and env-backed token key lists with safe defaults while preserving the existing `auth-store` key.
- **BREAKING** Replace the previous assumption that all protected main-server routes can authorize directly from auth-issued bearer tokens alone.
- **BREAKING** Normalize token names and transport contracts, which requires frontend and backend callers to stop using ad hoc token naming.

## Capabilities

### New Capabilities
- `main-server-session-authorization`: Main-server session token issuance, transport, and permission-prefilter behavior for `rezics_session_token`.

### Modified Capabilities
- `lazy-user-provisioning`: Move business-user provisioning responsibility to the verified `/users/ensure` flow instead of relying on implicit provisioning behavior elsewhere.
- `app-auth-onboarding`: Show a pending-verification authenticated header state until verification completes and the main-server session is ready.
- `frontend-auth-state-separation`: Track auth-server identity and main-server session tokens separately with normalized token names, parameterized token-key configuration, and readiness selectors.
- `es256-jwks-jwt-verification`: Expand token verification to support issuer-scoped token parsing and verification for both auth-server and main-server asymmetric JWTs.

## Impact

- Affected packages: `package/server`, `package/auth`, `package/app`, `package/api`, `package/contract`.
- Affected APIs: `GET /users/ensure`, main-server session refresh, `GET /api/auth/get-session-state`, main-server protected routes, shared JWT verification utilities, and frontend token/header handling.
- Affected UI: `MainLayoutHeader`, new `PendingVerificationSection`, and login/registration bootstrap behavior after auth-session completion.
- Affected dependencies: `package/server` reintroduces `@elysiajs/jwt`; all JWTs remain asymmetric and issuer-scoped.
- Backward compatibility: no compatibility layer for previously unpublished contracts is required; the implementation can adopt the new token, refresh, and transport rules directly.
- Migration needs: update frontend HTTP/token helpers, route guards, and server authorization middleware together so `auth_identity_token` and `rezics_session_token` are never confused during rollout.

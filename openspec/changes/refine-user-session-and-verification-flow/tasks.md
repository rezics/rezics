## 1. Shared token contracts

- [ ] 1.1 Define normalized token names, header contracts, and related DTO or helper types in `package/contract` and any shared API types consumed by `package/api`, `package/auth`, and `package/server`.
- [ ] 1.2 Add configurable multi-token key inputs with safe defaults for app-level env wiring while preserving the existing `auth-store` key, and document the configuration boundary between shared packages and app packages.
- [ ] 1.3 Refactor `package/auth/src/jwt/verify.ts` into the primary issuer-aware verifier for `auth_identity_token` and `rezics_session_token`, with injected verification secrets or JWKS inputs, and convert `package/server/src/user/util/index.ts` into a re-export-only surface.
- [ ] 1.4 Reintroduce `@elysiajs/jwt` in `package/server` with an independent main-server signing secret and compile the affected JWT wiring.

## 2. Main-server ensure and authorization flow

- [ ] 2.1 Implement `GET /users/ensure` in `package/server/src/user/api/user.core.api.ts` so it verifies `Authorization: Bearer <auth_identity_token>`, checks auth-owned session state before provisioning, and returns the ensured `UserDTO`.
- [ ] 2.2 Add a small server-local adapter around the existing auth session-state surface in `package/auth/src/openapi/session.ts` so main-server ensure and refresh can consume `/api/auth/get-session-state` consistently.
- [ ] 2.3 Add main-server session issuance and refresh logic that emits `x-rezics_session_token: <rezics_session_token>` after successful ensure handoff and can reissue the token from valid `auth_identity_token` when the main-server session expires.
- [ ] 2.4 Keep main-server readiness auth-owned by removing local readiness gating beyond the auth session-state check, while preserving local permission checks for authorized routes.
- [ ] 2.5 Update permission-protected main-server routes and middleware to prefilter with `rezics_session_token.permission.role` and then re-check persisted user permissions from the database.

## 3. Frontend auth-state and header updates

- [ ] 3.1 Update [jwt.ts](D:/ICS/Library.Book/Library.Book/package/api/src/react-query/jwt.ts) so it supports a configurable multi-token strategy, env-backed token key defaults supplied by consuming apps, and distinct handling for `auth_identity_token` and `rezics_session_token`.
- [ ] 3.2 Update [AuthProvider.tsx](D:/ICS/Library.Book/Library.Book/package/app-shell/src/provider/AuthProvider.tsx) so refresh orchestration can coordinate multiple token types through props/config inputs, always refresh `auth_identity_token` first, and never refresh downstream tokens when auth identity is unavailable.
- [ ] 3.3 Update frontend auth/bootstrap wiring in `package/app` so `auth_identity_token` and `rezics_session_token` are stored, parsed, proactively refreshed, and cleared separately.
- [ ] 3.4 Add `PendingVerificationSection` and update `package/app/src/core/component/header/MainLayoutHeader.tsx` to render auth-owned summary data, a verify-email button, and `MoreHorizMenu` whenever auth identity exists but main-server readiness is incomplete.
- [ ] 3.5 Adjust login and registration bootstrap flows so the frontend calls `/users/ensure` only at the verified handoff and transitions from pending verification to member-ready when `rezics_session_token` is available.

## 4. Validation

- [ ] 4.1 Add or update targeted tests for JWT verification, secret-injected verifier configuration, auth-first refresh ordering, `/users/ensure` provisioning, main-server refresh via auth session-state, role-prefilter authorization, and pending-verification header rendering.
- [ ] 4.2 Run the relevant build, lint, and targeted test commands for `package/auth`, `package/server`, `package/app`, `package/app-shell`, and shared contract consumers to verify the migration end to end.

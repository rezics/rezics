## Context

`package/auth` already verifies and issues ES256 JWTs with JOSE-based verification helpers, while `package/server` recently removed `@elysiajs/jwt` and now depends on auth-issued bearer tokens more directly. That simplified the stack temporarily, but it left three gaps:

- `GET /users/ensure` is not implemented even though the frontend needs it in both registration and login handoffs.
- `package/server` no longer has its own session token for fast permission screening and route-local metadata.
- `package/app` still maps account chrome primarily from business-user presence, which does not work for newly registered users who are authenticated in auth but are not yet verified or member-ready.

The target design spans `package/auth`, `package/server`, `package/app`, `package/app-shell`, `package/api`, and `package/contract`. It must preserve asymmetric JWT verification, keep verification logic centralized in `package/auth/src/jwt/verify.ts`, and define a clear contract between auth identity, main-server session state, and business-domain permissions.

## Goals / Non-Goals

**Goals:**

- Make `/users/ensure` the explicit verified handoff for business-user provisioning in login and registration flows.
- Standardize token naming and transport so each token has one issuer, one purpose, and one header contract.
- Reintroduce a main-server-issued `rezics_session_token` for permission prefiltering with an independent main-server signing secret.
- Keep main-server permission enforcement two-layered: token snapshot first, database truth second.
- Move issuer-aware JWT parsing and verification into `package/auth/src/jwt/verify.ts`, with `package/server` consuming re-exported helpers only and passing verifier inputs explicitly instead of relying on env-bound global state.
- Render a dedicated pending-verification header state in `package/app` whenever the user has auth identity but is not yet member-ready.
- Support a multi-token frontend strategy where `package/api` and `package/app-shell` expose configuration hooks or props, and feature packages provide env-derived token key lists with safe defaults.

**Non-Goals:**

- Redesign the full permissions schema beyond encoding the current main-server role into the session token.
- Replace database-backed permission checks with token-only authorization.
- Introduce symmetric JWT algorithms or opaque session cookies for these flows.
- Solve notification-server or search-server token issuance in this change beyond reserving normalized names such as `notification_session_token` and `search_session_token`.

## Decisions

### Decision: Adopt a dual-token model with normalized issuer-specific names

The system will distinguish between:

- `auth_identity_token`: issued by `package/auth`, transported as `Authorization: Bearer <token>`, used to prove user identity and readiness claims from the auth service.
- `rezics_session_token`: issued by `package/server`, transported as `x-rezics_session_token: <token>`, used for main-server permission prefiltering and lightweight session metadata.

Future service tokens such as `notification_session_token` and `search_session_token` will follow the same `<issuer>_<token-type>` naming contract, but they are out of implementation scope for this change.

Rationale:

- Each token becomes unambiguous in logs, headers, and frontend persistence.
- The transport contract itself documents issuer intent.
- Cross-service confusion between auth identity and business authorization is reduced.

Alternatives considered:

- Continue overloading `Authorization` for every token. Rejected because it hides issuer boundaries and encourages accidental token reuse.
- Keep server routes auth-only with no local session token. Rejected because permission-prefiltering and quick metadata access become more expensive and less explicit.

### Decision: Make `/users/ensure` the only provisioning endpoint for auth-to-business handoff

`GET /users/ensure` will verify `auth_identity_token`, call the existing auth session-state surface at `/api/auth/get-session-state` to confirm the current login and verification state, create the user if missing, and return the canonical `UserDTO`. The same flow will mint `rezics_session_token` once the user is member-ready according to auth-owned readiness fields.

`GET /users/me` remains a business-profile read endpoint and no longer needs to be the place where first-time provisioning happens.

Rationale:

- Registration and login now share one explicit handoff contract.
- Provisioning rules become easier to reason about and test.
- The frontend can separate "authenticated in auth" from "ready in main server" cleanly.
- The readiness gate is backed by explicit auth-server state rather than by frontend assumptions alone.
- Main-server readiness logic stays a thin proxy over auth-owned state instead of becoming a second user-state system.

Alternatives considered:

- Keep provisioning inside `GET /users/me`. Rejected because the frontend already needs a dedicated ensure step and the old behavior blurs read vs bootstrap responsibilities.
- Provision immediately during auth registration. Rejected because the user specifically wants provisioning gated behind the verified handoff to the main server.

### Decision: Reintroduce main-server JWT issuance for permission snapshotting, but keep database truth authoritative

`package/server` will use `@elysiajs/jwt` again to issue its own asymmetric session token. The token payload will be intentionally narrow and will currently include only:

- `permission.role`: one of `ROOT`, `ADMIN`, `USER`, `BLOCKED`

Permission-protected routes will:

1. Verify `x-rezics_session_token`.
2. Reject clearly unauthorized requests from the token snapshot before querying the database.
3. Load the current user permissions from the database.
4. Re-evaluate authorization against the persisted permission state before completing the handler.

Rationale:

- Most unauthorized traffic is rejected cheaply.
- Permission freezes or downgrades still take effect immediately because the database remains authoritative.
- The token avoids becoming a second source of truth for mutable business data.
- Main-server user readiness does not depend on local business-user state beyond the existence of service-specific data.

Alternatives considered:

- Token-only permission enforcement. Rejected because it delays revocations until token refresh.
- Database-only permission checks. Rejected because it removes the requested prefilter and increases load on protected endpoints.

### Decision: Refresh main-server session tokens from verified auth identity

When `rezics_session_token` expires, the frontend will first refresh or confirm `auth_identity_token`. Only if auth identity is still available should any downstream token refresh proceed. The frontend will then present `auth_identity_token` to a main-server refresh endpoint. The main server will verify the auth token, request `/api/auth/get-session-state`, and sign a replacement `rezics_session_token` only if the user is still logged in and still eligible according to auth-owned readiness.

Rationale:

- The auth server remains the source of truth for login state.
- Main-server session refresh can stay low-retry and high-performance because it reuses current auth identity instead of requiring a full sign-in flow.
- Revocations and verification regressions are caught during refresh rather than only during business requests.
- The refresh order is deterministic: no non-auth token may refresh when `auth_identity_token` is unavailable.

Alternatives considered:

- Refresh `rezics_session_token` without re-checking auth status. Rejected because it allows stale auth sessions to outlive the source of truth.
- Force the frontend to call `/users/ensure` on every expiration. Rejected because refresh and provisioning are related but distinct concerns.

### Decision: Use `@elysiajs/jwt` only for main-server token issuance

`@elysiajs/jwt` will be used in `package/server` only to sign `rezics_session_token`. All verification paths will remain in auth-owned shared helpers exported from `package/auth`, even for main-server tokens. This is acceptable because the Elysia plugin delegates JWT behavior to JOSE-compatible configuration rather than introducing an incompatible verification model.

Rationale:

- Signing remains integrated with Elysia where it is useful.
- Verification remains centralized and reusable.
- Main and auth services can keep separate private/public key systems without duplicating verification logic.

Alternatives considered:

- Verify main-server tokens with `@elysiajs/jwt` inside `package/server`. Rejected because it would split verification logic across packages.
- Avoid `@elysiajs/jwt` entirely. Rejected because the requested server integration benefits from its Elysia-native issuance flow.

### Decision: Centralize issuer-aware verification in `package/auth/src/jwt/verify.ts`

`package/auth/src/jwt/verify.ts` will become the shared verification entry point for all normalized token types. It will parse transport input, infer or validate token purpose, and verify tokens against issuer-specific asymmetric keys or JWKS configuration supplied by callers.

`package/server/src/user/util/index.ts` and other server-local utility layers should only re-export auth-owned verification helpers or lightweight adapters.

Rationale:

- One verification contract avoids issuer drift across packages.
- New token types can be added without duplicating JOSE logic across services.
- The server package stays focused on business behavior rather than cryptographic plumbing.
- The auth package remains reusable because verification secrets and key sources are injected instead of hidden behind package-local env assumptions.

Alternatives considered:

- Keep separate verifier implementations in auth and server. Rejected because the user explicitly wants `package/auth/jwt/verify` to own the major responsibility.
- Move all verification into `package/server`. Rejected because auth already owns the core asymmetric verification stack and issuer metadata.

### Decision: Keep frontend multi-token wiring configurable at package boundaries

`package/api/src/react-query/jwt.ts` and `package/app-shell/src/provider/AuthProvider.tsx` are shared package surfaces, so they should expose configuration inputs rather than hardcoding app-specific token keys. The app package will provide env-derived token key lists with safe defaults while the persisted Zustand `auth-store` key remains unchanged.

Rationale:

- Shared packages stay reusable across apps and shells.
- Token-key configuration can evolve without rewriting the storage primitives.
- The refresh loop can be optimized for low retry behavior while still supporting multiple token types cleanly.
- One coordinator can enforce auth-first refresh order and prevent recursive retries.

Alternatives considered:

- Hardcode token keys inside `package/api` and `package/app-shell`. Rejected because those packages should not own app-specific env policy.
- Introduce separate stores per token immediately. Rejected because the current requirement only needs configurable token handling while preserving the existing auth store key.

### Decision: Derive header chrome from auth readiness, not only from business profile existence

`package/app` will render a new `PendingVerificationSection` when the user has auth identity but has not completed verification or is still missing `rezics_session_token`. `AuthenticatedSection` renders only when the main-server session is ready.

`PendingVerificationSection` should use basic auth-owned user info, should not render the authenticated avatar-triggered dropdown, and should instead render a verify-email button together with `MoreHorizMenu`.

Rationale:

- The existing `currentUser ? AuthenticatedSection : UnauthenticatedSection` split is too coarse for the requested lifecycle.
- Registration and login now both require a visible intermediate authenticated state.
- The UI behavior matches the backend handoff contract more closely.

Alternatives considered:

- Keep rendering `AuthenticatedSection` for all auth-session users. Rejected because it implies member readiness before verification is complete.
- Keep rendering `UnauthenticatedSection` until `UserDTO` exists. Rejected because the user is signed in and should see account-aware verification guidance.

## Risks / Trade-offs

- [Risk] `auth_identity_token` and `rezics_session_token` can drift in freshness during rollout. → Mitigation: refresh `auth_identity_token` first, never refresh any downstream token without it, and make invalidation order explicit in the shared frontend token helpers.
- [Risk] Reintroducing `@elysiajs/jwt` could diverge from the JOSE verification model already used in auth. → Mitigation: use `@elysiajs/jwt` only for main-server token issuance, keep verification in auth-owned shared helpers, and rely on the plugin's JOSE-compatible configuration surface. Plugin document https://elysiajs.com/plugins/jwt
- [Risk] Main-server readiness checks could still drift if auth status and local rules are evaluated in different places. → Mitigation: treat auth as the single source of truth for session readiness, proxy readiness through `/api/auth/get-session-state`, and test verified, unverified, and expired-session cases explicitly. [get-session-state](@/package/auth/src/openapi/session.ts)
- [Risk] Pending-verification UI may lack some business-profile fields and break assumptions in shared header components. → Mitigation: design `PendingVerificationSection` around auth-owned fields (name, avatar, How to query reference auth prisma schema), a verify-email button, and `MoreHorizMenu` rather than the authenticated avatar dropdown.
- [Risk] Frontend multi-token refresh can become noisy or recursive if each token path retries independently. → Mitigation: keep `AuthProvider` as the single refresh coordinator, enforce auth-first refresh order, and make token strategy configurable rather than duplicating loops. 

## Migration Plan

1. Extend shared token contracts in `package/contract` and `package/api` to distinguish `auth_identity_token` from `rezics_session_token` and define configurable token-key inputs with safe defaults.
2. Refactor `package/auth/src/jwt/verify.ts` into an issuer-aware verification module with injected secret or JWKS inputs, and convert `package/server/src/user/util/index.ts` into a re-export layer.
3. Reintroduce `@elysiajs/jwt` in `package/server` with an independent main-server signing secret for `rezics_session_token`.
4. Implement `/users/ensure` and the related main-server refresh flow so auth status is checked through `/api/auth/get-session-state` before provisioning or reissuing a session token.
5. Update permission-protected server routes to prefilter with `rezics_session_token.permission.role` and then re-check database permissions.
6. Update `package/api/src/react-query/jwt.ts`, `package/app-shell/src/provider/AuthProvider.tsx`, and app-level header/bootstrap wiring so pending-verification users show `PendingVerificationSection` until the main-server session is available.

Rollback strategy:

- Revert frontend header and token-helper changes first so the app falls back to the previous profile-driven state.
- Disable main-server session issuance and route prefilter middleware while preserving auth bearer verification.
- Restore the previous server verifier wiring only if the centralized auth verifier proves incompatible during rollout.

## Open Questions

- All tokens should include expiration metadata so the frontend can proactively refresh them, but only after confirming `auth_identity_token` exists and refreshing it first. The remaining implementation choice is whether `rezics_session_token` renewal should be fully proactive on a timer or opportunistic immediately after auth-token refresh.

All refreshes should be timer-based. Essentially, when another token needs to be refreshed, you should first check the status of the `auth_identity_token`. If the `auth_identity_token` has reached its refresh interval, refresh it first before refreshing the current token. The refresh interval is refresh_time = exp - (ttl * 0.2 ~ 0.3)

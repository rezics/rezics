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

### Decision: Hydrate verified token payloads into request context middleware once per request

`package/server` will verify normalized JWT transports in middleware and write the verified payloads onto request context so handlers do not parse or verify JWTs repeatedly. The request context contract will be:

- `ctx.identity`: verified `auth_identity_token` payload from `Authorization: Bearer <token>` when the route requires login identity
- `ctx.session`: verified `rezics_session_token` payload from `x-rezics_session_token` when the route requires permission-bearing main-server authorization

Route-level behavior will follow this split:

1. Routes that require login but not business authorization must require `ctx.identity`.
2. Routes that require permissions must require both `ctx.identity` and `ctx.session`.
3. Permission-protected routes must still re-check persisted database permissions after the `ctx.session.permission.role` prefilter.

Rationale:

- JWT verification runs once per request rather than once per helper or service call.
- Handlers become simpler and use `ctx.identity` / `ctx.session` directly instead of calling verifier utilities repeatedly.
- Identity proof and permission-bearing authorization remain distinct without duplicating parsing or verification work.

Alternatives considered:

- Keep helper functions that verify tokens inside each handler. Rejected because it repeats work and spreads transport/auth rules across handlers.
- Decode payloads without central middleware and trust unverified headers downstream. Rejected because every consumer would need to reason about verification state manually.

### Decision: Keep frontend multi-token wiring configurable at package boundaries

`package/api/src/react-query/jwt.ts` and `package/app-shell/src/provider/AuthProvider.tsx` are shared package surfaces, so they should expose configuration inputs rather than hardcoding app-specific token keys. The app package will provide env-derived token key lists with safe defaults while the persisted Zustand `auth-store` key remains unchanged.

Configuration boundary:

- Shared packages (`package/api`, `package/app-shell`) own token primitives, refresh sequencing, and default token-key names.
- Consuming apps may override token storage keys and auth base URL through configuration hooks, but they must not rename or repurpose the legacy `auth-store` key used for `auth_identity_token`.
- `rezics_session_token` storage may vary by app, but its transport header and normalized token name remain fixed across packages.

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
5. Add request middleware that hydrates verified `ctx.identity` and `ctx.session`, then update permission-protected server routes to prefilter with `rezics_session_token.permission.role` and re-check database permissions.
6. Update `package/api/src/react-query/jwt.ts`, `package/app-shell/src/provider/AuthProvider.tsx`, and app-level header/bootstrap wiring so pending-verification users show `PendingVerificationSection` until the main-server session is available.

Rollback strategy:

- Revert frontend header and token-helper changes first so the app falls back to the previous profile-driven state.
- Disable main-server session issuance and route prefilter middleware while preserving auth bearer verification.
- Restore the previous server verifier wiring only if the centralized auth verifier proves incompatible during rollout.

## Refresh Timing

- All token refreshes should be timer-based.
- When a downstream token such as `rezics_session_token` reaches its refresh interval, the frontend must first evaluate `auth_identity_token`.
- If `auth_identity_token` is also within its refresh interval, the frontend must refresh `auth_identity_token` first and only then refresh the downstream token.
- The refresh interval should be derived from token expiry metadata as `refresh_time = exp - (ttl * 0.2 ~ 0.3)`, allowing refresh before hard expiry without waiting until the final minute.

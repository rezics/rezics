## Context

The current draft for `refine-user-session-and-verification-flow` still centers the main server around two behaviors that are no longer acceptable:

- `package/server` calls auth-owned session-state APIs directly to decide whether it can ensure a user or refresh a session.
- `GET /users/ensure` is treated as both the provisioning handoff and the place where the main-server JWT is issued.

That design makes `package/server` depend on auth availability, duplicates auth-owned verification state, and couples two operations that now need different responsibilities. It also leaves `package/auth/src/jwt/verify.ts` too close to env-bound configuration, which would leak auth-only setup into `package/server`.

The revised target design keeps auth as the issuer of identity and user-context tokens, keeps the frontend as the handoff layer between auth and main, and makes the main server verify only the tokens it receives from the client.

## Goals / Non-Goals

**Goals:**

- Add an auth-owned `auth_context_token` that contains the fields required for onboarding, verification-aware UI, and first-time user creation.
- Ensure `package/server` does not call auth server APIs directly during ensure or session issuance.
- Make `/users/ensure` responsible only for checking login state and creating the business user when missing.
- Move main-server JWT issuance to a dedicated `/session/token` endpoint.
- Disable `/jwt-payload` and let frontend packages parse payloads locally.
- Refactor `package/auth/src/jwt/verify.ts` so the core verifier accepts all secrets, keys, and issuer settings as parameters rather than reading env.
- Keep env-bound verifier helpers available only through auth-local wrapper files, and prevent `package/server` from depending on them.
- Preserve the existing pending-verification UX intent, but source it from `auth_context_token` and the separated ensure/session workflow.

**Non-Goals:**

- Redesign the full auth provider integration or token-issuance stack beyond adding `auth_context_token`.
- Introduce a new cookie-based session model.
- Define a new generic payload-inspection endpoint to replace `/jwt-payload`.
- Expand the main-server session token payload beyond what is already needed for main-server authorization.

## Decisions

### Decision: Auth issues a dedicated `auth_context_token` for user-context handoff

`package/auth` will expose a new endpoint that returns `auth_context_token`. The token will be signed with the same signing key material as `auth_identity_token`, but it serves a different purpose: it packages the auth-owned user context required by frontend onboarding and first-time main-server provisioning.

Minimum required claims or equivalent payload fields:

- stable user id
- verification status
- avatar
- name
- slug
- any other auth-owned fields needed to create the main-server `User`

The frontend will request this token after login or session recovery and pass it onward when it needs verification-aware UI or first-time ensure.

Rationale:

- The auth server remains the source of truth for verification and user-profile context.
- The main server no longer needs to call auth just to learn onboarding fields.
- The frontend becomes the explicit boundary between auth and main services.

Alternatives considered:

- Keep calling auth session-state APIs from `package/server`. Rejected because the user explicitly wants the main server offline from auth.
- Expand `auth_identity_token` until it doubles as the full context token. Rejected because identity proof and provisioning context have different responsibilities and lifecycles.

### Decision: `GET /users/ensure` only ensures the business user

`GET /users/ensure` will:

1. Verify `auth_identity_token` to confirm the caller is logged in.
2. Query the main-server database for an existing business user.
3. If the user already exists, return an explicit "already created" success result and stop.
4. If the user does not exist, verify `auth_context_token`.
5. Create the user from verified `auth_context_token` claims.

`GET /users/ensure` will not issue the main-server JWT and will not contact auth server APIs.

Rationale:

- The endpoint now has one responsibility: ensuring the local user exists.
- Existing users are handled cheaply with a local lookup.
- New-user creation uses auth-owned context without adding service-to-service coupling.

Alternatives considered:

- Keep issuing the main-server JWT inside `/users/ensure`. Rejected because "ensure" should not also be "create session".
- Create the user directly from `auth_identity_token`. Rejected because the user wants `auth_context_token` to carry the full provisioning fields.

### Decision: Main-server JWT issuance moves to `/session/token`

The main server will expose a dedicated `/session/token` endpoint for minting its own JWT. This endpoint is independent from `/users/ensure` and should operate only after login has been proven and the business user has already been ensured.

The endpoint may verify `auth_identity_token` and use locally persisted user data to mint the main-server session token, but it must not call auth services directly. If verification-specific behavior is needed by the session endpoint, the frontend must supply the required auth token context rather than relying on a server-to-server call.

Rationale:

- Session issuance becomes explicit and separately testable.
- The frontend can control the sequence: auth login -> auth context fetch -> ensure -> session token.
- Main-server session semantics no longer leak into onboarding/provisioning.

Alternatives considered:

- Keep a hidden session side effect in `/users/ensure`. Rejected because it makes retries and error handling ambiguous.
- Eliminate the main-server JWT entirely. Rejected because the broader change still expects a main-server session token.

### Decision: `/jwt-payload` is disabled and frontend packages parse JWT payloads locally

Any frontend package that needs token claims will decode the JWT payload client-side. Shared packages such as `package/api` and `package/app-shell` may provide helpers for safe payload parsing, but they will not rely on `/jwt-payload`.

Rationale:

- Payload inspection does not need a network call.
- Removing the endpoint reduces backend surface area and simplifies auth/session orchestration.
- The client already has the token and can parse non-secret claims locally.

Alternatives considered:

- Keep `/jwt-payload` as a convenience API. Rejected because it adds little value and complicates the contract.

### Decision: `package/auth/src/jwt/verify.ts` becomes a pure verification core

`package/auth/src/jwt/verify.ts` will expose verification functions that require callers to pass issuer configuration, verification keys or secrets, transport expectations, and token-purpose rules explicitly. It will not import env values directly.

Auth-local env readers and convenience wrappers will move into separate files under `package/auth/src/jwt/`, and `package/auth/src/jwt/index.ts` may re-export them for auth-package usage. `package/server` must not import those env-bound wrappers. If `package/server` needs a simpler call site, it should implement its own wrapper that supplies parameters from server-local configuration.

Rationale:

- The shared verifier stays reusable and deterministic.
- Auth-local env assumptions stop leaking across package boundaries.
- The server can remain explicit about which issuer and key material it is verifying against.

Alternatives considered:

- Keep env access inside `verify.ts`. Rejected because it violates the desired package boundary.
- Duplicate verifier logic in `package/server`. Rejected because the user still wants auth to own the shared verification core.

### Decision: Frontend state tracks three token contexts

The client will model:

- `auth_identity_token` for login proof
- `auth_context_token` for auth-owned user context and verification-aware UI
- the main-server session token for server authorization

The frontend sequence becomes:

1. Recover or acquire `auth_identity_token`.
2. Request `auth_context_token`.
3. Call `/users/ensure`.
4. Request `/session/token`.

UI selectors will derive pending-verification and ready states from `auth_context_token` claims plus the presence of the main-server session token, without calling `/jwt-payload`.

Rationale:

- Each token has one job.
- The client can orchestrate the cross-service handoff explicitly.
- Pending-verification UI can use auth-owned fields before the business profile exists.

Alternatives considered:

- Collapse context back into one token. Rejected because the new boundary depends on distinct identity and user-context responsibilities.

## Risks / Trade-offs

- [Risk] `auth_context_token` may drift from the current auth user record if its issue cadence is too loose. -> Mitigation: issue it on demand from auth session endpoints and treat it as short-lived onboarding context.
- [Risk] Existing frontend code may still assume `/users/ensure` returns a user DTO and a ready session in one step. -> Mitigation: update contracts and bootstrap flows together, and add tests for the new multi-step sequence.
- [Risk] Removing `/jwt-payload` can break hidden callers. -> Mitigation: grep the repo during implementation, migrate callers to local parsing helpers, and add compile/test coverage for shared auth utilities.
- [Risk] Auth-local wrapper exports could still be imported by `package/server` accidentally. -> Mitigation: keep the pure verifier and env-bound wrappers in separate files, document the boundary in `index.ts`, and add server-side lint or test coverage around the intended import surface.

## Migration Plan

1. Add the new auth endpoint and DTO/helper wiring for `auth_context_token` in `package/auth` and `package/api`.
2. Refactor `package/auth/src/jwt/verify.ts` into a parameter-driven core, move env-bound auth wrappers into sibling files, and update exports in `package/auth/src/jwt/index.ts`.
3. Update `package/server` so `/users/ensure` performs login check plus local ensure only, with no direct auth-server calls and no session-token issuance side effect.
4. Implement the dedicated main-server `/session/token` endpoint and remove or disable `/jwt-payload`.
5. Update `package/app-shell` and `package/app` to fetch `auth_context_token`, parse payloads locally, call `/users/ensure`, then call `/session/token`.
6. Run targeted tests and compile checks across auth, server, api, app-shell, and app.

Rollback strategy:

- Re-enable the previous frontend bootstrap only if the code change is fully reverted in the same release.
- Avoid partial rollback that restores `/users/ensure` side effects without also restoring the old client flow.
- If the verifier refactor causes issues, keep the pure verifier API and patch only the wrapper layer rather than reintroducing env access into `verify.ts`.

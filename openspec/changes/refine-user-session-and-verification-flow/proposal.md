## Why

The current change still assumes that `package/server` can call auth-owned session-state APIs directly, that `GET /users/ensure` can both provision a user and issue the main-server JWT, and that shared JWT verification may resolve secrets from env implicitly. Those assumptions now conflict with the intended boundary: the auth server must hand the frontend a richer `auth_context_token`, while the main server must stay offline from auth and only verify tokens presented by the client.

This change is needed now because the login, verification, ensure, and session-token flow must be simplified before implementation starts. Without rewriting the contract first, `package/auth`, `package/server`, `package/api`, `package/app-shell`, and `package/app` would implement the wrong trust boundary and the wrong endpoint responsibilities.

## What Changes

- Add an auth-server endpoint that issues `auth_context_token`, signed with the same key material as `auth_identity_token`, and containing the user fields needed for onboarding and provisioning such as verification status, avatar, name, slug, and id.
- Change the frontend bootstrap flow so it fetches `auth_context_token` first, uses `auth_identity_token` only to prove login state to the main server, and parses JWT payloads locally instead of relying on `/jwt-payload`.
- Redefine `GET /users/ensure` in `package/server` so it only ensures the business user: it checks login with `auth_identity_token`, returns an explicit "user already created" result when the user already exists, and otherwise verifies `auth_context_token` before creating the user from its claims.
- Move main-server JWT issuance to a dedicated `/session/token` endpoint and remove token issuance from `/users/ensure`.
- Disable `/jwt-payload` because frontend consumers should decode payloads locally when they need token claims.
- Refactor `package/auth/src/jwt/verify.ts` into a parameter-driven verifier with no direct env dependency; move env-bound wrappers into separate files under the same folder and export them through `index.ts` for auth-internal use only.
- Require `package/server` to use the parameterized verifier directly or through its own server-local wrapper, and forbid it from importing env-bound auth verifier wrappers.
- **BREAKING** Remove the previously proposed server-to-auth session-state call pattern from the main-server ensure and session-token flow.
- **BREAKING** Split the previous combined ensure-and-session contract into two endpoints: `/users/ensure` and `/session/token`.
- **BREAKING** Disable `/jwt-payload`, which requires frontend callers to stop depending on that endpoint.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `app-auth-onboarding`: derive onboarding and pending-verification UI from `auth_context_token` and the separated ensure/session steps.
- `es256-jwks-jwt-verification`: require parameter-driven verification helpers, add `auth_context_token` verification, and remove env-bound verifier usage from shared entry points.
- `frontend-auth-state-separation`: track `auth_identity_token`, `auth_context_token`, and the main-server session token separately while disabling `/jwt-payload`.
- `lazy-user-provisioning`: make `/users/ensure` validate login with `auth_identity_token`, create only when needed from `auth_context_token`, and stop issuing session tokens.
- `main-server-session-authorization`: move main-server JWT issuance to `/session/token` and keep session creation independent from ensure.

## Impact

- Affected packages: `package/auth`, `package/server`, `package/api`, `package/app-shell`, `package/app`, and any shared contract modules used by those packages.
- Affected APIs: new auth endpoint for `auth_context_token`, `GET /users/ensure`, `POST /session/token` (or equivalent main-server session issuance route), and removal or disablement of `/jwt-payload`.
- Affected UI and client state: login/register bootstrap, pending-verification handling, ensured-user creation flow, session bootstrap, logout cleanup, and any header logic that currently depends on `/jwt-payload`.
- Backward compatibility: no compatibility shim is planned for the previous direct auth-session lookup or ensure-issued session-token design; implementation should adopt the new boundary directly.
- Migration needs: update shared JWT helpers, server wrappers, API clients, frontend token stores, and onboarding/session bootstrap in the same rollout so the client never mixes the old and new contracts.

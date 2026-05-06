## Why

### Problem

The current temporary auth design exposes too many browser-visible token and auth integration surfaces. Browser code can obtain JWT-like session material, auth and main server responsibilities are blurred, and some flows require either direct frontend-to-auth calls or cross-service notifications from auth back into main. This creates avoidable security risk and operational coupling before release.

The project also has identity ambiguity between users and units. A user and a unit are separate domain entities: `userId` and `unitId` are not interchangeable, and `userSlug` and `unitSlug` are not interchangeable. Existing code and token claims need an audit so actor identity, content ownership, and display routing do not rely on accidental equivalence.

### Goals

- Make `https://rezics.com/auth/*` the only public browser-facing auth surface, owned by the main server.
- Keep the auth package native internal routes, while mapping public `/auth/*` to auth internal `/api/auth/*`.
- Treat the auth session cookie as an opaque refresh authority for the main `rezics-session-token`.
- Store browser session credentials only in httpOnly cookies; remove browser-visible rezics/auth JWT storage for normal web flows.
- Keep auth-domain authorization inside auth and main-domain authorization inside main.
- Place the future external API token wallet in the main server, with auth receiving context through main-controlled flows when needed.
- Audit and correct user/unit identity usage across server, auth, API client, app, admin, and related services.

### Non-goals

- Do not preserve compatibility with the temporary unreleased auth/token design.
- Do not make auth server a standalone public product API.
- Do not require main to parse or enforce auth roles from the opaque auth session cookie.
- Do not add a separate main refresh token unless a future need appears for independent main refresh revocation or audit.
- Do not move OAuth protocol implementation out of auth unless later implementation proves that necessary.

## What Changes

- Main server exposes `/auth/*` as the public auth boundary and proxies eligible auth-native routes to the internal auth service.
- `auth.rezics.com` may keep public DNS for deployment and diagnostics, but product clients, OAuth redirect URIs, email links, discovery metadata, and frontend code must use `rezics.com/auth/*`.
- Public auth paths are clean `/auth/*`; the internal auth base path remains `/api/auth/*`.
- Main blocks or keeps internal-only the current auth session JWT endpoint equivalent to `GET /api/auth/token`; this endpoint must not be exposed as public `GET /auth/token`.
- Public OAuth/OIDC routes are served through main, for example `/auth/oauth/authorize`, `/auth/oauth/token`, `/auth/oauth/userinfo`, `/auth/oauth/revoke`, `/auth/oauth/register`, and `/auth/callback/:provider`.
- Main owns `/auth/session/refresh`. This endpoint accepts the auth session httpOnly cookie, validates session state through auth internally, provisions or verifies main user readiness, and sets or refreshes the `rezics-session-token` httpOnly cookie.
- Auth session cookies are httpOnly, `Secure` in production, `SameSite=Lax`, and scoped to public path `/auth`.
- `rezics-session-token` is stored as an httpOnly cookie for browser web flows.
- Browser clients no longer store normal auth or rezics session JWTs in localStorage or parse them for app state.
- Auth-domain routes such as auth admin, organization management, OAuth client registration, and auth JWKS service management remain authorized by auth. Main forwards the opaque auth session cookie and does not add auth-role checks.
- Main-domain routes, including routes that mutate main DB state, main admin resources, main token wallet entries, main sessions, or main permissions, require main authorization in main even if their public path is under `/auth/*`.
- Mixed auth/main workflows are split where possible. If a mixed endpoint cannot be split, main performs main authorization first and then calls auth internally with service context.
- Auth and main configuration separates internal service URL from public auth URL and public issuer URL.
- OAuth/OIDC discovery metadata advertises main public URLs. Main server keeps its own `/.well-known/jwks.json` for `rezics-session-token`; auth session/OIDC JWKS is published under `/auth/session/jwks` or another explicit auth-scoped path.
- Cookie path and redirect headers from auth are configured or rewritten so browser-visible paths use `/auth/*`, not `/api/auth/*`.
- CSRF and origin protections are required for cookie-authenticated write and refresh endpoints.
- Frontend packages use main-relative `/auth/*` routes and stop depending on a direct auth host for browser flows.
- User/unit identity usage is audited and corrected. Rezics session claims move toward actor `sub`/`userId`, not `unitId`, while unit identifiers remain content/domain identifiers.

## Capabilities

### New

- `main-auth-public-boundary` - Main server owns the public `/auth/*` boundary, proxies auth-native routes internally, defines direct-public auth server policy, and classifies auth-domain versus main-domain authorization.
- `opaque-auth-session-refresh` - Auth session cookie is the opaque refresh authority for issuing or refreshing the main `rezics-session-token` httpOnly cookie through `/auth/session/refresh`.
- `main-token-wallet-context` - Main server owns future external/resource API token wallet state and supplies context to auth-owned flows only through main-controlled internal calls.
- `identity-claim-consistency` - User and unit identifiers, slugs, session claims, route params, and API payloads are audited and corrected so user identity is never confused with unit identity.

### Modified

- `auth-openapi-routes` - Public auth route exposure moves from direct auth host `/api/auth/*` to main `/auth/*` with internal path mapping and public endpoint restrictions.
- `rezics-oauth-oidc-provider` - OAuth/OIDC endpoints and discovery metadata advertise main public URLs while auth continues to own protocol implementation internally.
- `auth-login-orchestration` - Login and callback completion run through main so main can provision/readiness-check user state and refresh the main session cookie without auth notifying main.
- `frontend-auth-state-separation` - Frontend auth state is hydrated from cookie-backed session APIs instead of localStorage JWT parsing.
- `server-access-token` - Main browser session tokens are delivered and refreshed as httpOnly cookies rather than JSON tokens intended for localStorage.
- `user-domain-decoupling` - Existing user/unit separation rules are tightened to remove accidental `userId`/`unitId` equivalence in contracts and implementation.

## Scope

Affected packages include:

- `package/server` - public auth proxy, refresh endpoint, main authorization checks, token wallet ownership, session cookie handling, identity claim updates, and route/JWKS configuration.
- `package/auth` - internal auth base path preservation, cookie path/base URL/issuer configuration, OAuth/OIDC metadata, auth-domain route behavior, and removal or restriction of public session JWT exposure.
- `package/api` - browser API client changes from localStorage bearer tokens to cookie-backed auth and refresh flows.
- `package/app` - login, callback, session hydration, and auth state updates to use main `/auth/*`.
- `package/admin` - auth/admin flows updated to use main `/auth/*` while preserving auth-domain authorization semantics.
- `package/contract` - shared route, session, token, OAuth, user, and unit contracts updated where public shape changes.
- `package/reaction` and other services - verify which endpoints can continue independently using `rezics-session-token` and which require main proxy because they need non-`userId` main context or main mutations.
- OpenSpec specs for auth routes, OAuth/OIDC, frontend auth state, server access tokens, login orchestration, and user/unit identity.

## Impact

This is a breaking change to an unreleased temporary design. The migration should remove direct browser dependencies on `auth.rezics.com`, bearer-token localStorage session handling, and public auth JWT exchange endpoints. Existing development and deployment configuration must distinguish internal auth service URLs from public auth URLs and issuer metadata.

The expected security outcome is a smaller browser credential surface: the browser holds httpOnly cookies, auth session state remains opaque to main, and authorization decisions stay in the service that owns the protected domain. The expected architecture outcome is a single public orchestration boundary through main, avoiding auth-to-main notifications and public cross-service coupling.

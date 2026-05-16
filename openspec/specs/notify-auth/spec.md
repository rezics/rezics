## ADDED Requirements

### Requirement: JWT verification for read endpoints

All user-facing read endpoints SHALL verify caller's identity by validating `rezics-session-token` (issued by server) via the server's JWKS endpoint. Extract `sub` claim as `userId`, scope queries to that user's data. The token SHALL be accepted from EITHER the `Authorization: Bearer` header OR the `Cookie` header (`rezics-session-token` cookie name). When both are present, the `Authorization` header SHALL take precedence. This dual-acceptance enables both browser clients (which receive the token as an `HttpOnly` cookie per `subdomain-trust-boundary`) and non-browser clients (CLI, internal tooling, future mobile) to authenticate.

#### Scenario: Valid rezics-session-token via Authorization header

- **WHEN** a user-facing read endpoint receives a request with `Authorization: Bearer <valid-rezics-session-token>`
- **THEN** the JWT is verified against the server's JWKS, `sub` is extracted as `userId`, and the request proceeds

#### Scenario: Valid rezics-session-token via cookie

- **WHEN** a user-facing read endpoint receives a request with no `Authorization` header but with `Cookie: rezics-session-token=<valid-jwt>; …`
- **THEN** the JWT is extracted from the cookie, verified against the server's JWKS, `sub` is extracted as `userId`, and the request proceeds

#### Scenario: Both Authorization and cookie present

- **WHEN** a request includes both `Authorization: Bearer <token-A>` and `Cookie: rezics-session-token=<token-B>`
- **THEN** the `Authorization` header value (`token-A`) is used for verification; the cookie is ignored

#### Scenario: Neither Authorization nor cookie present

- **WHEN** a request includes no `Authorization` header and no `rezics-session-token` cookie
- **THEN** the request is rejected with 401

#### Scenario: auth-session-token is rejected

- **WHEN** a request includes an `auth-session-token` (issuer "rezics-auth") in `Authorization: Bearer` or as the cookie value
- **THEN** verification fails (issuer mismatch) and the endpoint returns 401

### Requirement: Reuse @rezics/jwt verification

Notify SHALL use `createJwtVerifier()` and `createRemoteJWKSet()` from `@rezics/jwt` to verify server-issued tokens. The JWKS URL SHALL point to the server's `/.well-known/jwks.json` endpoint instead of the auth service's JWKS endpoint.

#### Scenario: JWKS URL points to server

- **WHEN** the notify service initializes its JWT verifier
- **THEN** the remote JWKS URL is configured to the main server's JWKS endpoint

### Requirement: Elysia requireUser macro

Notify SHALL define `requireUser` Elysia macro performing `rezics-session-token` verification, populating `userId` in request context, applied to all user-facing endpoints. The macro SHALL extract the token via a shared `resolveSessionToken(authorization, cookieHeader)` helper that mirrors the server's resolution logic.

#### Scenario: requireUser extracts userId from rezics-session-token

- **WHEN** a user-facing endpoint processes a request with `requireUser: true`
- **THEN** the `userId` in request context is the `sub`/`unitId` claim from the `rezics-session-token`, regardless of whether the token arrived via `Authorization` or `Cookie`

### Requirement: WebSocket authentication via cookie

WebSocket endpoint `WS /dm` SHALL authenticate via the `rezics-session-token` cookie sent on the WebSocket upgrade request. Notify SHALL extract the cookie from the upgrade request's `Cookie` header, verify the JWT against the server's JWKS, and populate `userId` on the connection context. Invalid or missing tokens SHALL cause immediate close with code 4001. The legacy `?token=<jwt>` query parameter authentication path SHALL be removed.

#### Scenario: WebSocket accepts cookie on handshake

- **WHEN** a browser opens a WebSocket connection to `WS /dm` from a `*.rezics.com` origin (or `localhost` in dev) and the `rezics-session-token` cookie is set
- **THEN** the browser includes the cookie on the upgrade request, notify verifies it, and the connection is established

#### Scenario: Missing cookie closes connection

- **WHEN** a WebSocket upgrade request to `WS /dm` arrives with no `rezics-session-token` cookie
- **THEN** the connection is closed with code 4001

#### Scenario: Query-parameter token no longer accepted

- **WHEN** a WebSocket upgrade request to `WS /dm?token=<jwt>` arrives with a query parameter but no cookie
- **THEN** the connection is closed with code 4001 (the query parameter path is removed)

### Requirement: CORS with credentials for browser clients

Notify SHALL configure `@elysiajs/cors` with `credentials: true` and a non-wildcard origin allow-list. The allow-list SHALL match `https://*.rezics.com` (and `https://rezics.com`) in production and `http://localhost:*` in development. This is required so that browsers include the `HttpOnly` `rezics-session-token` cookie on cross-origin requests within the same registrable domain.

#### Scenario: Cross-origin request from book.rezics.com succeeds

- **WHEN** a `fetch` from `https://book.rezics.com` is issued to a notify endpoint with `credentials: 'include'`
- **THEN** notify echoes the origin in `Access-Control-Allow-Origin` and sets `Access-Control-Allow-Credentials: true`, the browser includes the cookie, and the request authenticates

#### Scenario: EventSource with withCredentials authenticates

- **WHEN** the frontend opens `new EventSource('https://notify.rezics.com/stream', { withCredentials: true })`
- **THEN** the browser sends the `rezics-session-token` cookie on the SSE handshake, notify verifies it, and the SSE connection is established

### Requirement: Internal secret verification

Internal write endpoints SHALL use `x-internal-secret` header verification against `NOTIFY_INTERNAL_SECRET` environment variable. This is separate from JWT verification and unchanged by this change.

#### Scenario: Internal endpoints use shared secret

- **WHEN** the server calls a notify internal endpoint
- **THEN** it authenticates via `x-internal-secret` header, not via JWT

## MODIFIED Requirements

### Requirement: Server issues rezics-session-token via exchange endpoint

The server SHALL expose `POST /auth/session/refresh` as the sole browser session refresh endpoint. The endpoint SHALL accept the auth session httpOnly cookie, validate it by calling auth internally, derive the actor `userId` from validated auth session state, look up the user's main record and current permission from the server database, and set a signed `rezics-session-token` httpOnly cookie. The endpoint SHALL NOT require, accept, or honor a browser-provided `x-auth-session-token` JWT or any header-based session JWT exchange. The legacy `POST /session/exchange` endpoint SHALL NOT exist.

#### Scenario: Successful token refresh

- **WHEN** a valid auth session cookie is presented to `POST /auth/session/refresh`
- **THEN** the server validates the session through auth, derives `userId`, queries the user's main record and permission, and sets `rezics-session-token` as an httpOnly cookie with status 200

#### Scenario: Invalid or expired auth session cookie

- **WHEN** an invalid, expired, or missing auth session cookie is presented to `POST /auth/session/refresh`
- **THEN** the server returns status 401 with an error message
- **AND** it SHALL NOT set or refresh `rezics-session-token`

#### Scenario: User not ready in server database

- **WHEN** a valid auth session cookie is presented but the corresponding main user has `slug === null` (profile setup not yet completed) or has been removed
- **THEN** the server returns an explicit non-success status indicating the user is not ready
- **AND** it SHALL NOT set `rezics-session-token`

#### Scenario: Header-based session JWT is rejected

- **WHEN** a request sends an `x-auth-session-token` header to any server endpoint
- **THEN** the server SHALL ignore the header
- **AND** the header SHALL NOT be listed in the server's CORS `allowedHeaders`

### Requirement: rezics-session-token claims schema

The `rezics-session-token` JWT SHALL contain the following claims: `sub` (actor `userId`), `userId` (explicit field equal to `sub`), `permission` (object of shape `{ role: TokenPermissionRole }`), `iss` ("rezics-server" or configured main issuer), `exp` (expiration timestamp), and `iat` (issued-at timestamp). The token SHALL NOT contain a top-level `role` claim — role is exclusively read from `permission.role`. The token SHALL NOT contain a `unitId` claim. The claims schema SHALL be defined in `@rezics/contract`.

#### Scenario: Token contains required claims

- **WHEN** the server issues a `rezics-session-token`
- **THEN** the token payload contains `sub`, `userId`, `permission` (with `role`), `iss`, `exp`, and `iat` fields with correct values matching the user's current database state
- **AND** `sub` SHALL equal `userId`
- **AND** there SHALL be no top-level `role` claim
- **AND** there SHALL be no `unitId` claim

### Requirement: Token role is a rejection-only hint

The `permission.role` claim in the `rezics-session-token` SHALL be used only for early rejection of requests that clearly lack permission. It SHALL NOT be used to grant elevated access. Any operation requiring admin, root, or non-blocked status for authorization purposes MUST verify the user's role against the server database. Only `userId` (via `sub`) is trusted as an actor identity assertion.

#### Scenario: Token role rejects non-admin on admin endpoint

- **WHEN** a request with `permission: { role: "MEMBER" }` in the token hits an admin-only endpoint
- **THEN** the endpoint rejects the request immediately without a database lookup (fast-path denial)

#### Scenario: Token role does not grant admin access

- **WHEN** a request with `permission: { role: "ADMIN" }` in the token hits an admin-only endpoint
- **THEN** the endpoint MUST query the database to verify the user's current role before granting access

#### Scenario: Blocked user on normal endpoint is not immediately rejected

- **WHEN** a request with `permission: { role: "BLOCKED" }` in the token hits a normal (non-privileged) endpoint
- **THEN** the request proceeds normally — the blocked status takes effect when the token expires and the cookie boundary refuses to refresh, or when a privileged endpoint verifies against the DB

### Requirement: Authorization: Bearer always carries rezics-session-token

Auxiliary services and non-browser API callers that use bearer authentication SHALL send `Authorization: Bearer <rezics-session-token>` for normal Rezics session authentication. Browser web flows SHALL rely on the `rezics-session-token` httpOnly cookie rather than localStorage bearer injection. Endpoints under the `/token` prefix and the `/dispatch` prefix SHALL continue to accept `Authorization: Bearer <api_token>` for API tokens with the `api_` prefix. Auth session credentials SHALL NEVER be sent through `Authorization` or `x-auth-session-token` for normal browser session exchange — the `auth-session-token` is no longer a JWT-in-header credential at any boundary.

#### Scenario: Server rejects auth session credential in Authorization header

- **WHEN** a request sends an `auth-session-token` JWT in `Authorization: Bearer` to a server API endpoint
- **THEN** verification fails and the server returns status 401

#### Scenario: Token-prefix endpoints accept API tokens

- **WHEN** a request sends `Authorization: Bearer api_xxx` to a `/token/*` or `/dispatch/*` endpoint
- **THEN** the endpoint authenticates via `tokenService.authenticateFromHeader()` using the API token

#### Scenario: Non-token endpoints reject API tokens

- **WHEN** a request sends `Authorization: Bearer api_xxx` to a regular API endpoint such as `/book/*`
- **THEN** the endpoint rejects the request because API tokens are not valid session JWTs

#### Scenario: Browser request uses cookie session

- **WHEN** browser frontend code calls a main API route after login
- **THEN** it SHALL rely on credentials-included cookie authentication or session hydration
- **AND** it SHALL NOT inject a localStorage `rezics-session-token` bearer header

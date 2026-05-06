## MODIFIED Requirements

### Requirement: Server issues rezics-session-token via exchange endpoint

The server SHALL expose `POST /auth/session/refresh` as the browser session refresh endpoint. The endpoint SHALL accept the auth session httpOnly cookie, validate it by calling auth internally, derive the actor `userId` from validated auth session state, look up or provision the user's main record and current role from the server database, and set a signed `rezics-session-token` httpOnly cookie. The endpoint SHALL NOT require or accept browser-provided `x-auth-session-token` JWT exchange for normal web flows.

#### Scenario: Successful token refresh

- **WHEN** a valid auth session cookie is presented to `POST /auth/session/refresh`
- **THEN** the server validates the session through auth, derives `userId`, queries or provisions the user's main record and role, and sets `rezics-session-token` as an httpOnly cookie with status 200

#### Scenario: Invalid or expired auth session cookie

- **WHEN** an invalid, expired, or missing auth session cookie is presented to `POST /auth/session/refresh`
- **THEN** the server returns status 401 with an error message
- **AND** it SHALL NOT set or refresh `rezics-session-token`

#### Scenario: User not ready in server database

- **WHEN** a valid auth session cookie is presented but the corresponding main user cannot be provisioned or is not ready
- **THEN** the server returns an explicit non-success status indicating the user is not ready
- **AND** it SHALL NOT return a browser-storable token body

### Requirement: rezics-session-token claims schema

The `rezics-session-token` JWT SHALL contain the following claims: `sub` (actor `userId`), `userId` (explicit duplicate for clarity during migration), `role` (one of MEMBER, ADMIN, ROOT, BLOCKED), `iss` ("rezics-server" or configured main issuer), `exp` (expiration timestamp), and `iat` (issued-at timestamp). The claims schema SHALL be defined in `@rezics/contract`. Only `userId` via `sub` SHALL be trusted as an actor identity assertion. `unitId` SHALL NOT be used as the authenticated actor subject.

#### Scenario: Token contains required claims

- **WHEN** the server issues a `rezics-session-token`
- **THEN** the token payload contains `sub`, `userId`, `role`, `iss`, `exp`, and `iat` fields with correct values matching the user's current database state
- **AND** `sub` SHALL equal `userId`

### Requirement: Authorization: Bearer always carries rezics-session-token

Auxiliary services and non-browser API callers that use bearer authentication SHALL send `Authorization: Bearer <rezics-session-token>` for normal Rezics session authentication. Browser web flows SHALL rely on the `rezics-session-token` httpOnly cookie rather than localStorage bearer injection. Endpoints under the `/token` prefix and the `/dispatch` prefix SHALL continue to accept `Authorization: Bearer <api_token>` for API tokens with the `api_` prefix. Auth session credentials SHALL NOT be sent through `Authorization` or `x-auth-session-token` for normal browser session exchange.

#### Scenario: Server rejects auth session credential in Authorization header

- **WHEN** a request sends an auth session credential in `Authorization: Bearer` to a server API endpoint
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

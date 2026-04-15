## ADDED Requirements

### Requirement: Server issues rezics-session-token via exchange endpoint

The server SHALL expose `POST /session/exchange` that accepts an `x-auth-session-token` header containing an auth-issued JWT. The endpoint SHALL verify the JWT against the auth service's JWKS, extract `unitId` from the `sub` claim, look up the user's current role from the server database, and return a signed `rezics-session-token` JWT.

#### Scenario: Successful token exchange

- **WHEN** a valid `auth-session-token` JWT is presented via the `x-auth-session-token` header to `POST /session/exchange`
- **THEN** the server verifies the JWT via auth JWKS, extracts `unitId`, queries the user's role from the database, and returns `{ token: "<rezics-session-token>" }` with status 200

#### Scenario: Invalid or expired auth-session-token

- **WHEN** an invalid, expired, or missing `x-auth-session-token` is presented to `POST /session/exchange`
- **THEN** the server returns status 401 with an error message

#### Scenario: User not found in server database

- **WHEN** a valid `auth-session-token` is presented but no user record exists for the extracted `unitId`
- **THEN** the server returns status 404 indicating the user is not provisioned

### Requirement: rezics-session-token claims schema

The `rezics-session-token` JWT SHALL contain the following claims: `sub` (unitId), `unitId` (explicit duplicate for clarity), `role` (one of MEMBER, ADMIN, ROOT, BLOCKED), `iss` ("rezics-server"), `exp` (expiration timestamp), `iat` (issued-at timestamp). The claims schema SHALL be defined in `@rezics/contract`. Only `unitId` (via `sub`) SHALL be trusted as an identity assertion. The `role` claim is a snapshot that MAY be stale and SHALL only be used for rejection, never for granting access.

#### Scenario: Token contains required claims

- **WHEN** the server issues a `rezics-session-token`
- **THEN** the token payload contains `sub`, `unitId`, `role`, `iss`, `exp`, and `iat` fields with correct values matching the user's current database state

### Requirement: Token role is a rejection-only hint

The `role` claim in the `rezics-session-token` SHALL be used only for early rejection of requests that clearly lack permission. It SHALL NOT be used to grant elevated access. Any operation requiring admin, root, or non-blocked status for authorization purposes MUST verify the user's role against the server database. The `unitId` claim is the only field trusted for identity.

#### Scenario: Token role rejects non-admin on admin endpoint

- **WHEN** a request with `role: "MEMBER"` in the token hits an admin-only endpoint
- **THEN** the endpoint rejects the request immediately without a database lookup (fast-path denial)

#### Scenario: Token role does not grant admin access

- **WHEN** a request with `role: "ADMIN"` in the token hits an admin-only endpoint
- **THEN** the endpoint MUST query the database to verify the user's current role before granting access

#### Scenario: Blocked user on normal endpoint is not immediately rejected

- **WHEN** a request with `role: "BLOCKED"` in the token hits a normal (non-privileged) endpoint
- **THEN** the request proceeds normally — the blocked status takes effect when the token expires and the user cannot obtain a new one with BLOCKED role (exchange endpoint rejects blocked users), or when a privileged endpoint verifies against the DB

### Requirement: rezics-session-token signing via server JWKS

The server SHALL sign `rezics-session-token` JWTs using its existing JWKS infrastructure (`package/server/src/session/jwt/`). The signing algorithm SHALL be ES256. The public keys SHALL be published at the server's `/.well-known/jwks.json` endpoint for verification by all services.

#### Scenario: Token is verifiable via published JWKS

- **WHEN** a `rezics-session-token` is issued by the server
- **THEN** any service can verify the token using the public keys from the server's `/.well-known/jwks.json` endpoint

### Requirement: rezics-session-token TTL is short-lived

The `rezics-session-token` SHALL have a configurable TTL, defaulting to 900 seconds (15 minutes). The TTL SHALL be significantly shorter than the `auth-session-token` TTL to bound role staleness.

#### Scenario: Token expires after TTL

- **WHEN** a `rezics-session-token` is issued
- **THEN** the token's `exp` claim is set to `iat + TTL` and verification fails after expiration

### Requirement: Authorization: Bearer always carries rezics-session-token

All API endpoints on the server (and auxiliary services) SHALL expect `Authorization: Bearer <rezics-session-token>`, with the following exception: endpoints under the `/token` prefix and the `/dispatch` prefix SHALL accept `Authorization: Bearer <api_token>` (API tokens with `api_` prefix). The `auth-session-token` SHALL NOT be sent via the `Authorization` header. The `auth-session-token` is transported exclusively via the `x-auth-session-token` header to the exchange endpoint.

#### Scenario: Server rejects auth-session-token in Authorization header

- **WHEN** a request sends an `auth-session-token` JWT in `Authorization: Bearer` to a server API endpoint
- **THEN** verification fails (issuer mismatch: "rezics-auth" vs expected "rezics-server") and the server returns status 401

#### Scenario: Token-prefix endpoints accept API tokens

- **WHEN** a request sends `Authorization: Bearer api_xxx` to a `/token/*` or `/dispatch/*` endpoint
- **THEN** the endpoint authenticates via `tokenService.authenticateFromHeader()` using the API token

#### Scenario: Non-token endpoints reject API tokens

- **WHEN** a request sends `Authorization: Bearer api_xxx` to a regular API endpoint (e.g., `/book/*`)
- **THEN** the endpoint rejects the request because API tokens are not valid session JWTs

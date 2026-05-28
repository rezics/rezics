# dispatch-token-session Specification

## Purpose

Defines the `POST /token/session` boundary that exchanges an API token
with the `dispatch` / `rezics-server-session` scope for a standard
`rezics-session-token` JWT. The exchanged token uses the same claim
schema and `MAIN_SESSION_JWT_TTL_SECONDS` as cookie-issued sessions, so
downstream services treat dispatch worker sessions identically to
user-cookie sessions.

## Requirements

### Requirement: API token can be exchanged for a session JWT

The server SHALL expose `POST /token/session` that accepts an API token via the `Authorization` header (either `Bearer api_xxx` or plain `api_xxx`). The endpoint SHALL authenticate the token using `tokenService.authenticateFromHeader()`, verify the token has the `dispatch` scope with `rezics-server-session` permission, look up the token owner's `userId` and current permission from the database, and return a signed `rezics-session-token` JWT.

#### Scenario: Successful token-to-session exchange

- **WHEN** a valid, non-revoked API token with `dispatch: ["rezics-server-session"]` scope is presented to `POST /token/session`
- **THEN** the server authenticates the token, looks up the owner's `userId` and permission, calls `signRezicsSessionToken({ userId, permission })`, and returns `{ token: "<rezics-session-token>" }` with status 200

#### Scenario: API token lacks dispatch session scope

- **WHEN** a valid API token without `dispatch: ["rezics-server-session"]` scope is presented to `POST /token/session`
- **THEN** the server returns status 403 indicating insufficient scope

#### Scenario: Invalid or revoked API token

- **WHEN** an invalid, expired, or revoked API token is presented to `POST /token/session`
- **THEN** the server returns status 401

#### Scenario: Token owner not found in database

- **WHEN** a valid API token is presented but the token owner's user record no longer exists
- **THEN** the server returns status 404

### Requirement: Session JWT issued via token exchange has standard claims

The `rezics-session-token` issued by `POST /token/session` SHALL have the same claims schema as tokens issued via the cookie boundary `POST /auth/session/refresh`: `{ sub, userId, permission: { role }, iss ("rezics-server"), exp, iat }`. There SHALL be no top-level `role` claim and no `unitId` claim. The TTL SHALL use the same `MAIN_SESSION_JWT_TTL_SECONDS` configuration (default 900s).

#### Scenario: Token claims match standard schema

- **WHEN** a session JWT is issued via `POST /token/session`
- **THEN** the token contains `sub` (userId), `userId`, `permission` (with current DB role), `iss` ("rezics-server"), and valid `exp`/`iat` timestamps

#### Scenario: Token TTL matches server configuration

- **WHEN** a session JWT is issued via `POST /token/session`
- **THEN** the token's `exp` is `iat + MAIN_SESSION_JWT_TTL_SECONDS` (default 900 seconds)

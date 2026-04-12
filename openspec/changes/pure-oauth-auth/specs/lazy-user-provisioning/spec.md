## MODIFIED Requirements

### Requirement: Auto-provision business user record on first authenticated access

When a valid JWT is presented to the server but no corresponding `User` record exists in the server database, the server SHALL automatically create a minimal business `User` record using claims from the JWT payload. Provisioning SHALL be triggered by any endpoint using the `requireOwner` macro, not limited to `GET /users/me`. The provisioning data SHALL come from the access token claims (`sub`/`unitId`, `slug`, `name`), not from an AUTH_CONTEXT token.

#### Scenario: First access with valid JWT and no existing user

- **GIVEN** a user who has signed up via `package/auth` and received a valid JWT containing `sub: "abc-123"`, `slug: "alice"`, and `name: "Alice"`
- **AND** no `User` record with `unitId = "abc-123"` exists in the server database
- **WHEN** the user calls any endpoint with `requireOwner: true`
- **THEN** the server SHALL create a new `User` record with:
  - `unitId` = JWT's `sub` claim (or `unitId`)
  - `slug` = JWT's `slug` claim
  - `name` = JWT's `name` claim
  - `type` = `USER` (default)
  - `joinDate` = current timestamp
- **AND** the request SHALL proceed normally with the newly created user

#### Scenario: Subsequent access with existing user

- **GIVEN** a user with `unitId = "abc-123"` already exists in the server database
- **WHEN** the user calls any endpoint with a valid JWT containing `sub: "abc-123"`
- **THEN** the server SHALL return the existing user from the cache without creating a new record

#### Scenario: Provisioning with minimal claims

- **GIVEN** a valid JWT that contains `sub` and `scope: "user"` but no `slug` or `name` claims
- **AND** no `User` record exists for the `sub`
- **WHEN** the user calls any endpoint with `requireOwner: true`
- **THEN** the server SHALL create a new `User` record using `sub` as both `unitId` and a fallback for `slug`/`name`

### Requirement: Lazy provisioning is idempotent

Concurrent or repeated requests with the same JWT SHALL NOT create duplicate `User` records. The provisioning operation SHALL use a Prisma `upsert` to guarantee idempotency.

#### Scenario: Concurrent provisioning requests

- **GIVEN** a new auth user with no server `User` record
- **WHEN** two simultaneous requests arrive with the same JWT to endpoints with `requireOwner: true`
- **THEN** exactly one `User` record SHALL be created
- **AND** both requests SHALL proceed with the same user record

### Requirement: Lazy provisioning applies to all owner-level endpoints

Any endpoint using the `requireOwner`, `requireAdmin`, or `requireRoot` macro SHALL trigger lazy provisioning if the user record does not exist. The `/users/ensure` explicit provisioning endpoint SHALL be removed.

#### Scenario: Any requireOwner endpoint provisions the user

- **GIVEN** a valid JWT with `sub = "new-user-id"` and no existing user record
- **WHEN** a client calls `GET /units` with `requireOwner: true`
- **THEN** the server SHALL provision the user before executing the handler
- **AND** the handler SHALL receive a valid `currentUser`

#### Scenario: Login-only endpoints do not provision

- **GIVEN** a valid JWT with `sub = "new-user-id"` and no existing user record
- **WHEN** a client calls an endpoint with only `requireLogin: true` (not `requireOwner`)
- **THEN** the server SHALL NOT attempt to provision a user record

## REMOVED Requirements

### Requirement: Lazy provisioning does not apply to all endpoints

**Reason:** The original spec limited lazy provisioning to `GET /users/me`. With the removal of the explicit `/users/ensure` endpoint, provisioning SHALL be triggered by any `requireOwner` endpoint to ensure the user always has a record when owner-level operations are attempted.

**Migration:** Remove `/users/ensure` endpoint from `user.core.api.ts`. The lazy provisioning logic moves into the `requireOwner` macro resolver in `permission.ts`.

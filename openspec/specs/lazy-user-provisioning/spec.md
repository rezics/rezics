# lazy-user-provisioning Specification

## Purpose
TBD - created by archiving change decouple-user-domain-from-auth. Update Purpose after archive.
## Requirements
### Requirement: Auto-provision business user record on first authenticated access

When a valid JWT is presented to the server but no corresponding `User` record exists in the server database, the server SHALL automatically create a minimal business `User` record using claims from the JWT payload.

#### Scenario: First access with valid JWT and no existing user

- GIVEN a user who has signed up via `package/auth` and received a valid JWT containing `unitId: "abc-123"` and `slug: "alice"`
- AND no `User` record with `unitId = "abc-123"` exists in the server database
- WHEN the user calls `GET /users/me` with the JWT
- THEN the server SHALL create a new `User` record with:
  - `unitId` = JWT's `unitId` claim (or `sub`)
  - `slug` = JWT's `slug` claim
  - `name` = JWT's `slug` claim (default)
  - `type` = `USER` (default)
  - `joinDate` = current timestamp
- AND the server SHALL return the newly created `UserDTO` with status `200`

#### Scenario: Subsequent access with existing user

- GIVEN a user with `unitId = "abc-123"` already exists in the server database
- WHEN the user calls `GET /users/me` with a valid JWT containing `unitId: "abc-123"`
- THEN the server SHALL return the existing `UserDTO` without creating a new record

#### Scenario: Provisioning with minimal claims

- GIVEN a valid JWT that contains `unitId` and `scope: "user"` but no `slug` claim
- AND no `User` record exists for the `unitId`
- WHEN the user calls `GET /users/me`
- THEN the server SHALL create a new `User` record using `unitId` as both `unitId` and a fallback for `slug`/`name`
- AND the response SHOULD indicate the profile is incomplete so the frontend can prompt for profile completion

### Requirement: Lazy provisioning is idempotent

Concurrent or repeated calls to `GET /users/me` with the same JWT SHALL NOT create duplicate `User` records.

#### Scenario: Concurrent provisioning requests

- GIVEN a new auth user with no server `User` record
- WHEN two simultaneous `GET /users/me` requests arrive with the same JWT
- THEN exactly one `User` record SHALL be created
- AND both requests SHALL return the same `UserDTO`

### Requirement: Lazy provisioning does not apply to all endpoints

Only the `GET /users/me` endpoint SHALL trigger lazy provisioning. Other authenticated endpoints that reference a user by `unitId` SHALL return `404` if the user record does not exist.

#### Scenario: Non-provisioning endpoint for unknown user

- GIVEN a valid JWT with `unitId = "new-user-id"`
- AND no `User` record exists in the server database
- WHEN a client calls `PUT /users/me` to update the profile
- THEN the server SHALL first trigger provisioning (creating the record), then apply the update
- BUT when a client calls `GET /users/{unitId}` for a different non-existent user
- THEN the server SHALL return `404 Not Found`


## MODIFIED Requirements

### Requirement: Auto-provision business user record on first authenticated access

When a valid `auth_identity_token` is presented to the main server and the server has confirmed the caller's current status through the auth-owned session-state API, the server SHALL use `GET /users/ensure` as the provisioning endpoint for creating or loading the business `User` record.

#### Scenario: First verified ensure request creates the business user

- GIVEN a user who has signed up via `package/auth`, completed the required verification flow, and received a valid `auth_identity_token` containing `unitId: "abc-123"` and `slug: "alice"`
- AND no `User` record with `unitId = "abc-123"` exists in the server database
- WHEN the user calls `GET /users/ensure` with `Authorization: Bearer <auth_identity_token>`
- THEN the server SHALL verify the auth token before any provisioning logic runs
- AND the server SHALL request the auth-owned session-state surface needed to confirm the user is still verified and logged in
- AND the server SHALL create a new `User` record with:
  - `unitId` = the auth token `unitId` claim (or `sub`)
  - `slug` = the auth token `slug` claim
  - `name` = the auth token `slug` claim by default
  - `type` = `USER` by default
  - `joinDate` = the current timestamp
- AND the server SHALL return the newly created `UserDTO` with status `200`

#### Scenario: Subsequent ensure request returns the existing user

- GIVEN a verified auth user with `unitId = "abc-123"` already stored in the server database
- WHEN the user calls `GET /users/ensure` with a valid `auth_identity_token` containing `unitId: "abc-123"`
- THEN the server SHALL re-check auth-owned session state before returning the existing `UserDTO`
- AND it SHALL NOT create a duplicate user record

#### Scenario: Ensure uses minimal verified claims when slug is missing

- GIVEN a verified `auth_identity_token` that contains `unitId` and `scope: "user"` but no `slug` claim
- AND no `User` record exists for that `unitId`
- WHEN the user calls `GET /users/ensure`
- THEN the server SHALL create a new `User` record using `unitId` as the fallback value for `slug` and `name`
- AND the response SHALL remain a valid `UserDTO`

### Requirement: Lazy provisioning does not apply to all endpoints

Only `GET /users/ensure` SHALL trigger lazy provisioning. Other authenticated endpoints that reference a server `User` record SHALL treat missing business users as absent data rather than provisioning implicitly.

#### Scenario: Business read endpoint does not provision unknown user

- GIVEN a valid `auth_identity_token` for `unitId = "new-user-id"`
- AND no `User` record exists in the server database
- WHEN a client calls `GET /users/me` before `GET /users/ensure` has provisioned that user
- THEN the server SHALL NOT create a new `User` record as a side effect of `GET /users/me`
- AND the server SHALL respond according to the explicit endpoint contract for a missing ensured user

#### Scenario: Unverified ensure request is rejected before provisioning

- GIVEN an auth-session user whose email verification or readiness flow is not yet complete
- AND no matching `User` record exists in the server database
- WHEN the client calls `GET /users/ensure` with that user's `auth_identity_token`
- THEN the server SHALL reject the request before creating a business user
- AND it SHALL NOT mint a main-server session token for that user

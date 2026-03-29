## MODIFIED Requirements

### Requirement: requireLogin guard plugin

The server SHALL provide a `requireLogin` scoped Elysia guard plugin in `package/server/src/auth/auth.permission.ts`. It SHALL verify that `authIdentityToken` is present (non-null) in context. It SHALL resolve an `identity` object with a normalized `unitId` field.

#### Scenario: Authenticated request passes

- **WHEN** a request has a valid `authIdentityToken` with `unitId` or `sub` claim
- **THEN** the guard resolves `{ identity: { ...payload, unitId } }` and the route handler executes

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request has `authIdentityToken: null` (no Authorization header)
- **THEN** the guard throws and the response status is 401

#### Scenario: unitId falls back to sub

- **WHEN** `authIdentityToken.unitId` is undefined but `authIdentityToken.sub` is present
- **THEN** the resolved `identity.unitId` equals `authIdentityToken.sub`

## ADDED Requirements

### Requirement: Session token issuance verifies auth eligibility

`POST /session/token` SHALL verify that the requesting user's auth session is eligible for member access before issuing a REZICS_SESSION token. It SHALL call the auth service's `get-session-state` endpoint and use `assertMainServerEligibility()` to check `canAcquireMemberToken`.

#### Scenario: Eligible user receives session token

- **WHEN** a user with a valid AUTH_IDENTITY and `canAcquireMemberToken = true` requests `POST /session/token`
- **THEN** the server SHALL issue a REZICS_SESSION token

#### Scenario: Unverified user is rejected

- **WHEN** a user with a valid AUTH_IDENTITY but `canAcquireMemberToken = false` (e.g., email not verified) requests `POST /session/token`
- **THEN** the server SHALL return a 403 response
- **AND** the response SHALL indicate that the auth session is not eligible for member access

#### Scenario: Missing auth session state is rejected

- **WHEN** the auth service returns no session or no user for the given AUTH_IDENTITY
- **THEN** the server SHALL return a 401 response

#### Scenario: Auth service unavailable returns server error

- **WHEN** the server cannot reach the auth service's `get-session-state` endpoint
- **THEN** the server SHALL return a 503 response
- **AND** it SHALL NOT issue a session token

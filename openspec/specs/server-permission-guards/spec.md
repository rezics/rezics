## Requirements

### Requirement: requireLogin guard plugin

The server SHALL provide `requireLogin` as an Elysia macro (not a standalone plugin) within the auth macro plugin at `package/server/src/middleware/permission.ts`. It SHALL verify that `authIdentityToken` is present (non-null) in context. It SHALL resolve an `identity` object with a normalized `unitId` field. It SHALL use `return status(401, msg)` for error responses.

#### Scenario: Authenticated request passes

- **WHEN** a request has a valid `authIdentityToken` with `unitId` or `sub` claim
- **THEN** the macro resolves `{ identity: { ...payload, unitId } }` and the route handler executes

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request has `authIdentityToken: null` (no Authorization header)
- **THEN** the macro returns `status(401)` with an appropriate message

#### Scenario: unitId falls back to sub

- **WHEN** `authIdentityToken.unitId` is undefined but `authIdentityToken.sub` is present
- **THEN** the resolved `identity.unitId` equals `authIdentityToken.sub`

### Requirement: Route files use macro flags instead of global plugin guards

Route files SHALL use per-route macro flags (`requireLogin: true`, `requireOwner: true`, `requireAdmin: true`) in route options instead of `.use(requireLogin)`, `.use(requireOwner)`, or `.use(requireAdmin)` at the instance level. Route files SHALL `.use(authMacro)` once to make macros available.

#### Scenario: Public read routes have no auth overhead

- **WHEN** a route serves public data (e.g., `GET /books/:unitId`, `GET /chapters/:unitId`)
- **THEN** the route SHALL NOT have any `requireLogin`, `requireOwner`, or `requireAdmin` flag
- **AND** the request SHALL NOT trigger identity or session verification

#### Scenario: Write routes use per-route macro flags

- **WHEN** a route modifies data (e.g., `POST /books/`, `PUT /books/:unitId`)
- **THEN** the route SHALL specify the appropriate macro flag in its route options

#### Scenario: Admin-only list queries use requireAdmin

- **WHEN** a route lists all records with performance impact (e.g., `GET /books/`, `GET /chapters/`)
- **THEN** the route SHALL specify `requireAdmin: true` in its route options

### Requirement: Admin route handlers do not duplicate guard checks

Route handlers guarded by `requireAdmin` SHALL NOT re-check admin role or `BasicAdminPermission` in the handler body. The macro guarantees these checks have passed before the handler executes.

#### Scenario: user.admin.api.ts handlers have no redundant checks

- **WHEN** a handler in `user.admin.api.ts` is guarded by `requireAdmin: true`
- **THEN** the handler body SHALL NOT contain checks for `session.permission.role` or `BasicAdminPermission`

#### Scenario: jwt.admin.api.ts handlers have no requireAdminSession calls

- **WHEN** a handler in `jwt.admin.api.ts` is guarded by `requireAdmin: true`
- **THEN** the handler body SHALL NOT call `requireAdminSession()`

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

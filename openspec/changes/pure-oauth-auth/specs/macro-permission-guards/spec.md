## MODIFIED Requirements

### Requirement: requireOwner macro

The `requireOwner` macro SHALL accept a boolean. When `true`, it SHALL compose on `requireLogin` (implying `requireLogin: true`). It SHALL look up the user from the server user cache (or database on cache miss), verify the user is not blocked, and resolve `{ identity, currentUser }`. It SHALL NOT require or verify a `rezicsSessionToken`.

#### Scenario: Valid identity resolves owner context

- **WHEN** a route has `requireOwner: true` and the request has a valid `authIdentityToken` with a known `unitId`
- **THEN** the macro SHALL look up the user via the user cache
- **AND** resolve `{ identity, currentUser }` and the handler executes

#### Scenario: Valid identity with unknown unitId triggers lazy provisioning

- **WHEN** a route has `requireOwner: true` and the request has a valid `authIdentityToken` with an unknown `unitId`
- **THEN** the macro SHALL trigger lazy provisioning from token claims
- **AND** resolve `{ identity, currentUser }` with the newly created user

#### Scenario: Blocked user returns 403

- **WHEN** the cached or persisted user has the `BLOCKED` role
- **THEN** the macro returns `status(403, 'Forbidden: User is blocked')`

#### Scenario: Unverified user on verification-required endpoint returns 403

- **WHEN** the access token contains `email_verified: false` and the endpoint requires verification
- **THEN** the macro returns `status(403, 'Forbidden: Email verification required')`

### Requirement: requireAdmin macro

The `requireAdmin` macro SHALL accept a boolean. When `true`, it SHALL compose on `requireOwner` (implying `requireOwner: true` which implies `requireLogin: true`). It SHALL verify that the persisted user has `ROOT` or `ADMIN` role and that `BasicAdminPermission(currentUser)` returns `true`. Role is checked from the cached user record, not from a session token.

#### Scenario: Admin user passes

- **WHEN** a route has `requireAdmin: true` and the cached user has `ADMIN` role and passes `BasicAdminPermission`
- **THEN** the macro resolves `{ identity, currentUser }` and the handler executes

#### Scenario: Non-admin user returns 403

- **WHEN** a route has `requireAdmin: true` and the cached user has `USER` role
- **THEN** the macro returns `status(403, 'Forbidden: Admin role required')`
- **AND** the handler does NOT execute

#### Scenario: Admin role present but BasicAdminPermission fails returns 403

- **WHEN** a route has `requireAdmin: true` and the cached user has `ADMIN` role but `BasicAdminPermission(currentUser)` returns false
- **THEN** the macro returns `status(403, 'Forbidden: Persisted admin permission required')`

## REMOVED Requirements

### Requirement: requireOwner macro (original — session token based)

**Reason:** The original `requireOwner` required both `authIdentityToken` and `rezicsSessionToken`, matched their `unitId` claims, and verified the session token's role snapshot against the database. The REZICS_SESSION token is eliminated. Role verification now uses the cached database record directly.

**Migration:** Remove all references to `rezicsSessionToken` from the macro. Remove the `session` property from the resolved context. Routes that accessed `session.permission.role` SHALL use `currentUser.permission.role` instead.

### Requirement: requireAdmin macro (original — session token based)

**Reason:** The original `requireAdmin` checked `session.permission.role` from the REZICS_SESSION token. It now checks the cached user's persisted role directly.

**Migration:** Replace `session.permission.role` checks with `currentUser.permission.role` checks. Remove `session` from the resolved context type.

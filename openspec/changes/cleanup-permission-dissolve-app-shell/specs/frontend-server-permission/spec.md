## ADDED Requirements

### Requirement: useServerPermission hook exposes server permission

`@rezics/api` SHALL export a `useServerPermission()` hook that returns `Permission | null`. The hook SHALL derive its value from the `rezics-session-token`'s `permission` claim. It SHALL return `null` when no valid session token exists (unauthenticated state).

#### Scenario: Authenticated user gets permission

- **WHEN** a user has a valid `rezics-session-token` with `permission: { role: "ADMIN" }`
- **THEN** `useServerPermission()` returns `{ role: "ADMIN" }`

#### Scenario: Unauthenticated user gets null

- **WHEN** no valid `rezics-session-token` exists
- **THEN** `useServerPermission()` returns `null`

### Requirement: useServerPermission has JSDoc documenting server boundary

The `useServerPermission()` hook SHALL include JSDoc that states:
1. The return value represents the main server's permission model
2. It is derived from `rezics-session-token` claims
3. It is unrelated to `auth-identity-token` except during the session exchange flow

#### Scenario: Developer reads hook documentation

- **WHEN** a developer inspects `useServerPermission()` in their IDE
- **THEN** the JSDoc clearly indicates this is the main server's permission, not the auth service's role

### Requirement: capabilityLevel is removed

The `capabilityLevel` field SHALL be removed from `authSessionStore`. Consumers that previously checked `capabilityLevel === "member"` SHALL use `useServerPermission() !== null` instead.

#### Scenario: Authenticated check without capabilityLevel

- **WHEN** a component needs to check if the user is authenticated with the main server
- **THEN** it uses `useServerPermission() !== null` instead of `capabilityLevel === "member"`

### Requirement: useServerRole is removed

The `useServerRole()` hook in `realm/model/` SHALL be removed. All consumers SHALL use `useServerPermission()` from `@rezics/api` instead, accessing `.role` from the returned `Permission` object.

#### Scenario: Realm page uses useServerPermission

- **WHEN** a realm page needs the user's global server role
- **THEN** it calls `useServerPermission()?.role` instead of `useServerRole()`

### Requirement: authSessionStore exposes permission field

`authSessionStore` SHALL expose a `permission: Permission | null` field derived from the `rezics-session-token`'s `permission` claim. This replaces both `capabilityLevel` and the need to re-parse the JWT in consumer hooks.

#### Scenario: Store hydrates permission from token

- **WHEN** `authSessionStore` hydrates from a valid `rezics-session-token`
- **THEN** the store's `permission` field contains the token's `permission` claim (e.g., `{ role: "MEMBER" }`)

#### Scenario: Store clears permission on logout

- **WHEN** the session token is removed (logout or expiry)
- **THEN** the store's `permission` field is `null`

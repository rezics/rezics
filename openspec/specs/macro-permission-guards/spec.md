## Requirements

### Requirement: Auth macro plugin

The server SHALL provide an Elysia plugin in `package/server/src/middleware/permission.ts` that defines `requireLogin`, `requireOwner`, and `requireAdmin` as Elysia macros using `.macro()`. The plugin SHALL be named `'macro/auth'`. All macro resolvers SHALL use `return status()` from Elysia for error responses instead of `set.status` + `throw Error`.

#### Scenario: Plugin is usable via .use()

- **WHEN** a route file calls `.use(authMacro)`
- **THEN** the macros `requireLogin`, `requireOwner`, and `requireAdmin` SHALL be available as route-level options

### Requirement: requireLogin macro

The `requireLogin` macro SHALL accept a boolean. When `true`, it SHALL resolve `identity` from the globally-available `authIdentityToken` context property. It SHALL return `status(401)` if `authIdentityToken` is null, with a message distinguishing between missing header and invalid/expired token. It SHALL return `status(401)` if neither `unitId` nor `sub` claim is present.

#### Scenario: Valid identity token resolves identity

- **WHEN** a route has `requireLogin: true` and the request has a valid `authIdentityToken` with `unitId` claim
- **THEN** the macro resolves `{ identity: { ...authIdentityToken, unitId } }` and the handler executes

#### Scenario: Missing authorization header returns 401

- **WHEN** a route has `requireLogin: true` and no `Authorization` header is present
- **THEN** the macro returns `status(401, 'Unauthorized: No authorization header provided')`
- **AND** the handler does NOT execute

#### Scenario: Invalid or expired token returns 401

- **WHEN** a route has `requireLogin: true` and the `Authorization` header is present but `authIdentityToken` is null (verification failed)
- **THEN** the macro returns `status(401, 'Unauthorized: Identity token is invalid or expired')`

#### Scenario: unitId falls back to sub claim

- **WHEN** `authIdentityToken.unitId` is undefined but `authIdentityToken.sub` is present
- **THEN** the resolved `identity.unitId` SHALL equal `authIdentityToken.sub`

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

### Requirement: tokenContext type-cast hack removed

The `tokenContext` Elysia plugin (the `derive()` that casts `ctx as unknown as {…}`) SHALL be removed. Macros SHALL access `authIdentityToken` directly from the context provided by the global token resolvers in `index.ts`.

#### Scenario: No tokenContext derive in the middleware

- **WHEN** the permission middleware is loaded
- **THEN** there SHALL be no `derive()` call that performs a type cast to provide `authIdentityToken` or `rezicsSessionToken`

### Requirement: requireAdminSession function removed

The standalone `requireAdminSession()` function SHALL be removed from `permission.ts`. The `requireAdmin` macro SHALL be the single source of truth for admin permission gating.

#### Scenario: No requireAdminSession export

- **WHEN** consuming code imports from `@/middleware`
- **THEN** `requireAdminSession` SHALL NOT be available as an export

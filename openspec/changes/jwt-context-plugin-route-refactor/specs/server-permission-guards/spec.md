## ADDED Requirements

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

### Requirement: requireAdmin guard plugin
The server SHALL provide a `requireAdmin` scoped Elysia guard plugin. It SHALL chain on `requireLogin` and additionally require `rezicsSessionToken` to be present. It SHALL validate that the session role snapshot matches persisted user roles, load the persisted user from the database, and verify admin permission.

#### Scenario: Admin user with valid session passes
- **WHEN** a request has valid `authIdentityToken` and `rezicsSessionToken`, the session `unitId` matches identity `unitId`, and the user has admin permission in both snapshot and persisted roles
- **THEN** the guard resolves `{ identity, session, currentUser }` and the route handler executes

#### Scenario: Non-admin user is rejected
- **WHEN** a request has valid tokens but the user lacks admin permission
- **THEN** the guard throws and the response status is 403

#### Scenario: Session and identity unitId mismatch
- **WHEN** `rezicsSessionToken.unitId` does not match `identity.unitId`
- **THEN** the guard throws and the response status is 401

#### Scenario: Missing session token
- **WHEN** `rezicsSessionToken` is null
- **THEN** the guard throws and the response status is 401

#### Scenario: Blocked user is rejected
- **WHEN** the user's persisted roles include `BLOCKED`
- **THEN** the guard throws and the response status is 403

### Requirement: requireOwner guard plugin
The server SHALL provide a `requireOwner` scoped Elysia guard plugin. It SHALL chain on `requireLogin` and require `rezicsSessionToken` to be present. It SHALL validate session-identity `unitId` match, load the persisted user, and verify role snapshot consistency. It SHALL NOT require admin-level permissions.

#### Scenario: Authenticated user with valid session passes
- **WHEN** a request has valid `authIdentityToken` and `rezicsSessionToken` with matching `unitId`, and the session role snapshot matches persisted roles
- **THEN** the guard resolves `{ identity, session, currentUser }` and the route handler executes

#### Scenario: Role snapshot mismatch is rejected
- **WHEN** the session token's role snapshot does not match the user's persisted roles
- **THEN** the guard throws and the response status is 403

### Requirement: Domain-specific permission extensions
Domains with custom permission logic SHALL create a `{domain}.permission.ts` file containing scoped Elysia guard plugins. These domain permission plugins SHALL build on the base guards (`requireLogin`, `requireAdmin`, `requireOwner`).

#### Scenario: Book domain permission guard
- **WHEN** the book domain needs to check book ownership for update/delete operations
- **THEN** a `book.permission.ts` file provides a scoped guard that chains on `requireOwner` and adds book-specific ownership validation

### Requirement: Guard scoping behavior
All permission guard plugins SHALL use `as: 'scoped'` so they apply to routes defined after the `.use(guard)` call in the Elysia chain, but do not leak to sibling or parent route groups.

#### Scenario: Guard applies to subsequent routes only
- **WHEN** `.use(requireLogin)` is called between two groups of route definitions
- **THEN** routes defined before the `.use()` remain public, and routes defined after require authentication

### Requirement: Guards consume global token context
Permission guard plugins SHALL read token payloads from the globally-injected context keys (`authIdentityToken`, `rezicsSessionToken`). They SHALL NOT perform their own JWT parsing or header reading.

#### Scenario: Guard reads from token resolver context
- **WHEN** `requireLogin` executes
- **THEN** it reads `authIdentityToken` from context (injected by the root-level token resolver), not from `headers.authorization`

## Why

The `@rezics/app-shell` package conflates unrelated concerns (theme, auth, global state, provider composition) into a single shared package, causing lint errors and tight coupling between apps. Separately, the permission model conflates the auth service's identity role with the main server's permission system — `AuthIdentity` is used across permission helpers when all main-server communication should be based on `RezicsSessionClaims`. The session token carries a `role` field instead of a `permission` object, making it structurally ambiguous which system a role belongs to. These two problems compound: the frontend's `authSessionStore` in app-shell invents concepts like `capabilityLevel` that paper over the auth/server confusion rather than exposing the server's native permission model.

## What Changes

### Permission model cleanup

- **BREAKING**: Rename `role` to `permission` in `rezicsSessionClaimsSchema` — the session token now carries `permission: { role: TokenPermissionRole }` instead of `role: string`
- **BREAKING**: Delete `AuthIdentity` type from `@rezics/contract`. All permission helpers accept the server's `Permission` type (`{ role: TokenPermissionRole }`) directly
- Update all permission helper signatures (`isAdmin`, `isRoot`, `BasicAdminPermission`, `isBlocked`, `verifyRoot`, `verifyAdmin`, `verifyBlocked`, and all resource-specific helpers in `book.ts`, `chapter.ts`, `post.ts`, `shelf.ts`, `tag.ts`, `unit.ts`, `user.ts`) to accept `Permission` for permission checks and `unitId` as a separate parameter where ownership checks are needed
- Define a `permissionSchema` in `@rezics/contract` as the canonical shape of the server's permission model (currently `{ role: TokenPermissionRole }`)
- Update server session exchange to read `User.permission` from DB and write it into the JWT `permission` field — the auth-identity-token's `role` is never read during exchange
- Update all server middleware to read `identity.permission.role` instead of `identity.role`

### Dissolve `@rezics/app-shell`

- Move theme system (`getTheme`, `getDynamicTheme`, dynamic color utilities, `PRESET_COLORS`, UnoCSS config) into `@rezics/ui`
- Move auth provider, token refresh logic, and auth session store into `@rezics/api`
- Replace `capabilityLevel` and `useServerRole()` (currently in `realm/model/`) with `useServerPermission()` in `@rezics/api`, backed by the session token's `permission` field. JSDoc documents that this represents the main server's permission and is unrelated to `auth-identity-token` except during the exchange flow
- Move `AppShell` provider composition, `appStore`, and `alertStore` into each app locally (`@rezics/app`, `@rezics/admin`)
- Delete `@rezics/app-shell` package

## Capabilities

### New Capabilities
- `server-permission-model`: Define the canonical `Permission` type and `permissionSchema` in `@rezics/contract`, update session token claims, update all permission helpers to use it instead of `AuthIdentity`
- `frontend-server-permission`: Replace `capabilityLevel`/`useServerRole` with `useServerPermission()` hook in `@rezics/api` that exposes the server's native permission model
- `dissolve-app-shell`: Redistribute app-shell contents into `@rezics/ui` (theme), `@rezics/api` (auth state), and per-app local code (shell composition)

### Modified Capabilities
- `server-permission-guards`: Server middleware must read `identity.permission.role` instead of `identity.role`
- `auth-token-lifecycle-provider`: Token refresh logic moves from `@rezics/app-shell` to `@rezics/api`

## Impact

- **`@rezics/contract`**: Breaking change to `RezicsSessionClaims`, `AuthIdentity` deleted, all `permission/*.ts` helpers updated
- **`@rezics/server`**: Session exchange writes `permission` field, all middleware/guards updated to new claim shape
- **`@rezics/api`**: Gains auth provider, token refresh, auth session store, and `useServerPermission()` hook
- **`@rezics/ui`**: Gains theme system and UnoCSS config factory
- **`@rezics/app`**: Removes `@rezics/app-shell` dependency, owns its own shell composition, replaces `capabilityLevel`/`useServerRole` with `useServerPermission()`
- **`@rezics/admin`**: Same as app — local shell, new permission hook
- **`@rezics/app-shell`**: Deleted entirely
- **Backward compatibility**: This is a breaking change to the session token format. All active sessions will be invalidated on deploy. No migration path needed — users re-authenticate and receive the new token shape.

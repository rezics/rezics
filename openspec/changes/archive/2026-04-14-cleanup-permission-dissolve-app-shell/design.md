## Context

The codebase currently conflates two independent identity systems:

1. **Auth service** — issues `auth-identity-token` with its own `role` field (auth-level classification). Managed by `better-auth`.
2. **Main server** — issues `rezics-session-token` with a `role` field that actually represents the server's permission model, read from `User.permission` in PostgreSQL.

The session token's `role: string` claim is structurally indistinguishable from the auth token's `role` field. The `AuthIdentity` type (`{ unitId, role }`) is used across all permission helpers, further blurring the boundary. On the frontend, `authSessionStore` in `@rezics/app-shell` derives a `capabilityLevel` abstraction instead of exposing the server's native permission model.

Meanwhile, `@rezics/app-shell` bundles theme, auth state, provider composition, and global stores into a single package — creating tight coupling and accumulated lint debt.

### Current token flow

```
auth-identity-token.role  ──(ignored)──┐
                                       │  POST /session/exchange
auth-identity-token.unitId ────────────┤
                                       │  Server reads User.permission
                                       │  from DB, takes role[0] ?? "MEMBER"
                                       ▼
                              rezics-session-token.role = "ADMIN"
```

### Current permission helper pattern

```ts
type AuthIdentity = { unitId: string; role: string };
function isAdmin(actor: AuthIdentity) { return actor.role === "ADMIN"; }
function hasPermissionToUpdateBook(actor: AuthIdentity, book?, unit?) { ... }
```

## Goals / Non-Goals

**Goals:**

- Make the session token structurally unambiguous: `permission: { role }` instead of `role`
- Delete `AuthIdentity` — permission helpers accept the server's `Permission` type; ownership checks take `unitId` separately
- Define `Permission` and `permissionSchema` as the canonical representation of the server's permission model in `@rezics/contract`
- Ensure the exchange flow never reads `auth-identity-token.role` — it only uses `unitId` to look up the server's own `User.permission`
- Move theme into `@rezics/ui`, auth state into `@rezics/api`, shell composition into each app
- Replace `capabilityLevel` and `useServerRole()` with `useServerPermission()` backed by the token's `permission` field
- Delete `@rezics/app-shell`

**Non-Goals:**

- Changing the auth service's role system or token format
- Modifying realm membership roles (these are per-realm, not global permission)
- Adding new permission keys beyond `role` (the schema supports future extension, but this change only migrates the existing `role`)
- Refactoring the token refresh logic itself — it moves packages but behavior is unchanged

## Decisions

### 1. Session token carries `permission` object, not `role` string

**Choice:** `rezicsSessionClaimsSchema` changes from `{ role: string }` to `{ permission: permissionSchema }` where `permissionSchema = { role: TokenPermissionRole }`.

**Why not just rename `role`?** The `permission` object mirrors the DB's `User.permission` JSON shape. When the server adds more permission keys in the future (e.g., `scopes`, `flags`), they slot into the same object. A flat `role` field would require another breaking token change later.

**Alternative considered:** Keep `role` but rename it to `permissionRole` — rejected because it doesn't match the DB model and doesn't support future extension.

### 2. `Permission` type replaces `AuthIdentity`

**Choice:** Define `Permission = { role: TokenPermissionRole }` in `@rezics/contract/src/permission/core.ts`. All pure permission helpers (`isAdmin`, `isRoot`, `isBlocked`, `BasicAdminPermission`) accept `Permission`. Resource-specific helpers that need ownership checks accept `permission: Permission` and `actorUnitId: string` as separate parameters.

**Why separate `unitId`?** `unitId` is an identity concern, not a permission concern. Bundling them into one type is what created the `AuthIdentity` confusion. Permission checks answer "what can this permission level do?" — ownership checks answer "does this identity own this resource?" These are orthogonal.

**Alternative considered:** Accept full `RezicsSessionClaims` in permission helpers — rejected because it couples permission logic to the token transport format. A permission check shouldn't need `iss`, `exp`, `iat`.

### 3. Exchange flow reads only `unitId` from auth-identity-token

**Choice:** The `POST /session/exchange` handler extracts `unitId` from the auth-identity-token, queries `User.permission` from the server DB, and writes it into the session token's `permission` field. The auth-identity-token's `role` field is never read.

**Why explicit about this?** The current code happens to ignore `auth-identity-token.role` during exchange, but this isn't documented or enforced. Making it a design constraint prevents future accidental coupling.

### 4. Theme moves to `@rezics/ui`, auth state moves to `@rezics/api`

**Choice:**
- `@rezics/ui` gains: `getTheme`, `getDynamicTheme`, `generateDynamicColors`, `dynamicColorsToPalette`, `extractColorFromImage`, `applyDynamicThemeToDOM`, `PRESET_COLORS`, `createUnoConfig()`
- `@rezics/api` gains: `AuthProvider`, token refresh logic, `authSessionStore` (with `permission` replacing `capabilityLevel`), `useServerPermission()` hook
- Each app (`@rezics/app`, `@rezics/admin`) owns: provider composition (former `AppShell`), `appStore`, `alertStore`, `WindowAlert`

**Why `@rezics/ui` for theme?** It already owns shared UI components. Theme is a UI concern. Both `@rezics/app` and `@rezics/admin` already depend on `@rezics/ui`.

**Why `@rezics/api` for auth state?** It already owns the query client factory and API hooks. Auth state (token management, session claims) is tightly coupled to API communication. The auth provider's token refresh drives when API requests succeed or fail.

**Alternative considered:** Create `@rezics/theme` as a new package — rejected because it would add a package for ~500 LOC that has a single natural home in `@rezics/ui`.

### 5. `useServerPermission()` replaces both `capabilityLevel` and `useServerRole()`

**Choice:** A single hook in `@rezics/api`:

```ts
/**
 * Returns the current user's permission on the main server,
 * derived from the `rezics-session-token` claims.
 *
 * This represents the main server's permission model and is
 * unrelated to `auth-identity-token` except during the
 * session exchange flow.
 *
 * Returns `null` when the user has no valid session token
 * (unauthenticated).
 */
function useServerPermission(): Permission | null
```

**Why not keep `capabilityLevel`?** It's a boolean (`"member" | "anonymous"`) that `useServerPermission() !== null` replaces exactly. One fewer concept.

### 6. `MEMBER` added to `TokenPermissionRole`

**Choice:** Add `MEMBER` to the `tokenPermissionRoleSchema` union. Currently the exchange defaults to `"MEMBER"` but the type doesn't include it — this is a type-level bug.

**Resulting enum:** `ROOT | ADMIN | USER | MEMBER | BLOCKED`

`USER` and `MEMBER` are kept distinct for now: `USER` is explicit assignment, `MEMBER` is the default when no permission is set. This matches the DB semantics where `permission: null` means "default member."

## Risks / Trade-offs

**[Session token format change]** → All active sessions invalidated on deploy. Users must re-authenticate. **Mitigation:** This is acceptable — session tokens are short-lived (15 min default). Deploy during low-traffic window. No data loss.

**[Permission helpers break all callers]** → Every file importing from `@rezics/contract/permission` needs updating. **Mitigation:** The change is mechanical (find-and-replace `AuthIdentity` → `Permission` + separate `unitId`). Total affected: ~10 permission files + ~20 server route files.

**[Moving code between packages]** → Risk of broken imports, missing re-exports. **Mitigation:** Do the move in a single commit, run `bun install` to verify workspace resolution, then fix imports. TypeScript compiler catches any broken references.

**[`@rezics/ui` gains theme dependency on Material Color Utilities]** → Increases `@rezics/ui` bundle size. **Mitigation:** The dependency already exists in the dependency tree via app-shell. No net addition. Tree-shaking eliminates unused code for consumers that don't use dynamic colors.

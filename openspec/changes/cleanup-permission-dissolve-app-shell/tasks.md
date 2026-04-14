## 1. Contract: Permission Model

- [x] 1.1 Add `MEMBER` to `tokenPermissionRoleSchema` in `package/contract/src/token.ts`
- [x] 1.2 Define `permissionSchema` and `Permission` type in `package/contract/src/permission/core.ts` as `{ role: TokenPermissionRole }`
- [x] 1.3 Replace `role: t.String()` with `permission: permissionSchema` in `rezicsSessionClaimsSchema` in `package/contract/src/token.ts`
- [x] 1.4 Delete `AuthIdentity` type from `package/contract/src/permission/core.ts`
- [x] 1.5 Update `isAdmin`, `isRoot`, `BasicAdminPermission`, `isBlocked` in `core.ts` to accept `Permission` instead of `AuthIdentity`
- [x] 1.6 Update `verifyRoot`, `verifyAdmin`, `verifyBlocked` in `main.ts` to accept `Permission`
- [x] 1.7 Update resource-specific helpers (`book.ts`, `chapter.ts`, `post.ts`, `shelf.ts`, `tag.ts`, `unit.ts`, `user.ts`) to accept `Permission` + `actorUnitId: string` as separate parameters
- [x] 1.8 Update `package/contract/src/permission/index.ts` exports — remove `AuthIdentity`, add `Permission` and `permissionSchema`
- [x] 1.9 Verify contract builds: `cd package/contract && bun run build` (or typecheck)

## 2. Server: Session Exchange

- [x] 2.1 Update `POST /session/exchange` in `package/server/src/session/session.api.ts` to write `permission: { role }` instead of `role` into the JWT payload
- [x] 2.2 Update `signRezicsSessionToken` in `package/server/src/session/jwt/jwt.service.ts` to accept and embed `permission` object
- [x] 2.3 Verify the exchange flow never reads `auth-identity-token.role` — only `unitId` is used from the auth token

## 3. Server: Middleware and Guards

- [x] 3.1 Update auth macro in `package/server/src/middleware/` to resolve `identity` as `{ unitId, permission: Permission }` from the new token claims
- [x] 3.2 Update `verifyAdminFromDb` and `verifyRootFromDb` in `package/server/src/middleware/permission.ts` (these query DB directly, verify they don't depend on `AuthIdentity`)
- [x] 3.3 Grep all server route files for `identity.role` and update to `identity.permission.role`
- [x] 3.4 Update admin route guards in `package/server/src/user/api/user.admin.api.ts` and any other admin-gated routes
- [x] 3.5 Update realm permission checks in `package/server/src/realm/realm.api.ts` if they reference `identity.role`
- [x] 3.6 Run server tests: `cd package/server && bun test`

## 4. Dissolve app-shell: Theme → @rezics/ui

- [x] 4.1 Move `package/app-shell/src/config/theme.ts` to `package/ui/src/config/theme.ts`
- [x] 4.2 Move `package/app-shell/src/config/dynamicTheme.ts` to `package/ui/src/config/dynamicTheme.ts`
- [x] 4.3 Move `package/app-shell/src/config/uno-config.ts` to `package/ui/src/config/uno-config.ts`
- [x] 4.4 Add `material-color-utilities` dependency to `package/ui/package.json`
- [x] 4.5 Export theme utilities from `package/ui/src/index.ts` and UnoCSS config from `package/ui/uno.config` subpath
- [x] 4.6 Update `package/app/uno.config.ts`, `package/admin/uno.config.ts`, and `package/ui/uno.config.ts` imports from `@rezics/app-shell` to `@rezics/ui`
- [x] 4.7 Update theme imports in `package/app/src/preferences/` components to use `@rezics/ui`
- [x] 4.8 Update `package/ui/src/cosmos.decorator.tsx` to use local theme import

## 5. Dissolve app-shell: Auth State → @rezics/api

- [x] 5.1 Move `package/app-shell/src/provider/AuthProvider.tsx` to `package/api/src/provider/AuthProvider.tsx`
- [x] 5.2 Move `package/app-shell/src/provider/refreshRetryPolicy.ts` to `package/api/src/provider/refreshRetryPolicy.ts`
- [x] 5.3 Move `package/app-shell/src/state/authSessionStore.ts` to `package/api/src/state/authSessionStore.ts`
- [x] 5.4 Update `authSessionStore`: replace `capabilityLevel` with `permission: Permission | null` derived from `rezics-session-token.permission` claim
- [x] 5.5 Remove `AuthCapabilityLevel` type and `hasAuthSession` derived field
- [x] 5.6 Create `useServerPermission()` hook in `package/api/src/hooks/useServerPermission.ts` with JSDoc documenting the server permission boundary
- [x] 5.7 Export `AuthProvider`, `useAuthSessionStore`, `useServerPermission` from `package/api/src/index.ts`
- [x] 5.8 Move auth provider tests alongside the moved files in `@rezics/api`

## 6. Dissolve app-shell: Shell Composition → Per-App Local

- [x] 6.1 Create local provider composition in `package/app/src/app/` replacing the shared `AppShell` component
- [x] 6.2 Move `appStore` and `alertStore` into `package/app/src/app/state/` as local stores
- [x] 6.3 Move `WindowAlert` component into `package/app/src/app/component/`
- [x] 6.4 Create local provider composition in `package/admin/src/app/` replacing the shared `AppShell` component
- [x] 6.5 Move `appStore` and `alertStore` into `package/admin/` as local stores
- [x] 6.6 Move `ReactQueryProvider` and `PersistentSettingsLoader` into `@rezics/api` or inline in each app (decide based on duplication)

## 7. Frontend: Migrate Permission Consumers

- [x] 7.1 Delete `useServerRole()` from `package/app/src/realm/model/useServerRole.ts`
- [x] 7.2 Update `package/app/src/realm/page/RealmPage.tsx` and `RealmManagePage.tsx` to use `useServerPermission()` from `@rezics/api`
- [x] 7.3 Update `canManageRealm` to accept `Permission` instead of `globalRole: string`
- [x] 7.4 Update `package/admin/src/routes/_admin.tsx` to use `useServerPermission()` instead of parsing JWT for role
- [x] 7.5 Update `package/admin/src/auth/page/AuthStatusPage.tsx` to use new permission state
- [x] 7.6 Remove re-export of `authSessionStore` from `package/app/src/user/state/` (now imported directly from `@rezics/api`)
- [x] 7.7 Grep codebase for remaining `capabilityLevel`, `useServerRole`, `AuthIdentity`, `@rezics/app-shell` references — fix any stragglers

## 8. Cleanup and Verification

- [x] 8.1 Delete `package/app-shell/` directory entirely
- [x] 8.2 Remove `@rezics/app-shell` from root `package.json` workspaces
- [x] 8.3 Remove `@rezics/app-shell` from `package.json` dependencies in `@rezics/app`, `@rezics/admin`, `@rezics/ui`, `@rezics/api`
- [x] 8.4 Run `bun install` to verify workspace resolution
- [x] 8.5 Verify all packages build: `bun run build` or typecheck each affected package
- [x] 8.6 Run all tests: `cd package/server && bun test` and `cd package/api && bun test`
- [x] 8.7 Grep for `@rezics/app-shell` across the entire codebase — expect zero results
- [x] 8.8 Run `bun run knip` at root to verify no unused exports or dependencies remain

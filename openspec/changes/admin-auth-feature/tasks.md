## 1. Admin Env Configuration

- [x] 1.1 Add `VITE_AUTH_API_URL` to `package/admin/src/env.ts` using `@t3-oss/env-core` + `valibot` pattern (matching existing `VITE_API_URL`)
- [x] 1.2 Add `VITE_AUTH_API_URL=http://localhost:3001` to `package/admin/.env`

## 2. Auth API Client Module (`package/api/src/auth/`)

- [x] 2.1 Create `auth.api.ts` with `authFetch` utility function (targets `VITE_AUTH_API_URL`, includes `credentials: 'include'`) and `authApi` object containing: `signIn`, `signUp`, `signOut`, `getSession`, `listSessions`, `revokeSession`, `adminListUsers`, `adminRemoveUser`, `adminBanUser`, `adminUnbanUser`, `adminSetRole`
- [x] 2.2 Create `auth.keys.ts` with `authKeys` factory: `session()`, `sessions()`, `adminUsers()`, `adminUserList(filters?)`
- [x] 2.3 Create `auth.queries.ts` with `authSessionQuery`, `authSessionsQuery`, `authAdminUsersQuery` using `queryOptions` from `@tanstack/react-query`
- [x] 2.4 Create `auth.mutations.ts` with mutation hooks: `useSignInMutation`, `useSignOutMutation`, `useAdminBanUserMutation`, `useAdminUnbanUserMutation`, `useAdminSetRoleMutation`, `useAdminRemoveUserMutation`, `useRevokeSessionMutation` — each invalidating relevant caches on success
- [x] 2.5 Update `auth.ts` barrel export to re-export `authApi`, `authKeys`, `authQueries`, `authMutations`

## 3. Remove Login Logic from User Module (`package/api/src/user/`)

- [x] 3.1 ~~Remove~~ **Kept** `login`, `register`, `resetPassword`, `sendVerificationCode` methods in `userApi` — `package/app` still uses them (per design risk mitigation: "If app uses it too, keep the API but mark admin as migrated")
- [x] 3.2 ~~Remove~~ **Kept** `useLoginMutation` and `useRegisterMutation` in `user.mutations.ts` — `package/app` still depends on them
- [x] 3.3 Grep verified: `package/app` uses `userApi.login`, `userApi.register`, `userApi.resetPassword`, `userApi.sendVerificationCode` — APIs retained, admin LoginPage will be migrated to `authApi` instead

## 4. Admin Login Page Update

- [x] 4.1 Update `package/admin/src/user/page/LoginPage.tsx` to import and call `authApi.signIn()` instead of `userApi.login()`. Check user role from auth response for admin/owner access. Handle session establishment (no more `setToken()` for login).
- [x] 4.2 Update `package/admin/src/routes/_admin.tsx` auth guard to check auth-server session instead of `getToken()`. Use `authApi.getSession()` or a cookie-presence check.
- [x] 4.3 Update `package/admin/src/routes/login.tsx` to match the new auth guard mechanism (check auth-server session instead of `getToken()`)

## 5. Auth Admin Pages (`package/admin/src/auth/`)

- [x] 5.1 Create `package/admin/src/auth/page/AuthUsersPage.tsx` — paginated table of auth users with columns (ID, Name, Email, Role, Banned, Created). Include action buttons for Ban/Unban, Set Role (dropdown), Remove (with confirmation dialog). Use `PaginatedTable`, `Page`, MUI components, `useQuery`/mutations from auth API module.
- [x] 5.2 Create `package/admin/src/auth/page/AuthSessionsPage.tsx` — table of sessions with columns (Token truncated, Created, Expires, User Agent). Include Revoke action with confirmation. Use `PaginatedTable`, `Page`, MUI components.

## 6. Admin Route Definitions

- [x] 6.1 Create `package/admin/src/routes/_admin/auth/users.tsx` — route file using `createFileRoute('/_admin/auth/users')` with `lazyRouteComponent(() => import('@/auth/page/AuthUsersPage'), 'default')`
- [x] 6.2 Create `package/admin/src/routes/_admin/auth/sessions.tsx` — route file using `createFileRoute('/_admin/auth/sessions')` with `lazyRouteComponent(() => import('@/auth/page/AuthSessionsPage'), 'default')`

## 7. Admin Sidebar Navigation

- [x] 7.1 Add "Auth" group to `adminNav.items` in `package/admin/src/navigation/adminNavConfig.tsx` with icon `AdminPanelSettingsOutlined` and children: "Users" (`/auth/users`), "Sessions" (`/auth/sessions`)

## 8. Route Tree Regeneration & Verification

- [x] 8.1 Run TanStack Router route generation to update `routeTree.gen.ts` with new auth routes
- [x] 8.2 Run TypeScript compilation (`tsc --noEmit`) on `package/api` and `package/admin` to verify no type errors (pre-existing errors only, no new errors from this change)
- [x] 8.3 Run lint on changed files to verify code style compliance

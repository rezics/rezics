## Why

The auth server (`package/auth`) already exposes a full set of authentication, admin, session, and organization APIs via better-auth, but the admin dashboard (`package/admin`) has no dedicated auth feature — it currently relies on the main-server user login (`userApi.login`). The API client package (`package/api`) also has an empty `auth/auth.ts` with no implementation. We need a complete admin-side auth feature that uses the auth server directly for sign-in, session management, and admin user management, and remove the legacy login logic from `package/api/user` to avoid duplication.

## What Changes

- **`package/api/src/auth/`**: Implement full auth API client module (`auth.api.ts`, `auth.keys.ts`, `auth.queries.ts`, `auth.mutations.ts`, `auth.ts`) covering:
  - Sign-in / sign-up / sign-out via auth server endpoints (`/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/sign-out`)
  - Session management (`get-session`, `list-sessions`, `revoke-session`)
  - Admin user management (`list-users`, `remove-user`, `ban-user`, `unban-user`, `set-role`)
- **`package/admin/src/auth/`**: Implement complete auth feature pages:
  - Login page — replace current `LoginPage` (which uses `userApi.login`) with one that calls the auth server sign-in API
  - Auth users management page — list auth users with admin privileges, ban/unban, set roles, remove users
  - Session management page — list/revoke sessions
- **`package/admin/src/routes/`**: Add route definitions for auth feature pages under `_admin/auth/`
- **`package/api/src/user/`**: Remove login-related logic (`login`, `register`, `resetPassword`, `sendVerificationCode` in `user.api.ts` and `useLoginMutation`, `useRegisterMutation` in `user.mutations.ts`). Keep all other user management logic (CRUD, follow, admin user operations for the main server).
- **`package/admin/src/routes/login.tsx`**: Update to use the new auth API instead of `userApi.login`.

## Capabilities

### New Capabilities
- `admin-auth-api-client`: API client module in `package/api/src/auth/` providing typed functions, query keys, query options, and mutation hooks for all auth server endpoints (sign-in, session, admin management).
- `admin-auth-pages`: Admin dashboard pages in `package/admin/src/auth/` for login, auth user management (list/ban/unban/set-role/remove), and session management.

### Modified Capabilities
- `auth-openapi-routes`: No spec-level requirement changes — routes already exist in auth server, only consumed by new client code.

## Impact

- **Affected packages**: `package/api`, `package/admin`
- **APIs**: Auth server endpoints are already deployed; this change adds client-side consumption. Main server `/users/login` and `/users/register` endpoints remain but are no longer called from admin.
- **Dependencies**: `@rezics/contract` types (auth schemas) are already published and will be reused.
- **Backward compatibility**: The main-server user API (`userApi`) retains all non-login functionality. Admin login switches from main-server JWT to auth-server session-based auth. Existing `getToken`/`setToken` in `http.ts` will be updated to work with auth-server session tokens.
- **No migration needed**: Auth server is already running; admin just needs to point at it.

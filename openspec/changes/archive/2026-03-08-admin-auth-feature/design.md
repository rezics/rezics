## Context

The auth server (`package/auth`) runs as an independent Elysia service on port 3001, powered by better-auth with admin, organization, JWT, and OAuth plugins. It exposes REST endpoints under `/api/auth/*` for sign-in, session management, admin user operations, and more.

The admin dashboard (`package/admin`) currently authenticates via the main server's `/users/login` endpoint (`userApi.login`), storing a JWT in `localStorage`. This couples admin authentication to the main server instead of the dedicated auth server.

The API client package (`package/api/src/auth/auth.ts`) exists but is empty — no auth API client has been implemented.

The `package/app` already has `VITE_AUTH_API_URL` in its env config, showing the pattern for pointing at the auth server. The admin package needs the same env variable.

## Goals / Non-Goals

**Goals:**
- Implement a complete auth API client module in `package/api/src/auth/` following the same pattern as `token`, `book`, etc. (`.api.ts`, `.keys.ts`, `.queries.ts`, `.mutations.ts`, `.ts`)
- Build admin dashboard pages for: login (via auth server), auth user management (list/ban/unban/set-role/remove), session management (list/revoke)
- Add `VITE_AUTH_API_URL` to admin env config so the auth server base URL is configurable
- Remove login-related logic from `package/api/src/user/` to avoid duplication (login, register, resetPassword, sendVerificationCode APIs and useLoginMutation, useRegisterMutation hooks)
- Add auth section to the admin sidebar navigation

**Non-Goals:**
- Implementing OAuth/OIDC flows in the admin dashboard (admin uses email/password sign-in)
- Implementing organization management pages (future change)
- Changing the auth server itself — all endpoints already exist
- Modifying the main app (`package/app`) auth flow
- Adding social provider login to admin

## Decisions

### 1. Auth API client uses a separate `authFetch` function pointing at the auth server

**Decision**: Create an `authFetch` utility in `package/api/src/auth/auth.api.ts` that targets `VITE_AUTH_API_URL` instead of `VITE_API_URL`. The auth server is a separate service with a different base URL.

**Rationale**: The existing `apiFetch` in `react-query/http.ts` points at the main server (`VITE_API_URL`). Auth endpoints live on a different server. Rather than modifying the shared `apiFetch`, a dedicated fetch function keeps concerns separated and avoids breaking existing API calls.

**Alternative considered**: Adding a `baseUrl` parameter to `apiFetch` — rejected because it would change the signature of every existing call site and the auth server uses cookie-based sessions, not JWT bearer tokens.

### 2. Auth server uses cookie-based sessions (credentials: 'include'), not JWT bearer tokens for admin login

**Decision**: The admin login flow uses better-auth's session cookies. After sign-in, the response includes session data. Subsequent admin API calls to the auth server include `credentials: 'include'` to send cookies. The existing `getToken()`/`setToken()` localStorage mechanism remains for main-server API calls only.

**Rationale**: better-auth manages sessions via HTTP-only cookies by default. Fighting this to use bearer tokens adds unnecessary complexity. Admin pages that call auth-server endpoints use cookie auth; pages that call main-server endpoints continue using the existing JWT pattern.

### 3. Admin login page replaces the current implementation

**Decision**: Update the existing `LoginPage.tsx` to call `authApi.signIn()` instead of `userApi.login()`. The login route (`/login`) stays at the same path.

**Rationale**: There's only one login flow for the admin dashboard. Keeping two would create confusion.

### 4. Auth admin pages live under `/auth/` route group

**Decision**: Add route files at `_admin/auth/users.tsx`, `_admin/auth/sessions.tsx`. Page components go in `package/admin/src/auth/page/`.

**Rationale**: Follows the existing convention where each feature has a `page/` subdirectory and routes reference those via `lazyRouteComponent`.

### 5. Remove login-related APIs from user module, keep all other user APIs

**Decision**: Remove `login`, `register`, `resetPassword`, `sendVerificationCode` from `userApi` and `useLoginMutation`, `useRegisterMutation` from `userMutations`. Keep all CRUD, follow, admin user management functions.

**Rationale**: These login operations should go through the auth server. The main-server user module manages user profile data (names, slugs, follows) which is a separate concern from authentication.

### 6. Add `VITE_AUTH_API_URL` to admin env config

**Decision**: Add `VITE_AUTH_API_URL` to `package/admin/src/env.ts` using the existing `@t3-oss/env-core` + `valibot` pattern. The admin env already imports from `@rezics/app/env` via `apiFetch`, so we either add it to `package/app/src/env.ts` (already has it) or to admin's own env.

**Rationale**: Since `package/app/src/env.ts` already defines `VITE_AUTH_API_URL`, and `apiFetch` in `package/api/src/react-query/http.ts` imports `env` from `@rezics/app/env`, the auth API client can also import from `@rezics/app/env` for `VITE_AUTH_API_URL`. The admin `.env` file needs the variable added.

## Risks / Trade-offs

- **[Risk] Two auth mechanisms in admin (cookies for auth-server, JWT for main-server)** → Mitigation: Clearly separate which API client talks to which server. Auth pages use `authApi` (cookies), user/book/other pages use `apiFetch` (JWT). Document this distinction.

- **[Risk] Removing login APIs from userApi may break imports in other packages** → Mitigation: Grep all usages before removal. Only `package/admin` LoginPage uses `userApi.login`; main app (`package/app`) may also use it — verify and only remove admin-side references. If app uses it too, keep the API but mark admin as migrated.

- **[Risk] Auth server CORS needs to allow admin origin for cookies** → Mitigation: Auth server already has `origin: true` and `credentials: true` in CORS config, so this should work. Verify in testing.

- **[Trade-off] Admin session management is split: auth-server sessions managed via new pages, main-server JWT still used for non-auth API calls** → Acceptable for now. Full migration to auth-server-only auth is a future change.

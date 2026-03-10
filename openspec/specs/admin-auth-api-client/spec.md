## ADDED Requirements

### Requirement: Auth API fetch utility
The auth API client module SHALL provide an `authFetch` function in `package/api/src/auth/auth.api.ts` that sends HTTP requests to the auth server base URL (`VITE_AUTH_API_URL` from `@package/app/env`). All requests SHALL include `credentials: 'include'` for cookie-based session handling and `Content-Type: application/json`.

#### Scenario: Auth fetch sends request to auth server
- **WHEN** `authFetch('/api/auth/get-session')` is called
- **THEN** the request SHALL be sent to `${VITE_AUTH_API_URL}/api/auth/get-session` with `credentials: 'include'`

#### Scenario: Auth fetch handles error responses
- **WHEN** the auth server returns a non-2xx response
- **THEN** `authFetch` SHALL throw an Error with the status code and error message from the response body

### Requirement: Sign-in API
The `authApi` object SHALL expose a `signIn` method that sends `POST /api/auth/sign-in/email` with `{ email, password }` body and returns the `AuthResponse` (user + session).

#### Scenario: Successful sign-in
- **WHEN** `authApi.signIn({ email, password })` is called with valid credentials
- **THEN** the auth server SHALL set session cookies and return the user and session data

#### Scenario: Failed sign-in
- **WHEN** `authApi.signIn({ email, password })` is called with invalid credentials
- **THEN** the function SHALL throw an error with the server's error message

### Requirement: Sign-up API
The `authApi` object SHALL expose a `signUp` method that sends `POST /api/auth/sign-up/email` with `{ name, email, password }` body and returns `AuthResponse`.

#### Scenario: Successful sign-up
- **WHEN** `authApi.signUp({ name, email, password })` is called
- **THEN** a new user SHALL be created on the auth server and session data SHALL be returned

### Requirement: Sign-out API
The `authApi` object SHALL expose a `signOut` method that sends `POST /api/auth/sign-out` and returns `SignOutResponse`.

#### Scenario: Successful sign-out
- **WHEN** `authApi.signOut()` is called
- **THEN** the auth server SHALL invalidate the current session cookie

### Requirement: Get session API
The `authApi` object SHALL expose a `getSession` method that sends `GET /api/auth/get-session` and returns `GetSessionResponse` (session + user).

#### Scenario: Authenticated session retrieval
- **WHEN** `authApi.getSession()` is called with a valid session cookie
- **THEN** the current session and user data SHALL be returned

### Requirement: Get access token API
The `authApi` object SHALL expose a `getToken` method that sends `GET /api/auth/token` and returns `AuthTokenResponse`.

#### Scenario: Access token retrieval
- **WHEN** `authApi.getToken()` is called with a valid auth session cookie
- **THEN** the auth server SHALL return an access token payload suitable for JWT persistence and downstream bearer requests

### Requirement: List sessions API
The `authApi` object SHALL expose a `listSessions` method that sends `POST /api/auth/list-sessions` and returns `ListSessionsResponse`.

#### Scenario: List active sessions
- **WHEN** `authApi.listSessions()` is called
- **THEN** all active sessions for the current user SHALL be returned

### Requirement: Revoke session API
The `authApi` object SHALL expose a `revokeSession` method that sends `POST /api/auth/revoke-session` with `{ token }` body.

#### Scenario: Revoke a session
- **WHEN** `authApi.revokeSession({ token })` is called with a valid session token
- **THEN** the specified session SHALL be invalidated on the auth server

### Requirement: Admin list users API
The `authApi` object SHALL expose an `adminListUsers` method that sends `GET /api/auth/admin/list-users` and returns `ListUsersResponse`.

#### Scenario: Admin lists all users
- **WHEN** `authApi.adminListUsers()` is called by an admin user
- **THEN** a paginated list of all auth users SHALL be returned

### Requirement: Admin remove user API
The `authApi` object SHALL expose an `adminRemoveUser` method that sends `POST /api/auth/admin/remove-user` with `{ userId }` body.

#### Scenario: Admin removes a user
- **WHEN** `authApi.adminRemoveUser({ userId })` is called
- **THEN** the specified user SHALL be permanently removed from the auth server

### Requirement: Admin ban user API
The `authApi` object SHALL expose an `adminBanUser` method that sends `POST /api/auth/admin/ban-user` with `{ userId, reason? }` body.

#### Scenario: Admin bans a user
- **WHEN** `authApi.adminBanUser({ userId, reason })` is called
- **THEN** the specified user SHALL be banned on the auth server

### Requirement: Admin unban user API
The `authApi` object SHALL expose an `adminUnbanUser` method that sends `POST /api/auth/admin/unban-user` with `{ userId }` body.

#### Scenario: Admin unbans a user
- **WHEN** `authApi.adminUnbanUser({ userId })` is called
- **THEN** the specified user's ban SHALL be lifted

### Requirement: Admin set role API
The `authApi` object SHALL expose an `adminSetRole` method that sends `POST /api/auth/admin/set-role` with `{ userId, role }` body.

#### Scenario: Admin sets user role
- **WHEN** `authApi.adminSetRole({ userId, role: 'admin' })` is called
- **THEN** the specified user's role SHALL be updated to `admin` on the auth server

### Requirement: React Query keys factory
The module SHALL export an `authKeys` object in `package/api/src/auth/auth.keys.ts` providing cache key factories for: `session`, `sessions`, `adminUsers`, `adminUserList`.

#### Scenario: Key factory returns stable keys
- **WHEN** `authKeys.session()` is called
- **THEN** it SHALL return `['auth', 'session']` as a readonly tuple

### Requirement: React Query options
The module SHALL export query option factories in `package/api/src/auth/auth.queries.ts` for: `authSessionQuery` (get-session), `authSessionsQuery` (list-sessions), `authAdminUsersQuery` (admin list-users). Each SHALL use `queryOptions` from `@tanstack/react-query`.

#### Scenario: Session query uses correct key and fetch
- **WHEN** `authSessionQuery()` is called
- **THEN** it SHALL return a `queryOptions` object with `queryKey: authKeys.session()` and `queryFn: () => authApi.getSession()`

### Requirement: React Query mutation hooks
The module SHALL export mutation hooks in `package/api/src/auth/auth.mutations.ts` for: `useSignInMutation`, `useSignOutMutation`, `useAdminBanUserMutation`, `useAdminUnbanUserMutation`, `useAdminSetRoleMutation`, `useAdminRemoveUserMutation`, `useRevokeSessionMutation`. Each SHALL invalidate relevant query caches on success.

#### Scenario: Sign-in mutation invalidates session cache
- **WHEN** `useSignInMutation` succeeds
- **THEN** it SHALL invalidate the `authKeys.session()` query cache
- **AND** it SHALL fetch and persist a fresh access token via `queryAccessToken()`

#### Scenario: Ban user mutation invalidates admin users cache
- **WHEN** `useAdminBanUserMutation` succeeds
- **THEN** it SHALL invalidate the `authKeys.adminUsers()` query cache

### Requirement: Module entry point
The module SHALL export all public APIs from `package/api/src/auth/auth.ts` following the same barrel export pattern as other API modules (`export { authApi } from './auth.api'`, etc.).

#### Scenario: Importing auth API from barrel
- **WHEN** a consumer imports `import { authApi } from '@package/api/auth/auth.api'`
- **THEN** the import SHALL resolve to the auth API client object

### Requirement: Remove login APIs from user module
The `userApi` object in `package/api/src/user/user.api.ts` SHALL NOT contain `login`, `register`, `resetPassword`, or `sendVerificationCode` methods. The `userMutations` object SHALL NOT contain `useLogin` or `useRegister`. All other user API methods (me, list, adminList, get, update, delete, follow, etc.) SHALL remain unchanged.

#### Scenario: userApi no longer has login method
- **WHEN** a developer inspects `userApi`
- **THEN** it SHALL NOT have a `login` property

#### Scenario: User CRUD remains functional
- **WHEN** `userApi.me()` or `userApi.adminList()` is called
- **THEN** it SHALL work identically to before

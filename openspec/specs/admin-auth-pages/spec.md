## ADDED Requirements

### Requirement: Admin login page uses auth server
The login page at `/login` (`package/admin/src/user/page/LoginPage.tsx`) SHALL use `useSignInMutation()` from `@package/api/auth/auth.mutations`. On successful sign-in, it SHALL read the freshly persisted JWT via `getToken()`/`parseJwt()`, verify the payload role is `admin` or `owner`, hydrate `useAuthStore`, then navigate to the redirect target.

#### Scenario: Admin signs in successfully
- **WHEN** an admin user enters valid email and password and submits the login form
- **THEN** the page SHALL execute `useSignInMutation()`
- **AND** the mutation success path SHALL obtain a JWT via `queryAccessToken()`
- **AND** the page SHALL parse the JWT payload, verify `role` includes admin/owner privileges, and redirect to the admin dashboard

#### Scenario: Non-admin user denied access
- **WHEN** a regular user signs in with valid credentials but no admin role
- **THEN** the page SHALL display "You are not authorized to access this page" and SHALL NOT navigate away

#### Scenario: Invalid credentials
- **WHEN** a user submits invalid email or password
- **THEN** the page SHALL display the error message from the auth server

### Requirement: Admin auth guard uses authStore role state
The admin route guard in `package/admin/src/routes/_admin.tsx` SHALL authorize access from `useAuthStore` state populated from the JWT payload, instead of calling `authApi.getSession()` during route resolution.

#### Scenario: Unauthenticated user redirected to login
- **WHEN** an unauthenticated user tries to access any `/_admin/*` route
- **THEN** the guard SHALL redirect to `/login` with the attempted path as a `redirect` search parameter

#### Scenario: Authenticated user accesses admin routes
- **WHEN** a user with `role = admin` or `role = owner` in `useAuthStore` accesses an `/_admin/*` route
- **THEN** the guard SHALL allow access and render the admin layout

### Requirement: Auth users management page
The admin dashboard SHALL include a page at `/_admin/auth/users` that displays a paginated table of all auth server users. The page component SHALL be at `package/admin/src/auth/page/AuthUsersPage.tsx`.

#### Scenario: Page displays user list
- **WHEN** an admin navigates to `/auth/users`
- **THEN** the page SHALL fetch users via `authApi.adminListUsers()` and display them in a `PaginatedTable` with columns: ID, Name, Email, Role, Banned status, Created date

#### Scenario: Admin bans a user
- **WHEN** an admin clicks the "Ban" action on a user row
- **THEN** a confirmation dialog SHALL appear, and upon confirmation, `authApi.adminBanUser({ userId })` SHALL be called, and the user list SHALL refresh

#### Scenario: Admin unbans a user
- **WHEN** an admin clicks the "Unban" action on a banned user row
- **THEN** `authApi.adminUnbanUser({ userId })` SHALL be called and the user list SHALL refresh

#### Scenario: Admin sets user role
- **WHEN** an admin selects a new role from a role dropdown on a user row
- **THEN** `authApi.adminSetRole({ userId, role })` SHALL be called and the user list SHALL refresh

#### Scenario: Admin removes a user
- **WHEN** an admin clicks the "Remove" action on a user row and confirms the dialog
- **THEN** `authApi.adminRemoveUser({ userId })` SHALL be called and the user list SHALL refresh

### Requirement: Auth sessions management page
The admin dashboard SHALL include a page at `/_admin/auth/sessions` that displays session data. The page component SHALL be at `package/admin/src/auth/page/AuthSessionsPage.tsx`.

#### Scenario: Page displays current session list
- **WHEN** an admin navigates to `/auth/sessions`
- **THEN** the page SHALL fetch sessions via `authApi.listSessions()` and display them in a table with columns: Token (truncated), Created, Expires, User Agent

#### Scenario: Admin revokes a session
- **WHEN** an admin clicks the "Revoke" action on a session row and confirms
- **THEN** `authApi.revokeSession({ token })` SHALL be called and the session list SHALL refresh

### Requirement: Auth route definitions
The admin router SHALL include route files at:
- `package/admin/src/routes/_admin/auth/users.tsx` — maps to `AuthUsersPage`
- `package/admin/src/routes/_admin/auth/sessions.tsx` — maps to `AuthSessionsPage`

Each route SHALL use `lazyRouteComponent` following the existing convention.

#### Scenario: Auth users route resolves
- **WHEN** a user navigates to `/auth/users`
- **THEN** TanStack Router SHALL load and render the `AuthUsersPage` component

#### Scenario: Auth sessions route resolves
- **WHEN** a user navigates to `/auth/sessions`
- **THEN** TanStack Router SHALL load and render the `AuthSessionsPage` component

### Requirement: Auth navigation section in sidebar
The admin sidebar navigation (`package/admin/src/navigation/adminNavConfig.tsx`) SHALL include an "Auth" group with children:
- "Users" → `/auth/users`
- "Sessions" → `/auth/sessions`

The group SHALL use a security-related MUI icon (e.g., `SecurityOutlined` or `AdminPanelSettingsOutlined`).

#### Scenario: Auth nav group visible in sidebar
- **WHEN** an admin views the sidebar navigation
- **THEN** an "Auth" group SHALL be visible with "Users" and "Sessions" sub-items

#### Scenario: Clicking auth nav item navigates correctly
- **WHEN** an admin clicks "Users" under the "Auth" nav group
- **THEN** the browser SHALL navigate to `/auth/users`

### Requirement: Admin env includes auth URL
The admin environment config (`package/admin/src/env.ts`) SHALL include `VITE_AUTH_API_URL` as a required string variable. The admin `.env` file SHALL be updated to include this variable.

#### Scenario: Auth URL available in admin env
- **WHEN** the admin app starts
- **THEN** `env.VITE_AUTH_API_URL` SHALL be available and point to the auth server base URL

### Requirement: Page component conventions
All auth page components SHALL follow existing admin page conventions:
- Use the `Page` component from `@/core/layout/Page` for page title and description
- Use `PaginatedTable` from `@/component/table/PaginatedTable` for data tables
- Use MUI components (`Card`, `CardContent`, `Button`, `Typography`, etc.)
- Use `useQuery` and mutation hooks from `@tanstack/react-query`
- Handle loading, error, and empty states

#### Scenario: Auth users page follows layout convention
- **WHEN** the `AuthUsersPage` renders
- **THEN** it SHALL use the `Page` wrapper with title "Auth Users" and a description, and display data in a `Card` > `CardContent` > `PaginatedTable` structure

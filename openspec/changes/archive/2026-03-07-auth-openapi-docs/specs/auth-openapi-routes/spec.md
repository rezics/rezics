## ADDED Requirements

### Requirement: Documented sign-in route
The auth router SHALL define an explicit `POST /sign-in/email` Elysia route with `body` schema (email, password), `response` schema (user object, session, token), and `detail` (summary, description, tags: `['Authentication']`). The handler SHALL delegate to `auth.handler(request)`.

#### Scenario: OpenAPI spec includes sign-in endpoint
- **WHEN** the OpenAPI spec is generated
- **THEN** it SHALL contain a `POST /api/auth/sign-in/email` operation with request body schema, response schema, summary, and tags

### Requirement: Documented sign-up route
The auth router SHALL define an explicit `POST /sign-up/email` Elysia route with `body` schema (name, email, password), `response` schema (user object, session), and `detail` (summary, description, tags: `['Authentication']`). The handler SHALL delegate to `auth.handler(request)`.

#### Scenario: OpenAPI spec includes sign-up endpoint
- **WHEN** the OpenAPI spec is generated
- **THEN** it SHALL contain a `POST /api/auth/sign-up/email` operation with full schema and metadata

### Requirement: Documented sign-out route
The auth router SHALL define an explicit `POST /sign-out` route with `response` schema and `detail` (tags: `['Authentication']`). The handler SHALL delegate to `auth.handler(request)`.

#### Scenario: OpenAPI spec includes sign-out endpoint
- **WHEN** the OpenAPI spec is generated
- **THEN** it SHALL contain a `POST /api/auth/sign-out` operation

### Requirement: Documented session routes
The auth router SHALL define explicit routes for `GET /get-session` and `POST /list-sessions` with appropriate `response` schemas and `detail` (tags: `['Session']`). Handlers SHALL delegate to `auth.handler(request)`.

#### Scenario: OpenAPI spec includes session endpoints
- **WHEN** the OpenAPI spec is generated
- **THEN** it SHALL contain `GET /api/auth/get-session` and `POST /api/auth/list-sessions` operations with response schemas

### Requirement: Documented revoke-session route
The auth router SHALL define an explicit `POST /revoke-session` route with `body` schema (session token/id) and `detail` (tags: `['Session']`).

#### Scenario: OpenAPI spec includes revoke-session
- **WHEN** the OpenAPI spec is generated
- **THEN** it SHALL contain a `POST /api/auth/revoke-session` operation

### Requirement: Documented admin routes
The auth router SHALL define explicit routes for admin plugin endpoints including `GET /admin/list-users`, `POST /admin/remove-user`, `POST /admin/ban-user`, `POST /admin/unban-user`, `POST /admin/set-role`, each with appropriate schemas and `detail` (tags: `['Admin']`).

#### Scenario: OpenAPI spec includes admin endpoints
- **WHEN** the OpenAPI spec is generated
- **THEN** it SHALL contain admin operations under the `Admin` tag with request/response schemas

### Requirement: Documented organization routes
The auth router SHALL define explicit routes for organization plugin endpoints including `POST /organization/create`, `GET /organization/get-full-organization`, `POST /organization/invite-member`, `POST /organization/accept-invitation`, `POST /organization/remove-member`, `POST /organization/update-member-role`, `GET /organization/list-members`, each with appropriate schemas and `detail` (tags: `['Organization']`).

#### Scenario: OpenAPI spec includes organization endpoints
- **WHEN** the OpenAPI spec is generated
- **THEN** it SHALL contain organization operations under the `Organization` tag with request/response schemas

### Requirement: Documented OAuth routes
The auth router SHALL define explicit routes for OAuth provider endpoints including `GET /oauth/authorize`, `POST /oauth/token`, `GET /oauth/userinfo`, `POST /oauth/revoke`, `GET /jwks`, and `POST /oauth/register`, each with appropriate schemas and `detail` (tags: `['OAuth']`).

#### Scenario: OpenAPI spec includes OAuth endpoints
- **WHEN** the OpenAPI spec is generated
- **THEN** it SHALL contain OAuth operations under the `OAuth` tag with request/response schemas

### Requirement: Documented social provider callback routes
The auth router SHALL define explicit routes for social OAuth callback endpoints (`GET /callback/:provider`) with appropriate `detail` (tags: `['Authentication']`).

#### Scenario: OpenAPI spec includes social callback
- **WHEN** the OpenAPI spec is generated
- **THEN** it SHALL contain a callback operation for social providers

### Requirement: Catch-all fallback route
The auth router SHALL define a catch-all route `.all('/*', ...)` as the **last** route, delegating to `handleAuthRequest(request)`. This ensures any undocumented or future better-auth endpoints continue to function.

#### Scenario: Undocumented endpoint still works
- **WHEN** a request is made to a better-auth endpoint not explicitly documented
- **THEN** it SHALL be handled by the catch-all route and reach `auth.handler(request)` via `handleAuthRequest`

### Requirement: Multi-file router structure
The auth router SHALL be organized as multiple files under `package/auth/src/openapi/`, split by domain (`sign-in.ts`, `session.ts`, `admin.ts`, `organization.ts`, `oauth.ts`), with an `index.ts` that composes all sub-routers into a single Elysia instance and adds the catch-all fallback.

#### Scenario: Domain-specific files exist
- **WHEN** a developer looks at `package/auth/src/openapi/`
- **THEN** each domain (authentication, session, admin, organization, OAuth) SHALL have its own file containing only routes for that domain

### Requirement: Router mounted in main app
The composed auth router from `package/auth/src/openapi/index.ts` SHALL be mounted in `package/auth/src/index.ts` via `.use()`, replacing the existing `.all('/api/auth/*', ...)` catch-all. The `@elysiajs/openapi` plugin SHALL see all route definitions.

#### Scenario: OpenAPI UI shows auth endpoints
- **WHEN** a developer visits `/openapi` in development mode
- **THEN** the OpenAPI UI SHALL display all documented auth endpoints with schemas and descriptions

### Requirement: Handler delegation preserved
Every documented route's handler SHALL delegate to `handleAuthRequest(request)` (or `auth.handler(request)` for routes that bypass the token boundary). No route SHALL implement its own auth logic.

#### Scenario: Behavior unchanged after adding documented routes
- **WHEN** a request is made to any documented auth endpoint
- **THEN** the response SHALL be identical to what `auth.handler(request)` would return without the documentation layer

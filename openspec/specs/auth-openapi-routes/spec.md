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
The auth router SHALL define explicit session-domain routes for current-session operations and session-owned JWKS publication, with OpenAPI metadata and schemas where applicable. Auth session JWT acquisition endpoints SHALL be treated as internal-only and SHALL NOT be exposed through the public main `/auth/*` boundary.

#### Scenario: OpenAPI spec includes session routes without public token acquisition
- **WHEN** the OpenAPI spec is generated
- **THEN** it SHALL contain documented session-domain operations for current-session retrieval and session-owned JWKS endpoints under auth session pathing
- **AND** it SHALL NOT document public browser acquisition of an auth session JWT as a supported public operation

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
The auth router SHALL keep explicit OAuth and OIDC public routes documented separately from session-domain routes. Required externally reachable OAuth endpoints SHALL remain reachable through the main public `/auth/*` boundary while the auth service keeps native internal `/api/auth/*` route ownership.

#### Scenario: OAuth public routes remain reachable
- **WHEN** an external OAuth or OIDC client requests the documented authorization, token, discovery, userinfo, revoke, register, callback, or auth-scoped JWKS endpoint
- **THEN** the public request SHALL use main `rezics.com` URLs
- **AND** the auth service SHALL handle the auth-owned protocol behavior internally without requiring an existing browser session unless the protocol step requires login

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

### Requirement: Session-owned JWKS endpoint
The auth router SHALL publish its canonical auth session or OIDC JWKS endpoint under the session domain rather than the old OAuth-centric route ownership, and main SHALL expose that endpoint under an auth-scoped public path such as `/auth/session/jwks`. This endpoint SHALL be publicly accessible for verification and SHALL NOT replace main server `/.well-known/jwks.json`.

#### Scenario: Resource server fetches auth JWKS
- **WHEN** a resource server requests the auth canonical JWKS endpoint at the public auth-scoped path
- **THEN** the system SHALL return the public keys needed for auth/OIDC token verification without requiring credentials
- **AND** main `/.well-known/jwks.json` SHALL remain reserved for `rezics-session-token` verification keys

### Requirement: Explicit CORS policy for auth public surfaces
The auth service and main auth proxy SHALL apply explicit CORS and credential policies that distinguish credentialed browser session routes from public verification and OAuth routes. Allowed origins, allowed headers, cookie credential behavior, and public verifier access SHALL remain auditable in code.

#### Scenario: Browser and verifier access public auth endpoints
- **WHEN** a browser or verifier calls a public auth JWKS or OAuth endpoint
- **THEN** the request SHALL be accepted or rejected according to explicit route-compatible CORS and credential rules rather than implicit plugin defaults

### Requirement: Auth internal route documentation preserves native paths

The auth OpenAPI documentation SHALL continue to describe auth-native internal route behavior under the auth package base path, while public product documentation SHALL describe the main `/auth/*` boundary.

#### Scenario: Developer inspects auth package routes

- **WHEN** a developer reads auth service OpenAPI output in development
- **THEN** the internal auth route paths SHALL remain understandable as auth-owned native routes
- **AND** public product integration docs SHALL direct browser and OAuth clients to main `/auth/*` URLs

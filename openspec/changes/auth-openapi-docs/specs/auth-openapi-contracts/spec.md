## ADDED Requirements

### Requirement: Authentication schemas
`package/contract/src/auth/sign-in.ts` SHALL export Elysia `t.*` schemas for sign-in, sign-up, and sign-out request bodies and response objects. Schemas SHALL accurately represent the fields expected by better-auth (email, password, name, user object, session, token).

#### Scenario: Sign-in body schema is accurate
- **WHEN** the sign-in body schema is used in a route definition
- **THEN** it SHALL define `email` as `t.String({ format: 'email' })` and `password` as `t.String()`

#### Scenario: Sign-up body schema includes name
- **WHEN** the sign-up body schema is used
- **THEN** it SHALL define `name` as `t.String()`, `email` as `t.String({ format: 'email' })`, and `password` as `t.String()`

### Requirement: Session schemas
`package/contract/src/auth/session.ts` SHALL export Elysia `t.*` schemas for session response objects including user data, session metadata (id, token, expiresAt), and list-sessions response.

#### Scenario: Session response schema includes user and session
- **WHEN** the get-session response schema is used
- **THEN** it SHALL define a `session` object (id, token, expiresAt, userId) and a `user` object (id, name, email)

### Requirement: Admin schemas
`package/contract/src/auth/admin.ts` SHALL export Elysia `t.*` schemas for admin plugin request/response objects including list-users response (paginated user array), ban/unban/remove request bodies, and set-role request body.

#### Scenario: List-users response schema is paginated
- **WHEN** the list-users response schema is used
- **THEN** it SHALL define an object with `users` array and pagination fields

### Requirement: Organization schemas
`package/contract/src/auth/organization.ts` SHALL export Elysia `t.*` schemas for organization plugin request/response objects including create-org body, invite-member body, member list response, and organization detail response.

#### Scenario: Create-org body schema
- **WHEN** the create-organization body schema is used
- **THEN** it SHALL define `name` as `t.String()` and `slug` as `t.Optional(t.String())`

### Requirement: OAuth schemas
`package/contract/src/auth/oauth.ts` SHALL export Elysia `t.*` schemas for OAuth provider request/response objects including authorize query params, token request body, token response, userinfo response, and client registration body/response.

#### Scenario: Token response schema includes standard OAuth fields
- **WHEN** the token response schema is used
- **THEN** it SHALL define `access_token`, `token_type`, `expires_in`, and optionally `refresh_token` and `id_token`

### Requirement: Centralized re-export
`package/contract/src/auth/index.ts` SHALL re-export all schemas from the domain-specific files (`sign-in.ts`, `session.ts`, `admin.ts`, `organization.ts`, `oauth.ts`).

#### Scenario: Single import point
- **WHEN** a consumer imports from `package/contract/src/auth`
- **THEN** all auth schemas SHALL be available from that single import

### Requirement: Schema consistency with Elysia types
All schemas SHALL use Elysia's `t` (TypeBox) type constructors (`t.Object`, `t.String`, `t.Number`, `t.Boolean`, `t.Optional`, `t.Array`, etc.) and SHALL be compatible with Elysia's OpenAPI plugin for spec generation.

#### Scenario: Schema generates valid OpenAPI
- **WHEN** a schema is attached to an Elysia route's `body`, `query`, or `response`
- **THEN** the `@elysiajs/openapi` plugin SHALL generate a valid OpenAPI 3.x schema definition from it

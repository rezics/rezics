# auth-openapi-contracts Specification

## Purpose

Defines the Elysia/TypeBox schemas that `@rezics/contract` exposes for auth-related routes (sign-in, session, admin, OAuth, and pending-registration session-state). These schemas drive the OpenAPI surface for the public auth boundary and ensure that auth, main, and the frontend share a single source of truth for auth request/response types.

## Requirements

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

### Requirement: OAuth schemas
`package/contract/src/auth/oauth.ts` SHALL export Elysia `t.*` schemas for OAuth provider request/response objects including authorize query params, token request body, token response, userinfo response, and client registration body/response.

#### Scenario: Token response schema includes standard OAuth fields
- **WHEN** the token response schema is used
- **THEN** it SHALL define `access_token`, `token_type`, `expires_in`, and optionally `refresh_token` and `id_token`

### Requirement: Centralized re-export
`package/contract/src/auth/index.ts` SHALL re-export all schemas from the domain-specific files (`sign-in.ts`, `session.ts`, `admin.ts`, `oauth.ts`).

#### Scenario: Single import point
- **WHEN** a consumer imports from `package/contract/src/auth`
- **THEN** all auth schemas SHALL be available from that single import

### Requirement: Schema consistency with Elysia types
All schemas SHALL use Elysia's `t` (TypeBox) type constructors (`t.Object`, `t.String`, `t.Number`, `t.Boolean`, `t.Optional`, `t.Array`, etc.) and SHALL be compatible with Elysia's OpenAPI plugin for spec generation.

#### Scenario: Schema generates valid OpenAPI
- **WHEN** a schema is attached to an Elysia route's `body`, `query`, or `response`
- **THEN** the `@elysiajs/openapi` plugin SHALL generate a valid OpenAPI 3.x schema definition from it

### Requirement: Auth exposes pending registration state
Auth-facing session state contracts SHALL expose enough normalized state for the frontend and main to distinguish an anonymous user, a pending unverified auth user, a verified auth-only user without main account setup, and a fully registered main user.

#### Scenario: Pending user session state is requested
- **WHEN** a browser with an unverified temporary auth session requests session state
- **THEN** the response SHALL indicate pending registration and unverified email
- **AND** it SHALL NOT imply that a main member session can be acquired

#### Scenario: Verified auth-only session state is requested
- **WHEN** a browser with verified email but no main user requests session state
- **THEN** the response SHALL indicate that main account setup is required

### Requirement: Auth session state handles missing sessions without server errors
Auth-facing session state endpoints SHALL return a typed unauthorized response when no valid auth session exists. They SHALL NOT throw internal server errors for `null` or malformed upstream session payloads.

#### Scenario: Missing auth session is requested
- **WHEN** a browser without a valid auth session requests session state
- **THEN** auth SHALL return an unauthorized typed error
- **AND** the response SHALL NOT be a 500

### Requirement: Session-state checks avoid unrelated JWT signing work
Auth-facing session-state requests SHALL read the existing opaque browser session and pending-registration metadata without issuing a new auth JWT header or refreshing the session as a side effect.

#### Scenario: Pending session state is probed
- **WHEN** main or the frontend requests normalized session state
- **THEN** auth SHALL not perform JWT/JWKS signing-key work merely to answer the readiness check
- **AND** session-state latency SHALL be dominated by session/user/account reads, not signing-key bootstrap

### Requirement: Verification contracts expose delivery failures
Verification email and OTP contracts SHALL expose recoverable error information for delivery failure, Turnstile failure, cooldown, invalid OTP, expired OTP, and already-verified states.

#### Scenario: Verification email cannot be delivered
- **WHEN** the mailer fails to send a verification message
- **THEN** the API response SHALL expose a typed error that frontend can render
- **AND** the frontend SHALL not need to parse plain text errors

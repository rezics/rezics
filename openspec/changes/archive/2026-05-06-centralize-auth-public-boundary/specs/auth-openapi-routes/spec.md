## MODIFIED Requirements

### Requirement: Documented session routes
The auth router SHALL define explicit session-domain routes for current-session operations and session-owned JWKS publication, with OpenAPI metadata and schemas where applicable. Auth session JWT acquisition endpoints SHALL be treated as internal-only and SHALL NOT be exposed through the public main `/auth/*` boundary.

#### Scenario: OpenAPI spec includes session routes without public token acquisition
- **WHEN** the OpenAPI spec is generated
- **THEN** it SHALL contain documented session-domain operations for current-session retrieval and session-owned JWKS endpoints under auth session pathing
- **AND** it SHALL NOT document public browser acquisition of an auth session JWT as a supported public operation

### Requirement: Documented OAuth routes
The auth router SHALL keep explicit OAuth and OIDC public routes documented separately from session-domain routes. Required externally reachable OAuth endpoints SHALL remain reachable through the main public `/auth/*` boundary while the auth service keeps native internal `/api/auth/*` route ownership.

#### Scenario: OAuth public routes remain reachable
- **WHEN** an external OAuth or OIDC client requests the documented authorization, token, discovery, userinfo, revoke, register, callback, or auth-scoped JWKS endpoint
- **THEN** the public request SHALL use main `rezics.com` URLs
- **AND** the auth service SHALL handle the auth-owned protocol behavior internally without requiring an existing browser session unless the protocol step requires login

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

## ADDED Requirements

### Requirement: Auth internal route documentation preserves native paths

The auth OpenAPI documentation SHALL continue to describe auth-native internal route behavior under the auth package base path, while public product documentation SHALL describe the main `/auth/*` boundary.

#### Scenario: Developer inspects auth package routes
- **WHEN** a developer reads auth service OpenAPI output in development
- **THEN** the internal auth route paths SHALL remain understandable as auth-owned native routes
- **AND** public product integration docs SHALL direct browser and OAuth clients to main `/auth/*` URLs

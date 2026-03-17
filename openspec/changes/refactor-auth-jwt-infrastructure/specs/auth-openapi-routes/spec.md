## MODIFIED Requirements

### Requirement: Documented session routes
The auth router SHALL define explicit session-domain routes for current-session operations and JWT-related session operations, including session retrieval, session state, session token acquisition, and session-owned JWKS publication, with OpenAPI metadata and schemas where applicable.

#### Scenario: OpenAPI spec includes session-owned JWT routes
- **WHEN** the OpenAPI spec is generated
- **THEN** it SHALL contain documented session-domain operations for current-session retrieval and session-owned JWT or JWKS endpoints under the auth session pathing

### Requirement: Documented OAuth routes
The auth router SHALL keep explicit OAuth and OIDC public routes documented separately from session-domain routes, and required externally reachable OAuth endpoints SHALL remain publicly accessible after JWT/JWKS ownership moves under session modules.

#### Scenario: OAuth public routes remain reachable
- **WHEN** an external OAuth or OIDC client requests the documented authorization, token, discovery, userinfo, revoke, or JWKS compatibility endpoints
- **THEN** the auth service SHALL expose those endpoints without requiring an existing browser session

## ADDED Requirements

### Requirement: Session-owned JWKS endpoint
The auth router SHALL publish its canonical JWKS endpoint under the session domain rather than the old OAuth-centric route ownership, and that endpoint SHALL be publicly accessible for token verification.

#### Scenario: Resource server fetches auth JWKS
- **WHEN** a resource server requests the auth canonical JWKS endpoint
- **THEN** the auth service SHALL return the public keys needed for offline verification without requiring credentials

### Requirement: Explicit CORS policy for auth public surfaces
The auth service SHALL apply an explicit CORS policy that distinguishes credentialed browser session routes from public verification and OAuth routes, and SHALL keep allowed origins, headers, and credential behavior auditable in code.

#### Scenario: Browser and verifier access public auth endpoints
- **WHEN** a browser or verifier calls a public auth JWKS or OAuth endpoint
- **THEN** the request SHALL be accepted or rejected according to explicit route-compatible CORS rules rather than implicit plugin defaults

## ADDED Requirements

### Requirement: Main owns registration orchestration routes
Main SHALL expose public registration orchestration routes under the main-owned auth/account boundary for creating the main user after verification. Pausing an incomplete registration SHALL use normal sign-out rather than a destructive registration endpoint.

#### Scenario: Main account setup route is requested
- **WHEN** a verified auth-only registrant submits display name and slug
- **THEN** main SHALL validate the auth session through auth
- **AND** main SHALL create the main `User` if no main user exists
- **AND** main SHALL issue `rezics-session-token`

#### Scenario: Pending registration pause is requested
- **WHEN** an auth-only registrant chooses to continue later
- **THEN** the frontend SHALL call the normal sign-out boundary
- **AND** main SHALL clear main session state if present
- **AND** auth SHALL invalidate only the current browser session, not the temporary auth account

## MODIFIED Requirements

### Requirement: Auth-domain authorization remains in auth

For auth-domain routes, main SHALL forward the opaque auth session cookie and SHALL NOT parse auth session state or enforce auth roles. Auth SHALL remain responsible for authorization of auth admin, OAuth client registration protocol behavior, auth JWKS service administration routes, sessions, provider callbacks, and verification routes that only mutate auth-owned state. Auth organization routes SHALL NOT be treated as product account surfaces.

#### Scenario: Auth admin route is proxied
- **WHEN** a request reaches `/auth/admin/list-users`
- **THEN** main SHALL forward the request to auth with the auth session cookie
- **AND** auth SHALL decide whether the session has the required auth admin role

#### Scenario: Auth organization route is not product-facing
- **WHEN** frontend product code needs team or developer organization management
- **THEN** it SHALL use main-owned product routes
- **AND** it SHALL NOT depend on `/auth/organization/*`

### Requirement: Mixed auth and main workflows are split or orchestrated by main

Workflows that require both auth-owned and main-owned state SHALL be split into separate auth-domain and main-domain endpoints where practical. If a split is not practical, main SHALL orchestrate the workflow, perform main-owned readiness checks, and call auth internally with service context. Registration completion is a mixed workflow and SHALL be main-orchestrated. Pausing registration is not a mixed workflow and SHALL use sign-out.

#### Scenario: Registration completion creates main user
- **WHEN** account setup requires verified auth state and main user creation
- **THEN** main SHALL validate auth state internally before creating main-owned data
- **AND** auth SHALL NOT create or provision the main user on its own

#### Scenario: Mixed workflow cannot be split
- **WHEN** a route must update main state and auth state in one user action
- **THEN** main SHALL authorize the main mutation before calling auth internally
- **AND** auth SHALL still enforce auth-domain policy for the auth-owned part

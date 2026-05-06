# main-auth-public-boundary Specification

## Purpose

Defines the public auth boundary for browser and OAuth clients. The main server owns `https://rezics.com/auth/*` as the only public auth surface and maps eligible auth-owned routes to the auth service's internal `/api/auth/*` paths. This spec also defines the split between auth-domain authorization (handled by the auth service) and main-domain authorization (handled by main), and documents how mixed workflows are orchestrated through main.

## Requirements

### Requirement: Main owns the public auth boundary

The main server SHALL expose `https://rezics.com/auth/*` as the only public browser-facing auth boundary for product clients. Eligible auth-owned public routes SHALL be mapped from public `/auth/*` paths to auth service internal `/api/auth/*` paths without exposing `/api/auth/*` as a public browser contract.

#### Scenario: Public auth request is mapped internally
- **WHEN** a browser requests `GET /auth/session`
- **THEN** main SHALL forward the request to the auth service internal session route under `/api/auth/session`
- **AND** the browser-visible URL SHALL remain under `/auth/*`

#### Scenario: Internal auth path is not a public contract
- **WHEN** frontend code or public documentation references auth routes
- **THEN** it SHALL use `/auth/*`
- **AND** it SHALL NOT require callers to know the internal `/api/auth/*` path

### Requirement: Auth host is not a public product API

The system SHALL treat `auth.rezics.com` as deployment DNS only, not as a public product API, OAuth redirect URI, email link target, or frontend browser integration base URL. This boundary MAY be enforced by deployment documentation and configuration conventions rather than by application code in the initial implementation.

#### Scenario: OAuth redirect URI is configured
- **WHEN** an OAuth client or social provider redirect URI is registered
- **THEN** the registered URI SHALL use `https://rezics.com/auth/callback/*`
- **AND** it SHALL NOT use `https://auth.rezics.com/*`

### Requirement: Public auth proxy restricts unsafe token exposure

Main SHALL NOT expose an auth session JWT acquisition endpoint as public `GET /auth/token`. If auth keeps an internal endpoint equivalent to `GET /api/auth/token`, main SHALL block it at the public proxy or keep it internal-only.

#### Scenario: Browser requests auth token endpoint
- **WHEN** a browser requests `GET /auth/token`
- **THEN** main SHALL reject the request or return not found
- **AND** it SHALL NOT return an auth session JWT

### Requirement: Auth-domain authorization remains in auth

For auth-domain routes, main SHALL forward the opaque auth session cookie and SHALL NOT parse auth session state or enforce auth roles. Auth SHALL remain responsible for authorization of auth admin, organization management, OAuth client registration, and auth JWKS service administration routes that only mutate auth-owned state.

#### Scenario: Auth admin route is proxied
- **WHEN** a request reaches `/auth/admin/list-users`
- **THEN** main SHALL forward the request to auth with the auth session cookie
- **AND** auth SHALL decide whether the session has the required auth admin role

### Requirement: Main-domain authorization remains in main

Any public route that mutates or authorizes main-owned state SHALL require main authorization in main, even if its public path is grouped under `/auth/*`. Main-owned state includes main DB resources, main admin state, main permission records, main session/token revocation, and main external token wallet entries.

#### Scenario: Main token wallet route is requested
- **WHEN** a request reaches an `/auth/*` route that changes a main token wallet entry
- **THEN** main SHALL authenticate and authorize the caller with `rezics-session-token` and main DB permissions before performing the mutation

### Requirement: Mixed auth and main workflows are split or orchestrated by main

Workflows that require both auth-owned and main-owned state SHALL be split into separate auth-domain and main-domain endpoints where practical. If a split is not practical, main SHALL perform main authorization and readiness checks first, then call auth internally with service context.

#### Scenario: Mixed workflow cannot be split
- **WHEN** a route must update main state and auth state in one user action
- **THEN** main SHALL authorize the main mutation before calling auth internally
- **AND** auth SHALL still enforce auth-domain policy for the auth-owned part

### Requirement: Public auth headers and redirects use public paths

Main SHALL normalize browser-visible auth response headers so cookie paths and redirect locations use public `/auth/*` paths instead of internal `/api/auth/*` paths.

#### Scenario: Auth sets cookie path
- **WHEN** auth returns a `Set-Cookie` header for the auth session
- **THEN** the browser-visible cookie path SHALL be `/auth`
- **AND** the response SHALL NOT expose `Path=/api/auth` to the browser

#### Scenario: Auth redirects after callback
- **WHEN** auth returns a redirect during a callback or sign-in flow
- **THEN** the browser-visible `Location` header SHALL point to a public main route or `/auth/*` route
- **AND** it SHALL NOT point to an internal auth service URL

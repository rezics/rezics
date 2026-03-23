## ADDED Requirements

### Requirement: Plugin factory with default policy
The `corsPolicy` function SHALL accept a default policy name and a config map, and return an Elysia plugin instance. When applied to a router via `.use()`, all descendant routes SHALL inherit the default policy.

#### Scenario: Default policy applies to all routes
- **WHEN** a router uses `corsPolicy('credentialed', configs)` and registers a GET route without a `corsPolicy` route option
- **THEN** the GET route's response SHALL include CORS headers matching the `credentialed` config (Allow-Origin, Allow-Credentials: true, Allow-Methods, Allow-Headers, Expose-Headers)

#### Scenario: Plugin does not leak to sibling routers
- **WHEN** router A uses `corsPolicy('credentialed', configs)` and router B does not use the plugin, and both are mounted on a parent router
- **THEN** router B's routes SHALL NOT receive any CORS headers from router A's plugin

### Requirement: Route-level policy override via macro
The plugin SHALL register an Elysia `macro` named `corsPolicy` that accepts a `CorsPolicyName` string. When a route declares `{ corsPolicy: '<name>' }` in its route options, the route SHALL use that policy instead of the inherited default.

#### Scenario: Route override replaces inherited default
- **WHEN** a router uses `corsPolicy('credentialed', configs)` and a route declares `{ corsPolicy: 'public' }`
- **THEN** the route's response SHALL include CORS headers matching the `public` config (no Allow-Credentials, narrower Allow-Methods)

#### Scenario: Override does not affect other routes
- **WHEN** route `/jwks` declares `{ corsPolicy: 'public' }` and route `/token` does not
- **THEN** `/token` SHALL use the inherited default policy and `/jwks` SHALL use `public`

### Requirement: Origin validation
The plugin SHALL check the request's `Origin` header against the policy config's allowed origins list. The `Access-Control-Allow-Origin` header SHALL only be set when the origin is allowed.

#### Scenario: Allowed origin receives headers
- **WHEN** a request includes `Origin: https://book.rezics.com` and the policy allows that origin
- **THEN** the response SHALL include `Access-Control-Allow-Origin: https://book.rezics.com` and `Vary: Origin`

#### Scenario: Disallowed origin receives no allow-origin header
- **WHEN** a request includes `Origin: https://evil.com` and the policy does not allow that origin
- **THEN** the response SHALL NOT include an `Access-Control-Allow-Origin` header

### Requirement: Credentialed policy includes credentials header
When the effective policy has `credentials: true`, the response SHALL include `Access-Control-Allow-Credentials: true`. When the policy has `credentials: false`, the response SHALL NOT include the `Access-Control-Allow-Credentials` header.

#### Scenario: Credentialed policy
- **WHEN** the effective policy is `credentialed` with `credentials: true`
- **THEN** the response SHALL include `Access-Control-Allow-Credentials: true`

#### Scenario: Public policy
- **WHEN** the effective policy is `public` with `credentials: false`
- **THEN** the response SHALL NOT include the `Access-Control-Allow-Credentials` header

### Requirement: Centralized preflight handling
The plugin SHALL intercept `OPTIONS` requests via an `onRequest` hook and respond with a `204 No Content` status and CORS headers from the default policy. API files SHALL NOT need to declare `.options()` routes for CORS preflight.

#### Scenario: OPTIONS request returns preflight response
- **WHEN** an `OPTIONS` request is sent to any route within the plugin's scope
- **THEN** the plugin SHALL respond with status `204` and include `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, and `Access-Control-Max-Age` headers

#### Scenario: Non-OPTIONS requests are not intercepted
- **WHEN** a `GET` request is sent to a route
- **THEN** the `onRequest` hook SHALL NOT intercept it and the request SHALL proceed to the route handler

### Requirement: CORS headers on error responses
The plugin's `onAfterHandle` hook SHALL apply CORS headers to all responses, including error responses. This ensures browsers can read error details from cross-origin requests.

#### Scenario: Error response carries CORS headers
- **WHEN** a route handler throws an error and the error response is returned
- **THEN** the response SHALL include the same CORS headers as a successful response for the effective policy

### Requirement: Shared package with injected configs
The `corsPolicy` plugin SHALL live in `@package/cors` and accept policy configs as a parameter. Each service (`package/server`, `package/auth`) SHALL provide its own config map with service-specific header lists.

#### Scenario: Server and auth use different header configs
- **WHEN** `package/server` provides configs with `x-rezics_session_token` in allowed headers and `package/auth` provides configs with `x-internal-auth-token`
- **THEN** each service's CORS responses SHALL reflect its own header configuration

### Requirement: Policy config contract
Each policy config SHALL define: `origin` (string array), `credentials` (boolean), `methods` (string array), `allowedHeaders` (string array), and `exposeHeaders` (string array).

#### Scenario: Config shape is enforced
- **WHEN** a policy config is passed to `corsPolicy`
- **THEN** it SHALL contain all five fields and the plugin SHALL use them to construct response headers

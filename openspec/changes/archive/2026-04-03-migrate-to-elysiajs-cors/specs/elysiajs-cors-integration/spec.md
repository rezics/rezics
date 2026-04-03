## ADDED Requirements

### Requirement: App-level CORS via official plugin
Each Elysia service (`package/server`, `package/auth`) SHALL use `@elysiajs/cors` with a single `cors()` call applied at the app level, before route registration.

#### Scenario: Server service applies CORS globally
- **WHEN** `package/server` starts and a browser sends a cross-origin GET request with `Origin: https://book.rezics.com`
- **THEN** the response SHALL include `Access-Control-Allow-Origin: https://book.rezics.com` and `Access-Control-Allow-Credentials: true`

#### Scenario: Auth service applies CORS globally
- **WHEN** `package/auth` starts and a browser sends a cross-origin request with an allowed origin
- **THEN** the response SHALL include matching CORS headers with credentials enabled

### Requirement: Origin allowlist per environment
Each service SHALL configure `cors()` with an explicit origin allowlist: dev origins in development, prod origins in production. The `origin` config SHALL be an array of strings.

#### Scenario: Dev origins allowed in development
- **WHEN** `NODE_ENV` is `development` and a request has `Origin: http://localhost:35001`
- **THEN** the response SHALL include `Access-Control-Allow-Origin: http://localhost:35001`

#### Scenario: Prod origins allowed in production
- **WHEN** the server runs in production and a request has `Origin: https://book.rezics.com`
- **THEN** the response SHALL include `Access-Control-Allow-Origin: https://book.rezics.com`

#### Scenario: Unknown origin rejected
- **WHEN** a request has `Origin: https://evil.com`
- **THEN** the response SHALL NOT include an `Access-Control-Allow-Origin` header

### Requirement: Credentialed CORS for all routes
The `cors()` config SHALL set `credentials: true` so browsers can send cookies and authorization headers with cross-origin requests.

#### Scenario: Credentials header present
- **WHEN** a cross-origin request is made to any route
- **THEN** the response SHALL include `Access-Control-Allow-Credentials: true`

### Requirement: Custom token headers in allowedHeaders
The `cors()` config SHALL include all token transport headers (`x-auth-context`, `x-rezics-session`, `x-notification-session`, `x-search-session`) in `allowedHeaders`, plus `content-type`, `authorization`, and `accept`.

#### Scenario: Token header allowed in preflight
- **WHEN** a preflight OPTIONS request includes `Access-Control-Request-Headers: x-rezics-session`
- **THEN** the response SHALL include `x-rezics-session` in `Access-Control-Allow-Headers`

### Requirement: Expose session header in server
The server's `cors()` config SHALL include `x-rezics-session` in `exposeHeaders` so the browser can read session tokens from responses.

#### Scenario: Session header exposed
- **WHEN** a response from `package/server` includes the `x-rezics-session` header
- **THEN** the `Access-Control-Expose-Headers` response header SHALL include `x-rezics-session`

### Requirement: Preflight handled by plugin
The `@elysiajs/cors` plugin SHALL handle OPTIONS preflight requests automatically. No custom `onRequest` hooks or `.options()` route definitions SHALL be needed.

#### Scenario: Preflight returns 204
- **WHEN** an OPTIONS request is sent to any route
- **THEN** the response SHALL have status 204 with CORS headers and a `Access-Control-Max-Age` header

### Requirement: Error responses include CORS headers
The `@elysiajs/cors` plugin SHALL ensure that error responses (4xx, 5xx) include CORS headers, so browsers can read error details from cross-origin requests.

#### Scenario: 500 error includes CORS headers
- **WHEN** a route handler throws an unhandled error
- **THEN** the error response SHALL include `Access-Control-Allow-Origin` for allowed origins

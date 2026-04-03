## ADDED Requirements

### Requirement: Token resolver plugin factory
The `@rezics/jwt` package SHALL export a `createTokenResolver` factory function from its adapters module. The factory SHALL accept a context key name (string literal), a header name, a bearer flag, and a `JwtVerifier<TPayload>` function. It SHALL return an Elysia plugin instance.

#### Scenario: Create a token resolver for a bearer token
- **WHEN** `createTokenResolver('authIdentityToken', { headerName: 'authorization', usesBearer: true, verifier })` is called
- **THEN** the returned value is a valid Elysia plugin that can be registered via `.use()`

#### Scenario: Create a token resolver for a custom header token
- **WHEN** `createTokenResolver('rezicsSessionToken', { headerName: 'x-rezics-session-token', usesBearer: false, verifier })` is called
- **THEN** the returned value is a valid Elysia plugin that can be registered via `.use()`

### Requirement: Global context injection via resolve
The plugin SHALL use Elysia `resolve` with `as: 'global'` to inject the token payload into handler context. The injected property name SHALL match the `name` argument passed to the factory.

#### Scenario: Token payload available in handler context
- **WHEN** the plugin is registered on a root Elysia instance and a downstream route handler destructures the configured key name
- **THEN** the handler receives the verified payload (or `null`) under that key name

#### Scenario: Multiple token resolvers compose independently
- **WHEN** two token resolver plugins are registered (e.g., `authIdentityToken` and `rezicsSessionToken`)
- **THEN** both keys are available in handler context simultaneously without conflict

### Requirement: Absent header produces null
The plugin SHALL NOT throw an error when the configured header is absent from the request. It SHALL inject `null` for that token's context key.

#### Scenario: Request without the configured header
- **WHEN** a request arrives without the configured header (e.g., no `Authorization` header)
- **THEN** the handler context contains `{ authIdentityToken: null }`

### Requirement: Present valid token produces verified payload
The plugin SHALL verify a present token using the configured `JwtVerifier<TPayload>` and inject the verified payload into context.

#### Scenario: Valid bearer token in Authorization header
- **WHEN** a request includes `Authorization: Bearer <valid-jwt>`
- **THEN** the plugin strips the `Bearer ` prefix, verifies the JWT, and injects the decoded payload under the configured key

#### Scenario: Valid token in custom header
- **WHEN** a request includes `x-rezics-session-token: <valid-jwt>` and `usesBearer` is false
- **THEN** the plugin passes the raw header value to the verifier and injects the decoded payload

### Requirement: Present invalid token throws authentication error
The plugin SHALL throw an error that results in a 401 response when a present token fails verification. The plugin SHALL NOT silently ignore invalid tokens.

#### Scenario: Malformed JWT in header
- **WHEN** a request includes `Authorization: Bearer not-a-jwt`
- **THEN** the plugin throws a verification error and the request fails with status 401

#### Scenario: Expired JWT in header
- **WHEN** a request includes a valid-format but expired JWT
- **THEN** the plugin throws a verification error and the request fails with status 401

### Requirement: Bearer extraction
When `usesBearer` is `true`, the plugin SHALL strip the `Bearer ` prefix from the header value before passing to the verifier. When `usesBearer` is `false`, the plugin SHALL pass the raw header value.

#### Scenario: Bearer prefix stripped
- **WHEN** `usesBearer` is `true` and the header value is `Bearer eyJhbGci...`
- **THEN** the verifier receives `eyJhbGci...` (without prefix)

#### Scenario: Raw value passed for non-bearer tokens
- **WHEN** `usesBearer` is `false` and the header value is `eyJhbGci...`
- **THEN** the verifier receives `eyJhbGci...` unchanged

### Requirement: Plugin deduplication
The plugin SHALL set an Elysia `name` and `seed` based on the configured key name to enable Elysia's built-in plugin deduplication. Registering the same token resolver twice SHALL NOT create duplicate resolvers.

#### Scenario: Duplicate registration
- **WHEN** the same `createTokenResolver('authIdentityToken', config)` is `.use()`d twice on the same Elysia instance
- **THEN** the resolver runs only once per request

### Requirement: Typed context key
The factory SHALL use TypeScript generics so that the returned plugin carries type information mapping the configured key name to `TPayload | null` in handler context.

#### Scenario: Type inference in handler
- **WHEN** a handler destructures `{ authIdentityToken }` after using a plugin created with `createTokenResolver<'authIdentityToken', AuthIdentityTokenClaims>(...)`
- **THEN** TypeScript infers `authIdentityToken` as `AuthIdentityTokenClaims | null`

### Requirement: Package export
The `createTokenResolver` factory SHALL be exported from `@rezics/jwt` root export and from the `@rezics/jwt/adapters` sub-export.

#### Scenario: Import from package root
- **WHEN** a consumer imports `{ createTokenResolver } from '@rezics/jwt'`
- **THEN** the import resolves successfully

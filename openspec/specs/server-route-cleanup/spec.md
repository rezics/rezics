# server-route-cleanup Specification

## Purpose
TBD - created by archiving change jwt-context-plugin-route-refactor. Update Purpose after archive.
## Requirements
### Requirement: Flat domain API structure
Each domain API file SHALL export a single Elysia instance created with `new Elysia({ prefix: '/<domain>' })`. The instance SHALL define all routes as a flat chain of `.get()`, `.post()`, `.put()`, `.delete()` calls with permission guards applied via `.use()` at the appropriate chain position.

#### Scenario: Book API flat structure
- **WHEN** `book.api.ts` is loaded
- **THEN** it exports a single `bookApi` Elysia instance with no inline `new Elysia()` sub-instances

#### Scenario: Route definitions are chained directly
- **WHEN** a domain API defines routes
- **THEN** all routes are chained directly on the single Elysia instance using `.get()`, `.post()`, etc., not wrapped in `.use(new Elysia()...)`

### Requirement: No inline Elysia sub-instances for auth
Domain API files SHALL NOT create `new Elysia()` sub-instances solely to apply `identityContextPlugin` or `sessionContextPlugin`. Token payloads are available globally; authorization is handled by scoped guard plugins.

#### Scenario: Protected route uses guard not wrapper
- **WHEN** a route requires authentication
- **THEN** the domain API applies `.use(requireLogin)` or `.use(requireOwner)` in the chain before the protected routes, rather than wrapping them in `new Elysia().use(sessionContextPlugin)`

### Requirement: Remove core.ts factory
The `package/server/src/core.ts` file and its `coreInstance(prefix)` factory SHALL be removed. Domain APIs SHALL create their Elysia instances directly with `new Elysia({ prefix })`.

#### Scenario: No coreInstance usage
- **WHEN** any domain API file is inspected
- **THEN** it does not import or call `coreInstance`

### Requirement: Root-level token resolver registration
The `package/server/src/index.ts` SHALL register all token resolver plugins on the root Elysia instance before mounting domain APIs. Token resolvers SHALL be initialized with startup-bootstrapped JWT service configuration.

#### Scenario: Token resolvers registered before domain APIs
- **WHEN** `index.ts` configures the root Elysia app
- **THEN** `createTokenResolver` plugins for `authIdentityToken` and `rezicsSessionToken` are `.use()`d before any `.use(domainApi)` calls

#### Scenario: Verifiers use bootstrapped config
- **WHEN** token resolver plugins are created
- **THEN** the verifier options (issuer, audience, JWKS URL) come from the resolved `bootstrapJwtServiceRecord` results, not from per-request lookups

### Requirement: Remove legacy context plugins
`identityContextPlugin` and `sessionContextPlugin` from `package/server/src/auth/context.ts` SHALL be removed. Their responsibilities are split between root-level token resolvers (JWT parsing) and scoped permission guards (authorization).

#### Scenario: No imports of legacy plugins
- **WHEN** any server source file is inspected
- **THEN** it does not import `identityContextPlugin` or `sessionContextPlugin`

### Requirement: Remove legacy verification wrappers
The `verifyAuth`, `verifyAuthIdentityToken`, `verifyAuthContextToken` functions in `package/server/src/user/util/index.ts` SHALL be removed or reduced to only what permission guards need internally. They SHALL NOT be called directly from domain API files.

#### Scenario: Domain APIs do not call verifyAuth
- **WHEN** a domain API route handler executes
- **THEN** it does not directly call `verifyAuth()` or `verifyAuthIdentityToken()`; token verification is handled by the global resolver

### Requirement: Preserve HTTP API contract
All existing HTTP endpoints SHALL maintain the same method, path, request schema, and response schema after refactoring. No route behavior visible to API consumers SHALL change.

#### Scenario: Existing API tests pass
- **WHEN** the refactoring is complete
- **THEN** all existing integration and API tests pass without modification to test assertions

### Requirement: CORS handling preserved
Domain APIs that currently use `withCredentialedCors()` SHALL maintain equivalent CORS behavior after refactoring, whether through a global CORS plugin or per-domain application.

#### Scenario: CORS preflight and credentialed requests work
- **WHEN** a cross-origin request is made to any endpoint that previously supported CORS
- **THEN** the response includes the same CORS headers as before the refactor


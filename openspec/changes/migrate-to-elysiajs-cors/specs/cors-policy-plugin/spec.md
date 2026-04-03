## REMOVED Requirements

### Requirement: Plugin factory with default policy
**Reason**: Replaced by `@elysiajs/cors` official plugin. A single `cors()` call per service replaces the custom `corsPolicy()` factory.
**Migration**: Replace `serverCorsPolicy('credentialed')` / `authCorsPolicy('credentialed')` with `cors({...})` at the app level.

### Requirement: Route-level policy override via macro
**Reason**: Per-route policy overrides are no longer needed. The `public` policy was only used on JWKS endpoints (server-to-server, CORS irrelevant) and the `internal` policy was never used.
**Migration**: Remove `{ corsPolicy: 'public' }` from route options. Routes inherit the app-level credentialed CORS.

### Requirement: Shared package with injected configs
**Reason**: The `@rezics/cors` package is deleted. Each service configures `@elysiajs/cors` directly with inline config.
**Migration**: Remove `@rezics/cors` from dependencies. Define `cors()` config inline in each service's entry point.

### Requirement: Policy config contract
**Reason**: The custom `CorsPolicyConfig` and `CorsPolicyName` types are replaced by `@elysiajs/cors`'s built-in config type.
**Migration**: Remove imports of `CorsPolicyConfig`, `CorsPolicyName`, `applyCorsToSet` from all files.

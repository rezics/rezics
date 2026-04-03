# cors-policy-plugin Specification

## Status
DEPRECATED - All requirements removed by change `migrate-to-elysiajs-cors`. Superseded by `elysiajs-cors-integration`.

## Purpose
Custom CORS policy plugin factory for Elysia services. Provided route-level policy overrides via macros and a shared `@rezics/cors` package with injected configs.

## Requirements
All requirements have been removed. See `elysiajs-cors-integration` for the replacement spec.

### Removed: Plugin factory with default policy
**Removed by**: migrate-to-elysiajs-cors
**Reason**: Replaced by `@elysiajs/cors` official plugin. A single `cors()` call per service replaces the custom `corsPolicy()` factory.

### Removed: Route-level policy override via macro
**Removed by**: migrate-to-elysiajs-cors
**Reason**: Per-route policy overrides are no longer needed. The `public` policy was only used on JWKS endpoints (server-to-server, CORS irrelevant) and the `internal` policy was never used.

### Removed: Origin validation
**Removed by**: migrate-to-elysiajs-cors
**Reason**: Handled natively by `@elysiajs/cors` origin config.

### Removed: Credentialed policy includes credentials header
**Removed by**: migrate-to-elysiajs-cors
**Reason**: Handled natively by `@elysiajs/cors` credentials config.

### Removed: Centralized preflight handling
**Removed by**: migrate-to-elysiajs-cors
**Reason**: Handled natively by `@elysiajs/cors` plugin.

### Removed: CORS headers on error responses
**Removed by**: migrate-to-elysiajs-cors
**Reason**: Handled natively by `@elysiajs/cors` plugin.

### Removed: Shared package with injected configs
**Removed by**: migrate-to-elysiajs-cors
**Reason**: The `@rezics/cors` package is deleted. Each service configures `@elysiajs/cors` directly with inline config.

### Removed: Policy config contract
**Removed by**: migrate-to-elysiajs-cors
**Reason**: The custom `CorsPolicyConfig` and `CorsPolicyName` types are replaced by `@elysiajs/cors`'s built-in config type.

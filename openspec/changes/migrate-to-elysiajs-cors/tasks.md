## 1. Add dependency

- [x] 1.1 Add `@elysiajs/cors` to `package/server/package.json` and `package/auth/package.json`, then run `bun install`

## 2. Migrate package/server

- [x] 2.1 Add `cors()` call in `package/server/src/index.ts` — configure with `origin` (allowedOrigins), `credentials: true`, `methods`, `allowedHeaders` (including token transport headers), `exposeHeaders: ['x-rezics-session']`, `maxAge: 600`
- [x] 2.2 Remove `applyCorsToSet` import and the manual CORS fallback from `package/server/src/index.ts` `onError` handler
- [x] 2.3 Remove `serverCorsPolicy` usage from `package/server/src/token/token.api.ts` (`tokenExternalRoutes`)
- [x] 2.4 Remove `corsPolicy: 'public'` route option from `package/server/src/session/session.api.ts`
- [x] 2.5 Remove any remaining `serverCorsPolicy` imports across `package/server/src/`
- [x] 2.6 Delete `package/server/src/middleware/cors.ts` and update `package/server/src/middleware/index.ts` exports

## 3. Migrate package/auth

- [x] 3.1 Add `cors()` call in `package/auth/src/index.ts` — configure with auth-specific `allowedHeaders` (including `x-internal-auth-token` and token transport headers), `credentials: true`, `maxAge: 600`
- [x] 3.2 Remove `applyCorsToSet` import and the manual CORS fallback from `package/auth/src/index.ts` `onError` handler
- [x] 3.3 Remove `corsPolicy: 'public'` route option from `package/auth/src/openapi/session.ts`
- [x] 3.4 Delete `package/auth/src/cors/index.ts` and remove any related exports

## 4. Delete @rezics/cors package

- [x] 4.1 Delete `package/cors/` directory entirely (plugin, headers, types, tests, package.json)
- [x] 4.2 Remove `@rezics/cors` from workspace references in root `package.json` (if listed)
- [x] 4.3 Run `bun install` to update lockfile

## 5. Verify

- [x] 5.1 Run `bun run build` (or type-check) in `package/server` and `package/auth` — confirm no type errors from removed imports
- [x] 5.2 Grep the repo for any remaining references to `@rezics/cors`, `@package/cors`, `applyCorsToSet`, `serverCorsPolicy`, `authCorsPolicy`, `corsPolicy` macro usage — confirm zero hits
- [x] 5.3 Test CORS manually or via existing tests: confirm preflight 204, allowed origin gets headers, disallowed origin doesn't, error responses include CORS headers

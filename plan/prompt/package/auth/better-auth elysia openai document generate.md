# Generate Better-Auth OpenAPI Documentation via Elysia

## Context

The auth service is built on **better-auth** and **Elysia**. Currently, **OpenAPI documentation does not exist** because Elysia routes do not define `schema` (body, query, response) or `detail` (summary, description) for the OpenAPI plugin. All auth traffic is handled by a single catch-all (e.g. `.all('/api/auth/*', ...)`) that forwards to `auth.handler(request)`, so the OpenAPI plugin has nothing to document.

## Goal

Produce **complete OpenAPI documentation** for every better-auth endpoint by:

1. **Adding Elysia route definitions** that both document and proxy to better-auth: each documented route must declare request/response schemas and `detail`, and its handler must call the same better-auth handler (e.g. `auth.handler(request)`).
2. **Placing shared schemas** in `package/contract` under the `auth` folder (multiple files allowed; e.g. `package/contract/src/auth/index.ts` and optional files like `sign-in.ts`, `session.ts`).
3. **Keeping the Elysia router in a separate file** inside `package/auth` (e.g. `elysia-router.ts` or `auth-elysia-router.ts`), so the “documentation layer” is clear and maintainable.

## Requirements

### 1. Coverage

- **Every** better-auth handler/endpoint that the app uses must have a **matching explicit Elysia route** used purely for documentation (with full schema and `detail`).
- Features to cover include (but are not limited to): email/password sign-in, sign-up, sign-out, session (get/list), OAuth flows (e.g. callback), admin plugin endpoints, organization plugin endpoints (invitations, members, etc.), and any custom or plugin-added routes under `/api/auth`.
- After all documented routes, add a **single catch-all** so any path/method not explicitly defined still goes to better-auth (e.g. `.all('/*', ({ request }) => auth.handler(request))`).

### 2. Route structure and pattern

Use this pattern for each documented route:

- **Explicit route first**: define method and path (e.g. `POST /sign-in`), with `body`, `query`, and/or `response` schemas and `detail`.
- **Handler**: call the same better-auth entrypoint (e.g. `auth.handler(request)`) so behavior is unchanged; the route exists so Elysia/OpenAPI can generate docs from the schema and `detail`.
- **Catch-all last**: one `.all('/*', ({ request }) => auth.handler(request))` so any undocumented or frequently-changing better-auth endpoint still works.

Example:

```ts
import { Elysia, t } from 'elysia'
import { auth } from './auth'

export const authRouter = new Elysia({ prefix: '/api/auth' })
  // 1. Documented route: schema + detail; handler delegates to better-auth
  .post('/sign-in', ({ request }) => auth.handler(request), {
    body: t.Object({
      email: t.String({ format: 'email' }),
      password: t.String({ minLength: 8 })
    }),
    response: t.Object({
      user: t.Object({
        id: t.String(),
        email: t.String()
      }),
      token: t.String()
    }),
    detail: {
      summary: 'User sign-in',
      description: 'Authenticate with email and password. Returns user and token on success.',
      tags: ['Authentication']
    }
  })
  // 2. Catch-all for undocumented or changing endpoints
  .all('/*', ({ request }) => auth.handler(request))
```

### 3. Schemas and types

- **Request**: define `body` and/or `query` with Elysia `t.*` schemas for every documented route. Use accurate types (e.g. `format: 'email'`, `minLength`, optional fields) so the generated OpenAPI is correct.
- **Response**: define `response` with `t.Object` (or unions/arrays as needed) for success responses. Ensure all fields used in examples or by clients are included and typed.
- **Reuse**: put **shared/auth schemas** in `package/contract/src/auth/`. You may split by domain (e.g. `sign-in.ts`, `session.ts`, `organization.ts`) and re-export from `package/contract/src/auth/index.ts`. Import these schemas in the Elysia router so types and docs stay in sync.

### 4. OpenAPI `detail` (Elysia OpenAPI plugin)

Follow the [Elysia OpenAPI plugin](https://elysiajs.com/plugins/openapi.html#openapi-plugin) conventions:

- **`detail.summary`**: Short, one-line description of what the operation does (e.g. “User sign-in”, “Get current session”).
- **`detail.description`**: Longer explanation of behavior, parameters, and semantics where helpful.
- **`detail.tags`**: Use consistent tags (e.g. `['Authentication']`, `['Session']`, `['Organization']`) for grouping in the OpenAPI UI.
- Add other operation-level fields as needed (e.g. `deprecated`, `operationId`) for a complete spec.

### 5. File layout

- **Elysia router**: `package/auth/src/elysia-router.ts` (or `auth-elysia-router.ts`) — one or more Elysia instances that define the documented routes and the catch-all, all delegating to `auth.handler(request)`.
- **Contract/schemas**: `package/contract/src/auth/` — multiple files allowed (e.g. `index.ts`, `sign-in.ts`, `session.ts`, `organization.ts`); export from `index.ts` and use in the auth package router.

### 6. Integration with existing app

- The main app (e.g. `package/auth/src/index.ts`) should mount the Elysia auth router (or merge its routes) so that:
  - The same prefix (e.g. `/api/auth`) is used.
  - OpenAPI plugin (e.g. `@elysiajs/openapi`) sees these routes and generates the spec and UI.
  - No duplicate or conflicting route handling; the catch-all ensures any better-auth path not explicitly documented still works.

## Output

Deliver:

1. **Contract schemas** under `package/contract/src/auth/` (and any new files there) with full Elysia `t.*` types for all documented auth operations.
2. **Elysia router file(s)** in `package/auth` that define every better-auth endpoint with body/query/response and `detail`, plus the final `.all('/*', ...)` fallback.
3. **Integration** in the auth app so the router is used and OpenAPI shows complete auth API documentation.

All type definitions and OpenAPI-related fields must be **complete and consistent** with the Elysia OpenAPI plugin so the generated document is accurate and usable.

## Why

Backend Prisma errors (e.g. `findUniqueOrThrow` not-found) are not intercepted by the global Elysia error handler, which only recognizes `AppError`. This causes all unhandled Prisma errors to return HTTP 500 regardless of the actual failure reason. On the frontend, 500 responses trigger TanStack Query's retry logic (up to 2 additional attempts), creating a prolonged loading state before the error surfaces — and when it does, it renders as raw `String(error)` or `JSON.stringify` output with no structure. As an open-source project, we want to expose technical details transparently for debugging while keeping the error presentation clean and consistent.

## What Changes

- Intercept `PrismaClientKnownRequestError` in the global Elysia `onError` handler and map error codes (P2025, P2002, P2003, etc.) to appropriate HTTP status codes (404, 409, 400)
- Extend the error response shape with an optional `detail` field carrying structured technical metadata (Prisma error code, model name, operation)
- Replace the `new Error(JSON.stringify(...))` pattern in `@rezics/api` with a typed `ApiError` class that preserves structured fields (`status`, `code`, `message`, `detail`)
- Simplify TanStack Query retry logic to use `ApiError.status` directly instead of `JSON.parse(error.message)`
- Create a shared `<QueryErrorDisplay>` component that renders errors inline with a collapsible "Technical details" section
- Replace all ad-hoc error rendering patterns (`String(error)`, `error.message`, hardcoded strings) across pages with `<QueryErrorDisplay>`

## Capabilities

### New Capabilities

- `backend-prisma-error-mapping`: Intercept and map Prisma errors to structured HTTP responses in the global Elysia error handler
- `api-error-class`: Typed `ApiError` class in `@rezics/api` replacing JSON-stringified error messages
- `query-error-display`: Shared inline error component with collapsible technical details

### Modified Capabilities

_(none — no existing spec-level requirements are changing)_

## Impact

- **`package/server`**: Global `onError` handler in `index.ts`, `utils/errors.ts`. Manual P2025 handling in `jwt.admin.api.ts` can be removed.
- **`package/api`**: `react-query/http.ts` (ApiError class + throw), `react-query/tsr.ts` (retry logic simplification)
- **`package/app`**: New shared component, updates to ~15+ pages/sections that currently render errors ad-hoc
- **`package/ui` or `package/app`**: Home for `<QueryErrorDisplay>` (app-level, not shared UI — it depends on TanStack Query error shape)
- **Backward compatibility**: Error response gains a new `detail` field (additive). Existing `status`/`code`/`message` fields unchanged. Frontend changes are internal refactors.

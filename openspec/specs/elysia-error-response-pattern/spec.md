# elysia-error-response-pattern Specification

## Purpose

Defines the Elysia handler convention that makes multi-status
routes type-check cleanly. Owns the rule that `status` is
destructured from the handler context (never imported from
`elysia`), the multi-status `response: { 200, 403, … }` object
format for any route with error branches, the flat
`response: schema` exception for success-only routes, and the
specific admin/user/stats/jwt/chapter files that adopt the
pattern.

## Requirements

### Requirement: Status from handler context
All Elysia route handlers that return non-200 status codes SHALL destructure `status` from the handler's context parameter, not import it from the `elysia` package.

```ts
// Correct:
.get("/", ({ status }) => { return status(403, "Forbidden"); })

// Incorrect:
import { status } from "elysia";
.get("/", () => { return status(403, "Forbidden"); })
```

#### Scenario: Handler returns 403 with correct typing
- **WHEN** a route handler returns `status(403, "Forbidden")` using context-destructured `status`
- **THEN** TypeScript correctly infers the handler return type as `SuccessType | ElysiaStatusResponse<403>`

### Requirement: Multi-status response declaration
All Elysia route handlers that can return error status codes SHALL declare their `response` option using the object format keyed by status code.

```ts
{
  response: {
    200: successSchema,
    403: t.String(),
  }
}
```

Single-status routes (no error branches) MAY continue using the flat `response: schema` format.

#### Scenario: Route with admin guard compiles without type error
- **WHEN** a route handler checks admin permission and returns `status(403, ...)` on failure
- **AND** the response option declares both `200` and `403` schemas
- **THEN** `tsc --noEmit` produces zero errors for this handler

#### Scenario: Route without error branches keeps flat format
- **WHEN** a route handler always returns a success response with no conditional error branches
- **THEN** the flat `response: schema` format is acceptable and produces zero type errors

### Requirement: Affected route files
The following files SHALL be updated to use the multi-status response pattern:
- `package/server/src/user/api/user.admin.api.ts`
- `package/server/src/user/api/user.core.api.ts`
- `package/server/src/stats/stats.admin.api.ts`
- `package/server/src/jwt/jwt.admin.api.ts`
- `package/server/src/chapter/chapter.api.ts`

#### Scenario: All admin routes compile cleanly
- **WHEN** `tsc --noEmit` is run on `package/server`
- **THEN** no errors related to `ElysiaCustomStatusResponse` or `InlineHandler` type mismatch appear in any of the listed files

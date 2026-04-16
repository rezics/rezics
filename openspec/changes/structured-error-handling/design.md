## Context

The Elysia global `onError` handler (`package/server/src/index.ts:109-122`) only recognizes `AppError` instances. Prisma errors (`PrismaClientKnownRequestError`) fall through to the default branch, returning HTTP 500 with a raw error message. On the frontend, `apiFetchResponse` (`package/api/src/react-query/http.ts:78-84`) wraps the error response into `new Error(JSON.stringify({status, message}))`, forcing all downstream consumers to `JSON.parse(error.message)` to access structured data. Error display across ~15+ pages uses at least 6 different ad-hoc patterns.

**Current error flow:**
```
Prisma throws → service (no catch) → api handler (no catch) → onError: not AppError → 500
  → frontend: JSON.stringify into Error.message → retry 2x (500 not in 4xx range) → raw render
```

## Goals / Non-Goals

**Goals:**
- Map Prisma errors to semantically correct HTTP status codes at the global handler level
- Include structured technical metadata (`detail.prisma`) in error responses for open-source transparency
- Provide a typed `ApiError` class so frontend code can access error fields without JSON parsing
- Create a single reusable `<QueryErrorDisplay>` component for inline error rendering with collapsible technical details
- Eliminate ad-hoc error rendering across all pages

**Non-Goals:**
- Custom error pages (404 page, 500 page) — this is about API error responses and inline query error display
- Error monitoring/logging infrastructure (Sentry, etc.)
- Mutation error handling UI (toast/snackbar) — only query errors are in scope
- Changing `AppError` semantics or existing manually-handled error paths beyond cleanup

## Decisions

### 1. Global Prisma error interception in `onError` handler

**Decision:** Add a `PrismaClientKnownRequestError` branch to the existing `onError` handler in `index.ts`, mapping known error codes to HTTP status codes.

**Mapping:**
| Prisma Code | HTTP Status | Meaning |
|-------------|-------------|---------|
| P2025 | 404 | Record not found |
| P2002 | 409 | Unique constraint violation |
| P2003 | 400 | Foreign key constraint violation |
| P2014 | 400 | Required relation violation |
| Other P-codes | 500 | Unmapped — include prisma code in detail |

**Why global handler, not per-service try-catch:** Every service with `findUniqueOrThrow`, `update`, `delete` etc. would need identical catch blocks. The global handler is one place, covers all domains, and the existing manual P2025 handling in `jwt.admin.api.ts` can be removed.

**Alternative considered:** Prisma middleware / client extension to wrap errors before they leave the ORM layer. Rejected because it couples error semantics to the ORM rather than the HTTP layer, and Elysia's `onError` is the natural place for HTTP status mapping.

### 2. Error response shape with `detail` field

**Decision:** Extend the response with an optional namespaced `detail` object:

```typescript
interface ErrorResponse {
  status: number;
  code: string;             // Elysia error code (UNKNOWN, VALIDATION, NOT_FOUND, etc.)
  message: string;          // Human-readable message
  detail?: {
    prisma?: {
      code: string;         // "P2025"
      model?: string;       // "Book"
      operation?: string;   // "findUniqueOrThrow"
      target?: string[];    // ["userId", "name"] for unique constraint
    };
  };
}
```

**Why namespaced under `detail.prisma`:** Future error sources (Meilisearch, external APIs) can add their own namespace without collision. The `detail` field is omitted entirely for non-Prisma errors, keeping the response clean.

**Security boundary:** Include `code`, `model`, `operation`, and `target` (field names). Exclude: raw SQL queries, where-clause values, connection strings, stack traces. Since the codebase is open-source, schema structure is already public — field names are safe to expose.

### 3. Typed `ApiError` class in `@rezics/api`

**Decision:** Replace `new Error(JSON.stringify({...}))` with a proper error class:

```typescript
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly detail?: ErrorResponse['detail'],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

**Impact on retry logic:** `tsr.ts` retry function simplifies from `JSON.parse(error.message)` to `error instanceof ApiError ? error.status : 0`. The retry semantics stay the same (no retry on 4xx except 408), but the code becomes type-safe.

**Alternative considered:** Keep `Error` with a structured `cause` field (`new Error(msg, { cause: {status, detail} })`). Rejected because `cause` is not strongly typed and requires casting everywhere.

### 4. `<QueryErrorDisplay>` component in `package/app`

**Decision:** Place the component in `package/app/src/core/component/QueryErrorDisplay.tsx`. It is app-level, not `@rezics/ui`, because it depends on `ApiError` from `@rezics/api`.

**Rendering approach:** Inline replacement (not overlay/toast). When a query fails, the component replaces where the data would have been. Design:

```
┌──────────────────────────────────────────┐
│  ⚠  {message}                            │   ← human-readable
│                                          │
│  ▸ Technical details                     │   ← collapsible, closed by default
│    Prisma P2025                          │
│    Model: Book                           │
│    Operation: findUniqueOrThrow          │
│    HTTP 404                              │
└──────────────────────────────────────────┘
```

Uses MUI `Alert` (severity="error") with a `Collapse` for technical details. Consistent with existing MUI usage in auth pages.

**Props:**
```typescript
interface QueryErrorDisplayProps {
  error: Error | null;       // from useQuery's error field
  className?: string;
}
```

The component internally checks `error instanceof ApiError` to extract structured fields. For non-ApiError errors, it falls back to `error.message`.

### 5. Incremental page migration

**Decision:** Replace all ad-hoc error patterns across pages with `<QueryErrorDisplay error={error} />`. This is a mechanical find-and-replace — each page keeps its own `if (error) return <QueryErrorDisplay error={error} />` pattern. No error boundaries, no global wrappers.

## Risks / Trade-offs

- **[Prisma version coupling]** Extracting `meta.modelName` from `PrismaClientKnownRequestError` depends on Prisma's error structure. → Mitigation: Access fields defensively with optional chaining; the `detail` field is optional so degradation is graceful.
- **[Incomplete mapping]** Some Prisma error codes may not have obvious HTTP status mappings. → Mitigation: Unmapped codes default to 500 but still include `detail.prisma.code` for debugging.
- **[Migration breadth]** ~15+ files need error display updates. → Mitigation: Each file change is trivial (replace 1-3 lines with `<QueryErrorDisplay>`), and can be done incrementally without breaking existing behavior.

## Context

The monorepo has a contract-first architecture where `@rezics/contract` defines Typebox schemas shared between `package/server` (Elysia API) and `package/api` (frontend TanStack Query client). The intended data flow is:

```
Prisma DB → Server (minimal transform) → Wire JSON → api package (type derivation) → App components
```

**Current state**: Server-side mappers (`unit/mapper.ts`, `book/mapper.ts`, `realm/mapper.ts`, etc.) exist in every domain, performing field-by-field copying with extensive `as` casts to bridge the gap between Prisma's output types and Contract DTO types. These mappers:
- Add ~20 `as` casts per domain
- Consume runtime CPU for what is essentially a no-op transformation (the wire output is already Prisma-shaped)
- Create a maintenance burden where every schema change requires updating both the Contract and the mapper

**Root cause**: The Contract DTO types diverge from Prisma's native output in 4 places:
1. `Json?` → `Record<string, any>` (Prisma's `JsonValue` is wider)
2. `string` → `Language` literal union (Prisma doesn't narrow `varchar`)
3. `Date` → `string | Date` (Elysia serializes automatically)
4. `User` → `PublicUser` (security field stripping)

Of these, only #4 requires actual transformation. #1 needs concrete schemas. #2 uses a justified `as` cast. #3 is a non-issue (Elysia handles it).

## Goals / Non-Goals

**Goals:**
- Eliminate server-side mappers for all domains except security field stripping
- Define concrete Typebox schemas for every `Json` field consumed by the frontend
- Establish `package/api` as the single source of truth for frontend types
- Fix all ~100 TypeScript errors across server and app packages
- Standardize Elysia error response patterns across all route handlers
- Fix Meilisearch pagination type usage

**Non-Goals:**
- Changing the database schema or running migrations
- Changing the actual wire format (JSON responses stay the same)
- Refactoring frontend component architecture
- Adding runtime validation of Prisma output (trust the DB)
- Changing how `package/admin` consumes types (out of scope for now)

## Decisions

### Decision 1: Contract DTOs match Prisma select output

Contract schemas describe "what the backend actually returns." They are shaped to match the Prisma query result after `include`/`select`, with two accepted deviations:

- `language` fields use the `Language` literal union (server applies `as Language` at the Prisma boundary — this is a justified cast for DB type simplification)
- `User` relations use `PublicUser` schema (server uses Prisma `select` to strip sensitive fields at query time, not via post-query mapper)

**Alternative considered**: Define two layers in Contract (raw + derived). Rejected — adds complexity for no benefit since the wire format is already Prisma-shaped.

### Decision 2: Every consumed Json field gets a concrete schema

Any `Json`/`Json?` field accessed by frontend code MUST have a dedicated Typebox schema in `@rezics/contract`. Unconsumed Json fields use `t.Optional(t.Any())`.

The concrete schemas are:
- `postExtraSchema`: `{ rating?: number, title?: string, book?: { id: string, title: string } }`
- `shelfExtraSchema`: `{ viewMode?: ShelfView }`
- `bookExtraSchema`: `{ publishURL?: string }`
- `bookIndexSchema`: `ChapterNode[]` (array of chapter tree nodes)
- `scoreDistributionSchema`: `Record<string, number>`
- `scoreFieldsSchema`: `Record<string, number>`
- `apiTokenScopesSchema`: `Record<string, string[]>`

**Alternative considered**: Use `t.Record(t.String(), t.Any())` for all Json fields. Rejected — loses type safety at the frontend consumption point, defeats the purpose of contract-first design.

### Decision 3: User field stripping via Prisma select, not mapper

Replace `sanitizeUser()` mapper calls with a Prisma `select` clause:

```ts
export const publicUserSelect = {
  unitId: true,
  name: true,
  slug: true,
  avatar: true,
  bio: true,
  description: true,
  followersCount: true,
  followingsCount: true,
} satisfies Prisma.UserSelect;
```

Domain `include` clauses use `user: { select: publicUserSelect }` instead of `user: true` + post-query `sanitizeUser()`.

**Alternative considered**: Keep `sanitizeUser()` mapper. Rejected — Prisma `select` is more performant (doesn't fetch unused columns) and the type naturally matches `PublicUser` without casts.

### Decision 4: Elysia status() from context with multi-status response

All route handlers that can return error status codes:
1. Destructure `status` from the handler context parameter (not import from `elysia`)
2. Declare response as `{ 200: successSchema, 403: t.String(), ... }` object format

This ensures Elysia's type inference correctly handles the union of success and error return types.

### Decision 5: Frontend types live in api package only

`package/api` is the single source of frontend types:
- Re-exports Contract types (wire shapes)
- Defines derived types (`FormData`, `Filters`, `View`)
- TanStack Query `select` transforms provide component-level types with automatic inference

`package/app` does NOT define domain types in `model/types.ts`. Component-local prop types stay in component files.

### Decision 6: Meilisearch uses estimatedTotalHits

All Meilisearch search calls use `offset`/`limit` (infinite pagination mode), so the SDK returns `estimatedTotalHits`, not `totalHits`. Update all search service functions to read `estimatedTotalHits`.

## Risks / Trade-offs

**[Risk] Removing mappers may expose unexpected Prisma fields in API responses**
→ Mitigation: The `User → PublicUser` stripping (the only security-sensitive case) is handled via Prisma `select`, which is even more secure than a mapper (fields never leave the DB). Other models don't have sensitive fields — `extra`, `translations`, etc. are all user-facing data.

**[Risk] Concrete Json schemas may not cover all actual data shapes**
→ Mitigation: Audit actual `extra` field writes in the codebase before defining schemas. Use `t.Optional()` liberally — the schema describes "what might be there", not "what must be there."

**[Risk] Large number of files changed across 4 packages**
→ Mitigation: Execute in phases — Contract first (no downstream breaks until server catches up), then server, then api, then app. Each phase is independently committable.

**[Trade-off] `as Language` cast at Prisma boundary**
→ Accepted: Prisma cannot narrow `varchar` to a literal union. The cast is justified, minimal (one per query site), and close to the data source. The alternative (using `string` everywhere) loses valuable frontend type safety.

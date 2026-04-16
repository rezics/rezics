## Why

The codebase currently has ~100 TypeScript errors across `package/server` and `package/app`, the majority caused by a fundamental mismatch between how types flow from Prisma through the server to the frontend. Server-side mappers use extensive `as` casts to force Prisma output into Contract DTO shapes, frontend pages access properties (`unit.title`, `unit.content`, `unit.metadata`) that don't exist on the DTO, and Elysia route handlers have incorrect error response typing. This migration aligns the type system end-to-end so types flow naturally without type gymnastics.

## What Changes

### Contract layer (`package/contract`)
- **BREAKING**: Relax Contract DTOs to closely match Prisma's native output shape (the contract describes "what the backend actually returns", not an idealized frontend shape)
- `language` fields remain as the literal union type (`"zh-hant" | "en" | ...`) — the backend uses `as Language` at the Prisma boundary, which is an accepted cast for DB simplification
- Define concrete schemas for every `Json` field that is consumed by the frontend:
  - `Post.extra` → `{ rating?: number, title?: string, book?: {...} }`
  - `Shelf.extra` → `{ viewMode?: ShelfView }`
  - `Book.extra` → `{ publishURL?: string }`
  - `BookIndex.index` → `ChapterNode[]`
  - `ScoreAggregate.distribution` → `Record<string, number>`
  - `ScoreEntry.fields` → `Record<string, number>`
  - `ApiToken.scopes` → `Record<string, string[]>`
- Json fields with no frontend consumer remain `t.Optional(t.Any())`
- Remove `QuoteDTO` references (type does not exist in contract)

### Server layer (`package/server`)
- Remove all domain mappers that only exist to reshape Prisma output into DTO form (e.g., `unit/mapper.ts`, `book/mapper.ts`, `realm/mapper.ts`, `link/mapper.ts`, `shelf/shelf.mapper.ts`)
- The **only** server-side transformation that remains is `User → PublicUser` for security field stripping, implemented via Prisma `select` instead of `sanitizeUser()` mapper where possible
- Fix Elysia `status()` usage across all route handlers:
  - Destructure `status` from handler context (not import from `elysia` package)
  - Declare `response: { 200: successSchema, 403: t.String() }` format for multi-status routes
- Fix Meilisearch search calls: use `estimatedTotalHits` for `offset/limit` queries (not `totalHits`, which is only available with `hitsPerPage/page` finite pagination)
- Fix `chapter/` domain: it uses old Unit model assumptions (`unit.title`, `unit.content`, `unit.tags` as direct fields) — must use `translations[]` pattern

### API package (`package/api`)
- Becomes the **single source of truth** for frontend-consumed types
- Re-exports Contract types plus defines frontend-specific derived types (`FormData`, `Filters`, `View`, select-transformed shapes)
- TanStack Query `select` provides automatic type inference for derived shapes — no manual type annotations needed

### App layer (`package/app`)
- Fix all pages that access non-existent properties on `UnitDTO` (`title`, `content`, `metadata`, `tags`) — access through `translations[]` or `extra`
- Remove empty/unused `model/types.ts` files — frontend types come from `@rezics/api`
- Fix route references (e.g., `/shelf/$unitId` → `/shelf/$shelfId`)
- Remove tests referencing deleted exports (`establishBusinessSession`, `AUTH_CONTEXT`)
- Fix `reactionApi.summaryBatch` → `reactionApi.summary` (method doesn't exist)

## Capabilities

### New Capabilities
- `typed-json-fields`: Concrete Typebox schemas for all `Json`/`Json?` Prisma fields that have frontend consumers
- `elysia-error-response-pattern`: Standardized multi-status response declaration for Elysia route handlers

### Modified Capabilities
- `content-search-contract`: Meilisearch service functions switch from `totalHits` to `estimatedTotalHits` for offset/limit pagination mode

## Impact

- **Affected packages**: `package/contract`, `package/server`, `package/api`, `package/app`
- **Breaking changes**: Contract DTO shapes change (fields may be renamed/restructured to match Prisma output). `package/api` consumers that directly reference Contract types will see type changes.
- **No database migration needed** — this is purely a TypeScript type alignment, no runtime data changes
- **No API wire format changes** — the JSON responses were already Prisma-shaped in practice; the Contract types are being corrected to match reality
- **Backward compatibility**: Since Contract types are internal (no external API consumers), breaking changes are contained within the monorepo. All downstream type errors will be fixed as part of this migration.

## Why

The platform needs to serve distinct user communities (light novel readers, galgame/ADV/SLG players, published book collectors) with targeted experiences, while also supporting time-bound promotional events (e.g., "Spring Book Sale"). Currently, `/book` and `/game` are hardcoded infrastructure routes with bespoke homepages and search. There is no general-purpose mechanism to create a scoped, filtered entry point for a subset of content. Meanwhile, the existing search feature is fragmented — each domain (`/book/search`, `/realm/search`, `/shelf/search`, `/review/search`) has its own search UI with inconsistent capabilities, and there is no unified advanced search. Introducing zones requires a unified search system, and the search system benefits from zones as pre-applied filter contexts. The two features are tightly coupled and should ship together.

## What Changes

### Zone System
- Add `ZONE` to the `UnitType` enum — zones are first-class units with slug, translations, and visibility
- Create a `Zone` extension model storing: filter criteria (`Json`), template identifier (`String`), styling overrides (`Json?`), and lifecycle timestamps (`startsAt`/`endsAt`, both nullable)
- Zone lifecycle (`startsAt`/`endsAt`) is an independent access-control mechanism orthogonal to `Unit.visibility` — a public zone outside its lifecycle window is inaccessible; a private zone within its lifecycle is still restricted by visibility rules
- Add backend CRUD API for zone management (admin)
- Add backend zone resolution endpoint (fetch zone config by slug, enforce lifecycle)
- Add frontend routes: `/zone/:slug` (homepage), `/zone/:slug/search` (search), `/z/:slug` and `/z/:slug/search` (short aliases)
- Add zone feature in `package/app/src/zone/` with `template/` subfolder — each template file is named by its slug (e.g., `book.tsx`, `game.tsx`, `default.tsx`), composes sections from existing features (`book-library`, `home`), and accepts zone config (filters, styling) as props
- Hardcoded routes (`/book`, `/game`) remain untouched — they are infrastructure, not zones

### Unified Search
- Redesign the `search` feature in `package/app/src/search/` as the single source of truth for all search UI
- Provide two modes from the same core: **basic search** (clean, minimal — keyword + hidden pre-applied filters) and **advanced search** (full filter panel exposing all `ContentSearchOptions` dimensions)
- Add a global `/search` route as the direct entry to advanced search with no pre-applied filters
- Context routes (`/book/search`, `/zone/:slug/search`, etc.) use the shared search components with their respective pre-applied filters
- Implement StackOverflow-style search syntax: `[tag-slug] type:book lang:ja keyword` — parsed on the frontend, structured query sent to the backend
- Search syntax contract (structured `SearchQuery` type) defined in `@rezics/contract`; string parsing is a frontend concern

### SlugRef API Pattern
- **BREAKING** (additive): Extend `ContentSearchOptions` to accept tags as `Array<{ slug: string; unitId?: string }>` instead of (or alongside) `tagIds: string[]`
- Backend resolves slug → unitId when `unitId` is absent; uses `unitId` directly when provided for maximum performance
- This pattern (`SlugRef`) establishes a reusable convention for referencing units by slug-or-id throughout the API

## Capabilities

### New Capabilities
- `zone-model`: Zone as a Unit type with extension table — data model, lifecycle, filters, admin CRUD, and resolution API
- `zone-frontend`: Zone routes, template system, homepage rendering, and styling customization
- `search-query-syntax`: StackOverflow-style search string syntax — contract types and frontend parser
- `slug-ref`: SlugRef pattern (`{ slug, unitId? }`) for unit references in API contracts

### Modified Capabilities
- `content-search-contract`: Tag filter field evolves from `tagIds: string[]` to `tags: SlugRef[]`; new `SearchQuery` structured type added for search syntax
- `app-search-feature`: Redesigned as unified search with basic/advanced modes, zone filter integration, and search syntax support

## Impact

### Affected Packages
- `@rezics/server` — Prisma schema (new `Zone` model, `ZONE` unit type), zone API routes, zone service, search service updates for SlugRef resolution
- `@rezics/contract` — `ZoneDTO`, `ZoneFilters`, `SlugRef` type, `SearchQuery` type, `ContentSearchOptions` extension
- `@rezics/api` — Zone query hooks, updated search query hooks
- `@rezics/app` — New `zone` feature (model, hooks, state, component, section, template, page), redesigned `search` feature, new routes (`/zone/:slug`, `/z/:slug`, `/search`)
- `@rezics/admin` — Zone management UI (CRUD for zones)
- `@rezics/search` — MeiliSearch filter building updated for SlugRef resolution

### Backward Compatibility
- `tagIds: string[]` should be preserved alongside the new `tags: SlugRef[]` field during a transition period; the backend accepts both, preferring `tags` when present
- Existing `/book/search` and other domain search routes continue to work; they will be progressively migrated to use the shared search components
- No existing routes are removed or redirected

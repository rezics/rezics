## 1. Contract: SlugRef and Search Types

- [ ] 1.1 Define `SlugRef` Typebox schema in `package/contract/src/common/slug-ref.ts` — `{ slug: string; unitId?: string }`
- [ ] 1.2 Add `tags: SlugRef[]` field to `ContentSearchOptionsSchema` in `package/contract/src/meili/content.ts`, alongside existing `tagIds`
- [ ] 1.3 Define `ZoneFilters` Typebox schema in `package/contract/src/zone.ts` — subset of `ContentSearchOptions` (type, tags, realmId, nsfw, isLicensed, languages)
- [ ] 1.4 Define `ZoneDTO` Typebox schema in `package/contract/src/zone.ts` — slug, name, description, filters, template, styling, startsAt, endsAt
- [ ] 1.5 Define `SearchQuery` Typebox schema in `package/contract/src/search.ts` — keyword, tags, type, languages, nsfw, isLicensed, realm, sort
- [ ] 1.6 Export all new types from `package/contract/src/index.ts`
- [ ] 1.7 Run `tsc --noEmit` in `package/contract` to verify no type errors

## 2. Database: Zone Model

- [ ] 2.1 Add `ZONE` to `UnitType` enum in `package/server/prisma/schema.prisma`
- [ ] 2.2 Create `Zone` model in `package/server/prisma/schema.prisma` with fields: `unitId` (PK, FK to Unit), `filters` (Json), `template` (String), `styling` (Json?), `startsAt` (DateTime?), `endsAt` (DateTime?), `createdAt`, `updatedAt`
- [ ] 2.3 Add `zone Zone?` relation on the `Unit` model
- [ ] 2.4 Run `bun run prisma:migrate` in `package/server` to generate and apply migration
- [ ] 2.5 Run `bun run prisma:generate` to regenerate Prisma client

## 3. Backend: SlugRef Resolution

- [ ] 3.1 Create `resolveSlugRef(ref: SlugRef): Promise<string | null>` utility in `package/server/src/shared/` — returns unitId directly if present, otherwise looks up Unit by slug
- [ ] 3.2 Create `resolveSlugRefs(refs: SlugRef[]): Promise<string[]>` batch utility — resolves all refs, filters out nulls (non-existent slugs)
- [ ] 3.3 Update content search service (`package/server/src/meili/content/content.service.ts`) to accept `tags: SlugRef[]` — resolve to unitIds, then apply as `tagIds` filter in MeiliSearch
- [ ] 3.4 Implement precedence: when both `tags` and `tagIds` are present, use `tags` and ignore `tagIds`
- [ ] 3.5 Write tests for SlugRef resolution (unitId path, slug path, non-existent slug)

## 4. Backend: Zone API

- [ ] 4.1 Create `package/server/src/zone/zone.service.ts` — zone CRUD logic, lifecycle enforcement, ZoneFilters validation
- [ ] 4.2 Create `package/server/src/zone/zone.mapper.ts` — map Prisma Zone + Unit to ZoneDTO (resolve translations)
- [ ] 4.3 Create `package/server/src/zone/zone.api.ts` — Elysia routes: `GET /zone/:slug` (public, with lifecycle check), admin CRUD endpoints (POST, PATCH, DELETE)
- [ ] 4.4 Mount zone API in `package/server/src/index.ts`
- [ ] 4.5 Write tests for zone resolution (happy path, 404, lifecycle before/after, visibility)
- [ ] 4.6 Run `tsc --noEmit` in `package/server` to verify no type errors

## 5. API Client: Zone Hooks

- [ ] 5.1 Create zone API functions in `package/api/src/zone/zone.api.ts` — `fetchZoneBySlug(slug: string): Promise<ZoneDTO>`
- [ ] 5.2 Create zone query options in `package/api/src/zone/zone.queries.ts` — `zoneQueryOptions(slug: string)` for TanStack Query
- [ ] 5.3 Export from `package/api/src/index.ts`
- [ ] 5.4 Run `tsc --noEmit` in `package/api`

## 6. Frontend: Search Feature Redesign

- [ ] 6.1 Create `search/model/searchQuery.ts` — `parseSearchString()` and `serializeSearchString()` functions implementing the SO-style syntax parser
- [ ] 6.2 Create `search/model/searchQueryToOptions.ts` — `toContentSearchOptions(query: SearchQuery, preApplied?: ZoneFilters): ContentSearchOptions` converter
- [ ] 6.3 Write unit tests for `parseSearchString` (mixed tokens, multiple tags, empty, keyword-only, round-trip with serialize)
- [ ] 6.4 Refactor `search/state/searchState.ts` to use `SearchQuery` as the core state shape (replace `SearchInfo`)
- [ ] 6.5 Create `search/component/BasicSearch.tsx` — clean keyword input, accepts pre-applied filters prop, toggle to advanced mode
- [ ] 6.6 Create `search/component/AdvancedSearch.tsx` — full filter panel with controls for all ContentSearchOptions dimensions, pre-applied filters shown as removable chips
- [ ] 6.7 Create `search/component/AppliedFilterChips.tsx` — displays active filters as removable chips (shared by basic and advanced)
- [ ] 6.8 Create `search/component/SearchResultList.tsx` — shared result list component consuming `ContentSearchResult`
- [ ] 6.9 Update `search/index.ts` — export `BasicSearch`, `AdvancedSearch`, `SearchResultList`, `parseSearchString`, `serializeSearchString`
- [ ] 6.10 Run `tsc --noEmit` in `package/app`

## 7. Frontend: Search Routes

- [ ] 7.1 Create `/search` route (`package/app/src/routes/_mainLayout/search/index.tsx`) — renders AdvancedSearch with no pre-applied filters
- [ ] 7.2 Update `/book/search` route to use shared search components with `{ type: ["BOOK"] }` pre-applied
- [ ] 7.3 Verify existing domain search routes (`/realm/search`, `/shelf/search`, `/review/search`) continue to work — no regressions

## 8. Frontend: Zone Feature

- [ ] 8.1 Create `package/app/src/zone/` feature skeleton: `model/`, `hooks/`, `state/`, `component/`, `section/`, `template/`, `page/`, `index.ts`
- [ ] 8.2 Create `zone/model/zone.ts` — local ZoneDTO type re-export, filter merge utility (`mergeZoneFilters(base: ZoneFilters, user: Partial<ContentSearchOptions>)`)
- [ ] 8.3 Create `zone/hooks/useZone.ts` — fetch zone by slug using `zoneQueryOptions`, handle loading/error/lifecycle states
- [ ] 8.4 Create `zone/template/default.tsx` — generic zone homepage template (banner + search + latest content + trending)
- [ ] 8.5 Create `zone/template/book.tsx` — book-oriented zone homepage template, reusing sections from `book-library` and `home` features
- [ ] 8.6 Create `zone/page/ZoneHomePage.tsx` — thin page that fetches zone, selects template by `zone.template`, passes config as props
- [ ] 8.7 Create `zone/page/ZoneSearchPage.tsx` — thin page that fetches zone, renders shared search components with `zone.filters` pre-applied
- [ ] 8.8 Export public API from `zone/index.ts`

## 9. Frontend: Zone Routes

- [ ] 9.1 Create `/zone/$slug/index.tsx` route — renders `ZoneHomePage`
- [ ] 9.2 Create `/zone/$slug/search.tsx` route — renders `ZoneSearchPage`
- [ ] 9.3 Create `/z/$slug` redirect route — redirects to `/zone/$slug`
- [ ] 9.4 Create `/z/$slug/search` redirect route — redirects to `/zone/$slug/search`
- [ ] 9.5 Verify zone routes render correctly with a test zone (create via admin API or seed)

## 10. Ensure Affected Sections Are Exported

- [ ] 10.1 Audit `book-library/index.ts` — ensure sections needed by zone templates (NewBookSection, TrendingBookSection, etc.) are exported
- [ ] 10.2 Audit `home/index.ts` — ensure sections (QuickAccessLinks, etc.) are exported
- [ ] 10.3 Verify no circular dependencies introduced by cross-feature imports

## 11. Validation

- [ ] 11.1 Run `tsc --noEmit` independently in `package/contract`, `package/server`, `package/api`, `package/app`
- [ ] 11.2 Run `bun test` in `package/server` — verify SlugRef resolution tests and zone API tests pass
- [ ] 11.3 Run `bun test` in `package/app` — verify search parser tests pass
- [ ] 11.4 Start dev server (`bun run server:dev` + `bun run app:dev`) and manually verify: zone homepage renders, zone search works, `/search` global route works, `/book/search` still works
- [ ] 11.5 Run `bun run knip` at root to check for unused exports/dependencies

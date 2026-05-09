## Why

Search on rezics is fragmented: `/search` only queries the `content` index, posts and realms have parallel-but-separate routes (`/realm/search`, `/review/search`, …), the header search bar shows scope badges (`r/…`, `u/…`) for realm and user pages but its submit handler still navigates to `/search`, and book/realm/user scoped search pages are missing or only partly wired. The newly archived `post-search-root-target-scoping` change unblocks the data plane (`Post.rootTargetUnitId` / `rootTargetUnitType` are now indexed and filterable in Meilisearch), so this is the moment to collapse the four separate flows into one federated, scope-aware search experience.

## What Changes

- **NEW federated search endpoint** at `POST /meili/search/federated` that accepts a `SearchScope` (`global` / `book` / `realm` / `user`) plus a `SearchCategory` (`all` / `mixed` / `books` / `reviews` / `excerpts` / `remarks` / `posts` / `shelves` / `realms` / `users`) and dispatches Meilisearch `client.multiSearch` calls in three modes:
  - `category = "all"` — non-federated multi-search across the relevant indexes (each query capped at ~5 hits) so that per-category `totalHits` are returned for the navigation counters;
  - `category = "mixed"` — federated multi-search (`federation: {}`) producing a single Spotlight-style cross-index ranked list (per-query `weight` tunable in config);
  - any single-category value — single-index search routed through the existing per-index endpoint.
- **NEW `SearchScope` and `SearchCategory` contracts** in `@rezics/contract` plus a route-to-scope resolver shared by header submit and scoped pages.
- **Strict-membership scope semantics** (no indirect mentions): `book` scope filters posts via `rootTargetUnitId = :id` and shelves via `containedUnitIds CONTAINS :id`; `realm` scope filters content + posts via `realmIds CONTAINS :id`; `user` scope filters content via `userId = :id` and posts via `authorUserId = :id`.
- **Content index gains `containedUnitIds: string[]`** so `book`-scoped search can include the shelves that contain the book. Sync hooks on `ShelfItem` insert/delete partial-update the parent shelf document; a one-shot SQL backfill + `syncAllContainedUnitIds` resync helper bring the existing corpus current.
- **Query syntax adds `kind:`** (`review` / `excerpt` / `remark` / `chapter` / `post`) for filtering posts within a category that includes them; existing tokens (`[slug]`, `type:`, `lang:`, `nsfw:`, `licensed:`, `in:`, `sort:`) keep their meaning.
- **Routes**: `/search` is reused as the global federated page (scope=global, category=all by default); `/book/:bookId/search`, `/realm/:realmId/search`, `/u/:userSlug/search`, and `/user/:userId/search` are added as scoped federated pages. The existing directory routes `/book/search` (book library) and `/realm/search` (realm directory) keep their semantics — they are the dedicated `books` / `realms` category landing pages, not duplicates of the federated search.
- **Header submit becomes scope-aware**: `HeaderSearch` resolves the current scope from `pathname` (already done for the badge) and routes the form submit to the matching scoped search URL instead of always `/search`.
- **Frontend** ships a `FederatedResultList` (group-and-cap rendering for `all`; flat list for `mixed`; per-category sections for single-category) and a `SearchCategoryNav` component. `buildSearchPath` is widened to take `{ scope, category }`. `useSearchQuery` accepts `initial.category` and `initial.scope`. The legacy single-index `/search` page implementation is replaced; URL query params (`q`, tag tokens, etc.) remain backward-compatible.
- **Out of scope** (intentionally deferred): suggest/autocomplete dropdown in the header, empty-query discovery / trending / recent, the realm-discussion semantic variant (indirect mentions), and tuning of cross-index relevance weights beyond a sensible default.

No breaking changes to existing API consumers: every existing per-index endpoint (`POST /meili/posts/search`, `POST /meili/realms/search`, content search) keeps its current contract and is reused under the hood for single-category queries; the federated endpoint and the content-index `containedUnitIds` field are additive.

## Capabilities

### New Capabilities

- `federated-search`: Defines the `SearchScope` and `SearchCategory` types, the route-to-scope resolver rules, the federated search endpoint contract (`POST /meili/search/federated`), and the rules for how scope translates into per-index Meilisearch filters across `content`, `posts`, `realms`, and `users`.

### Modified Capabilities

- `content-index`: Adds `containedUnitIds: string[]` as a filterable attribute on the content index; specifies the `ShelfItem` insert/delete sync triggers that partial-update the parent shelf document; specifies the `syncAllContainedUnitIds` full-resync helper.
- `content-search-api`: The single-index endpoints stay; spec acquires a forward reference noting that the federated endpoint orchestrates them and that single-category queries SHALL route through the existing per-index endpoints rather than re-implementing filters.
- `post-search-index`: Query-syntax surface adds `kind:` token parsing inside `parseSearchString`; index settings unchanged.
- `search-query-syntax`: `kind` field added to the structured `SearchQuery` Typebox schema; parser recognizes `kind:value` tokens.
- `search-state-injection`: `useSearchQuery` accepts `initial.scope` and `initial.category`; injection paths preserved; new fields surface in `AppliedFilterChips` where appropriate.
- `app-search-feature`: Adds `FederatedResultList`, `SearchCategoryNav`, four scoped page components (`/book/:id/search`, `/realm/:id/search`, `/u/:slug/search`, `/user/:id/search`), `HeaderSearch` scope-aware submit, and widens `buildSearchPath` to `{ scope, category }`.

## Impact

- **Affected packages**:
  - `@rezics/contract` — `SearchScope`, `SearchCategory`, `FederatedSearchOptions`, `FederatedSearchResult` Typebox schemas.
  - `@rezics/server` — new `package/server/src/meili/search/federated.api.ts` + `federated.service.ts`; ShelfItem sync hooks in `package/server/src/shelf/shelf.service.ts`; backfill script `package/server/src/script/backfill-contained-unit-ids.ts` + `resync-content-contained-units.ts`.
  - `@rezics/search` — `buildContentDocument` projects `containedUnitIds`; `initContentIndex` adds it to `filterableAttributes`; new `syncAllContainedUnitIds` helper mirroring `syncAllPostRealmIds`.
  - `@rezics/api` — `federatedSearch` query options and TanStack Query hook.
  - `@rezics/app` — new components, four scoped routes, header submit rewrite, `buildSearchPath` widening, parser update, `/search` page rewrite.
- **Database**: no schema changes; the trigger surface is `Shelf` / `ShelfItem` mutations going through `ShelfService` (canonical write path) — no Postgres triggers or new tables.
- **Meilisearch**: content index `filterableAttributes` gains `containedUnitIds` (forward-compatible with existing documents — Meilisearch tolerates missing fields); a targeted backfill + `syncAllContainedUnitIds` partial resync brings the corpus current. No full reindex required.
- **Backward compatibility**: all existing per-index search endpoints unchanged; legacy `/search?q=…` URL params continue to resolve; the page component is replaced but URLs remain valid.
- **Migration order**: (1) ship `containedUnitIds` schema/code, (2) update content index settings via `initContentIndex`, (3) run the backfill + resync, (4) deploy server federated endpoint, (5) deploy frontend pages — old frontend keeps working against legacy endpoints throughout.

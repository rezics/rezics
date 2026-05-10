## Context

Search on rezics is currently fragmented across four entry points (`/search`, `/book/search`, `/realm/search`, `/review/search`) and four Meilisearch indexes (`content`, `posts`, `realms`, `users`). The `posts` index just acquired `rootTargetUnitId` / `rootTargetUnitType` filterable attributes via the archived `post-search-root-target-scoping` change, which removes the only data-plane gap blocking book/game/media-scoped post search. The header search bar (`package/app/src/core/components/header/HeaderSearch.tsx`) already resolves `pathname` to a scope and renders a `r/…` or `u/…` badge, but its submit handler only navigates to `/search`. The Meilisearch JS SDK pinned at `meilisearch@^0.54.0` exposes `client.multiSearch({ federation, queries })` — verified in `node_modules/.bun/meilisearch@0.54.0/.../dist/types/meilisearch.d.ts:104` — supporting both non-federated multi-search (per-query results with their own `totalHits`) and federated multi-search (single mixed/ranked hit list with `_federation.indexUid` metadata and per-query `weight`).

The `app-search-feature` spec at `openspec/specs/app-search-feature/spec.md` already requires `useSearchQuery`, `parseSearchString`, `AdvancedSearch`, `KeywordInput`, `TagPicker`, and `AppliedFilterChips` to exist; the `search-query-syntax` spec defines the structured `SearchQuery` schema with token-based parsing; the `content-search-api` spec mandates server-mediated search (no direct frontend Meilisearch). All three constrain how the federated layer must compose with what already ships.

Plan documents informing this design:

- `openspec/plans/search-scope-indexing-plan.md` §3 (scope semantics), §4 (federated architecture sketch), §6 (future-work breakdown).
- `openspec/changes/post-search-root-target-scoping/design.md` (the precedent for denormalized scope filters; we mirror its sync-trigger and partial-resync patterns for `containedUnitIds`).

Industry precedent for the chosen UX shape:

- GitHub's "All / Repositories / Issues / Code / …" header search uses non-federated multi-search with per-tab `totalHits` counters.
- Notion's "All / Pages / Databases / People" uses group-and-cap on the All view with "see more" links to dedicated category views.
- Slack's older `/search` page used per-tab queries; the newer Spotlight-style command bar uses federated mixed ranking.
- Algolia's recommendation for "QuickSearch" overlays maps onto our `mixed` category (federation with weights); their multi-vertical search-results page maps onto our `all` category (group-and-cap).

## Goals / Non-Goals

**Goals:**

- Collapse `/search`, `/book/search`, `/realm/search`, `/review/search`, `/shelf/search`, and `/z/$slug/search` into a single conceptual model: `SearchScope × SearchCategory × SearchQuery`.
- Make the four scope-aware page URLs work end-to-end: `/search`, `/book/:bookId/search`, `/realm/:realmId/search`, `/u/:userSlug/search`, `/user/:userId/search`.
- Make `HeaderSearch` submit navigate to the matching scoped page instead of always `/search`.
- Add `containedUnitIds` to the content index so book-scoped search includes the shelves that contain the book — the only remaining "scope coverage" gap after `rootTargetUnitId`.
- Use Meilisearch's native `multiSearch` for both `all` (non-federated, capped per index) and `mixed` (federated, single ranked list) without standing up custom orchestration code beyond a thin switch.
- Preserve the existing single-index endpoints (`POST /meili/posts/search`, `POST /meili/realms/search`, content search) and reuse them under the hood for single-category queries instead of duplicating filter logic.
- Stay backward-compatible on URL query params: `/search?q=…` with `[slug]` / `type:` / `lang:` etc. continues to work.

**Non-Goals:**

- Header autocomplete / suggest dropdown (separate `search-suggest` change).
- Empty-query discovery, trending, or recent-searches state.
- "Discussed-here" semantics for realm scope (i.e., posts in this realm that target a book outside the realm). v1 is strict membership only.
- Cross-index relevance tuning beyond a single config-driven default `weight` per index.
- Admin "subtree retarget" or shelf bulk-move flows that would require outbox-driven cascade (`containedUnitIds` write path is the canonical `ShelfService.add/removeItem`; bulk-move tooling, if introduced later, owns its own cascade).
- Postgres triggers on `ShelfItem` — sync runs in the service layer like every other index sync today.
- Replacing the existing `BookLibPage` (`/book/search`) book-grid UI or the `RealmSearchPage` realm-directory UI; those keep their semantics as `books` / `realms` category landing surfaces.

## Decisions

### Decision 1: Three multi-search modes, dispatched by `SearchCategory`

**Choice:** A single server endpoint `POST /meili/search/federated` accepts `{ scope, category, query, page, hitsPerPage }` and dispatches one of three Meilisearch shapes:

| Category | Meilisearch shape | Purpose |
|---|---|---|
| `all` | non-federated `multiSearch` over the indexes relevant to `scope` | "Overview" view: per-index `totalHits` for the nav counters, each index capped (default 5) for the snippet sections |
| `mixed` | federated `multiSearch` with `federation: { page, hitsPerPage }` and per-query `weight` from server config | Spotlight-style ranked single list across indexes |
| any single category (`books` / `posts` / `realms` / `users` / `shelves` / `reviews` / `excerpts` / `remarks`) | non-federated `multiSearch` with one query (or a thin re-export of the existing per-index endpoint) | Drill-down view with full pagination |

**Why:** Both Meilisearch modes are first-class and the SDK exposes them through one method. The branch is a switch on `category`, so we never reimplement a Meilisearch-side filter — every category resolves to existing per-index filter expressions.

**Why not federated for `all`:** Federated mode collapses `totalHits` into a single number across indexes (verified against `https://www.meilisearch.com/docs/reference/api/multi_search`). The `all` view needs counters per category for the nav strip ("Books 42 · Reviews 118 · Posts 256"); non-federated returns each query's `totalHits` directly. Doing federated for `all` would force a second multi-search just for counters.

**Why a server endpoint** instead of letting the client call Meilisearch directly: `content-search-api` already mandates server-mediated search (no `getSearchKey()` to the frontend). The federated endpoint is consistent and allows the server to apply the default `nsfw=false` filter, the `visibility=PUBLIC` content filter, and ratings authorization (`useAllowedRatings` is currently a client-only thing; eventually the server will own it).

**Alternatives considered:**

- *Single federated call always; client computes per-category totals from `_federation.indexUid` distribution.* Rejected: federated only returns up to `hitsPerPage` total, so per-index counters would be lower-bounded by the page slice — useless as counters. A separate non-federated call would be needed anyway.
- *Client-side fan-out using the existing per-index TanStack Query hooks.* Rejected: leaks orchestration into the UI, breaks `content-search-api`'s server-mediated requirement, and pagination across N parallel queries is messy.

### Decision 2: Strict-membership scope semantics; no indirect mentions

**Choice:** `SearchScope` resolves to **only** these filters:

```
global   → no scope filter
book     → posts.rootTargetUnitId = :unitId          (BOOK / GAME / MEDIA)
           content.containedUnitIds CONTAINS :unitId (shelves containing it)
           content/realms/users → not included (book-scope is content-about-this-book)
realm    → content.realmIds CONTAINS :realmId
           posts.realmIds   CONTAINS :realmId
           users → not included (realm members are a separate surface)
user     → content.userId = :userId
           posts.authorUserId = :userId
           realms → not included
```

Indirect references — e.g. a review whose body mentions another book — are **not** in the result set; the user follows the review to its detail page to see them. This matches the user's stated preference and keeps the filter expressions trivial.

**Why scope-restricts-which-indexes-are-queried, not just which-filter-is-applied:** A `book` scope querying the `users` index returns nothing useful (users aren't authored by a book). The orchestrator picks an index allowlist per scope; the federated endpoint is the place that knows the mapping.

**Alternatives considered:** Discussed-here semantics for `realm` — adding `posts.realmIds CONTAINS :realmId AND posts.rootTargetUnitId NOT IN realmContent`. Deferred to v2 explicitly per the proposal's Non-Goals.

### Decision 3: `containedUnitIds` denormalized onto shelf documents in the content index

**Choice:** Add `containedUnitIds: string[]` as a filterable attribute on the `content` index. Sync triggers run on `ShelfService.addItem` / `removeItem` and partial-update the parent shelf document via `client.patchContents({ id: shelfId, containedUnitIds: [...] })`, mirroring the `RealmUnit` → `realmIds` pattern from `realm-post-junction` / `post-search-index`. A one-shot SQL backfill + `syncAllContainedUnitIds` resync helper bring the existing corpus current.

**Why this index, not a new "shelf-membership" index:** The book-scope question for shelves is "which shelves contain this book?" — a single equality-filterable array on the shelf document collapses it to one Meilisearch filter (`containedUnitIds = :bookId`). Adding a join-style index would force a second round trip and complicate the `book` query.

**Why service-layer triggers, not Postgres triggers:** Every other index sync today (`realmIds` on posts, `rootTargetUnitId` on posts, content document sync on Unit publish) goes through the service layer. Staying in that lane keeps the project consistent and avoids introducing a new persistence concern.

**Why filterable not searchable:** Users don't search shelf bodies by book id; they filter shelves to those containing a known book.

**Cost:** Each `ShelfItem` insert/delete triggers one partial-update task per parent shelf. For a typical shelf with ≤ 1000 items, the array is small. Adding a book to N shelves → N partial-updates, fire-and-forget.

**Alternatives considered:**

- *Postgres `Shelf.containedUnitIds` materialized column.* Rejected: doubles the source-of-truth surface for no real win — the shelf-item join table is the canonical store and Meilisearch is the search-side projection.
- *Query-time root expansion (`SELECT shelves containing book; filter content.id IN [...]`)* Rejected: same unbounded-list pathology that killed the analogous post-search workaround in `post-search-root-target-scoping`.

### Decision 4: `SearchCategory` covers post-kinds even though they live in one index

**Choice:** `reviews` / `excerpts` / `remarks` are categories on the federated nav even though they're all `kind` filters on the `posts` index. `chapters` is **not** a category (chapters are addressed via the book detail page; including them as a top-level search category dilutes the result list).

| Category | Underlying query |
|---|---|
| `posts` | `posts` index, `kind = "POST"` |
| `reviews` | `posts` index, `kind = "REVIEW"` |
| `excerpts` | `posts` index, `kind = "EXCERPT"` |
| `remarks` | `posts` index, `kind = "REMARK"` |
| `books` | `content` index, `type = "BOOK"` (or `BOOK \| GAME \| MEDIA` in `book` scope) |
| `shelves` | `content` index, `type = "SHELF"` |
| `realms` | `realms` index |
| `users` | `users` index |

**Why expose post-kind as category:** Users on a book page who want "reviews of this book" should land on a result list of reviews only — not a mixed feed where reviews compete with replies. The category nav makes that one click.

### Decision 5: `category` over `tab` in the public surface

**Choice:** All public types, URL params, and component names use `category` (`SearchCategory`, `?category=…`, `<SearchCategoryNav>`). The visual rendering is still a horizontal tab strip; only the data-model name changes.

**Why:** In a Chinese-speaking team context "tab" and "標籤/tag" overlap; `category` is unambiguous and matches Notion / Slack search-results vocabulary. UI copy can still say "All", "Books", "Reviews" — the term `category` only surfaces in code and contracts.

### Decision 6: Reuse existing single-index endpoints; the federated endpoint is an orchestrator

**Choice:** `POST /meili/posts/search`, `POST /meili/realms/search`, and the content search endpoint stay as-is. The federated endpoint either:

- forwards a single-category query directly to the underlying per-index endpoint, **or**
- builds a Meilisearch `multiSearch` body whose sub-queries map 1:1 to the per-index filter logic (factored into shared helpers in `package/server/src/meili/<index>/filters.ts`).

The shared helpers (`buildContentFilter`, `buildPostFilter`, `buildRealmFilter`) are the only new "shared" surface. Each per-index `*.service.ts` already constructs its filter; this change extracts that into a pure function so the federated orchestrator can call it without duplicating logic.

**Why:** Single source of truth for filter expressions. A regression in the post filter (e.g., NSFW handling) fixes both single-category and federated paths.

### Decision 7: `kind:` token only meaningful for post-bearing categories

**Choice:** `parseSearchString` recognizes `kind:review` etc. and writes it onto `SearchQuery.kind`. The federated server orchestrator passes it through to post-bearing sub-queries (`reviews`, `excerpts`, `remarks`, `posts`, `all`, `mixed`); for `books` / `realms` / `users` / `shelves` it's silently ignored.

**Why ignore rather than reject:** A user composing a query on the global page may not yet know which category will return what they want; `kind:review` should narrow only the post-side without erroring out of the page. Silent drop is the same pattern the existing parser uses for invalid `type:` values.

### Decision 8: Header submit resolves scope from `pathname`, not from a state store

**Choice:** Reuse the existing `resolveScope(pathname)` helper in `HeaderSearch.tsx`; submit constructs the URL via `buildSearchPath({ scope, category: undefined, keyword: value })` and navigates. No new global state.

**Why:** Pathname is the single source of truth. A state store would re-derive the same information and risk drift between badge and submit target.

## Risks / Trade-offs

- **Risk: `containedUnitIds` write amplification on bulk shelf operations.** A user importing a 500-item shelf triggers 500 partial-update tasks. → Mitigation: `ShelfService` already batches multi-item adds where possible; for the federated change we coalesce updates inside a single batch into one partial-update by computing the post-state `containedUnitIds` once per batch boundary (see tasks.md §4.4).
- **Risk: federated `mixed` ranking quality is unknown without real data.** The default `weight` per index is a guess until we see traffic. → Mitigation: weights are config-driven (`SEARCH_FEDERATION_WEIGHTS` env var or static config object), so they can be tuned without a code change. Spec documents the default but does not lock it.
- **Risk: `all` view with N indexes balloons request size.** With 4 sub-queries × `hitsPerPage 5` × per-doc payload ~2 KB, ≈ 40 KB per response — fine. → Mitigation: cap is configurable; if perf data later justifies, we can drop `excerpts`/`remarks` from the `all` view and surface them only under their dedicated categories.
- **Risk: "discussed-here" omission surprises realm users.** A realm whose threads frequently target external books will appear "empty" on `/realm/:id/search?category=posts` for those discussion posts. → Mitigation: out of scope by design; document the strict-membership semantic in the spec; revisit in v2 if user feedback warrants.
- **Risk: page rewrite regresses the existing `/search` URL params.** → Mitigation: the URL contract is the same `?q=…` plus optional `?category=…`; existing param parsing in `validateSearch` is preserved. A test asserts that visiting `/search?q=[isekai]+type:book` produces the same `SearchQuery` after the rewrite.
- **Trade-off: silent ignore of `kind:` outside post-bearing categories.** Users who type `kind:review` on the realms category get all realms back, no error. The proposal accepts this as predictable behavior; an `AppliedFilterChips` chip showing "kind: review (ignored)" is an optional polish task in §10.
- **Trade-off: scope is path-encoded not query-encoded.** Means `/search?scope=realm&realmId=…` doesn't exist; the only way to scope-search a realm is via `/realm/:id/search`. Fine because those URLs are linkable and match the existing per-domain page convention.

## Migration Plan

Apply order matters because frontend code MUST NOT call the federated endpoint before the index has `containedUnitIds`:

1. **Schema/code: ship `containedUnitIds`** — `buildContentDocument` projection, `initContentIndex` filterableAttributes update, ShelfService sync hooks. Forward-compatible: existing documents lack the field; Meilisearch tolerates that. *(Tasks §1, §2.)*
2. **Run `initContentIndex`** on each environment to apply the new filter setting. *(Task §3.)*
3. **Backfill: SQL + partial resync.** `backfill-contained-unit-ids.ts` derives `containedUnitIds` from `ShelfItem` for every shelf document; `syncAllContainedUnitIds` pushes the partial update to Meilisearch. Idempotent; safe to re-run. *(Tasks §4.)*
4. **Server: federated endpoint** — `package/server/src/meili/search/federated.api.ts`, `federated.service.ts`, shared filter helpers. Add to `index.ts` route mounting. *(Tasks §5, §6.)*
5. **Contract: Typebox schemas** — `SearchScope`, `SearchCategory`, `FederatedSearchOptions`, `FederatedSearchResult`. *(Task §7.)*
6. **Frontend hook + components** — `useFederatedSearch` query in `@rezics/api`, `FederatedResultList`, `SearchCategoryNav`, parser `kind:` extension, `buildSearchPath` widening. *(Tasks §8, §9.)*
7. **Frontend pages** — `/search` rewrite plus four new scoped pages. *(Task §10.)*
8. **Header** — `HeaderSearch.submit` becomes scope-aware. *(Task §11.)*
9. **Tests + convention checks** — unit + integration. *(Task §12.)*

**Rollback:** If the federated endpoint is faulty, revert the frontend pages to call the legacy single-index endpoints; the schema/index changes (`containedUnitIds`) are forward-compatible and don't need rollback. The `containedUnitIds` field can be dropped from `filterableAttributes` without data migration if necessary.

**Eventual consistency:** `containedUnitIds` becomes stale if a `ShelfItem` is deleted via a code path that bypasses `ShelfService` (none today, but documented). Same `nightly resync` story as `realmIds`.

## Open Questions

- *Should the `all` category default to scope=global only, or render even on scoped pages?* Tentative answer: render on every scope with the same group-and-cap layout, just with the scope filter applied. Confirmed by the proposal but worth re-checking once `book`-scoped `all` is built — if the result is dominated by replies, we may want to reorder sections per scope.
- *Default `mixed` weights.* Tentative: `content: 1.0`, `posts: 1.0`, `realms: 1.2`, `users: 1.5` (favoring "find a person/place" over "find content" for ambiguous queries). Final values land in `package/server/src/meili/search/federation.config.ts` and are tunable post-launch.
- *Should `chapters` be exposed as a category at all?* Currently no. If chapter-level scope search is requested later, it merges in via `post-search-index` updates, not this change.
- *URL canonical form when `category=all`.* Drop the param vs. keep it? Tentative: drop it (so `/search?q=foo` is the canonical form); restore on `?category=` change. Spec `app-search-feature` will state this explicitly.

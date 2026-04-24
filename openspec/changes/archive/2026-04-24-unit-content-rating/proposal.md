## Why

The current `Unit.nsfw` boolean is too coarse: it cannot distinguish R-15 suggestive content from R-18 explicit content or R-18G grotesque content, which makes it impossible to offer age-appropriate discovery (a 15-year-old-suitable filter) or to warn readers about specific sensitivities (gore) separately from sexual content. Treating sensitive content as a binary also forces maintainers to either over-flag (hiding R-15 material from every user) or under-flag (exposing R-18 material to sensitive users). A four-tier `ContentRating` enum aligned with the pixiv/doujinshi convention (GENERAL / R_15 / R_18 / R_18G) lets maintainers mark intent accurately and lets readers opt in per tier.

A second limitation is that NSFW is Unit-level only. A multi-chapter book whose main storyline is R-15 may contain a bonus (特典) chapter that is R-18; forcing the maintainer to escalate the whole work to R-18 to cover one chapter harms discovery. Chapters are already independent Units, so each chapter SHALL carry its own rating, and the maintainer — not the system — decides what the Unit-level rating represents.

## What Changes

- **BREAKING**: `Unit.nsfw: Boolean` is removed. `Unit.rating: ContentRating` is introduced with enum values `GENERAL | R_15 | R_18 | R_18G`; existing data is re-defaulted to `GENERAL` (dev-phase breaking migration, no backfill heuristic).
- **BREAKING**: `ContentSearchDocument.nsfw: boolean` is replaced with `rating: ContentRating`. `ContentSearchOptions.nsfw: boolean` is replaced with `ratings: ContentRating[]` (set-based filter).
- **BREAKING**: `ZoneFilters.nsfw` is replaced with `ZoneFilters.ratings: ContentRating[]`.
- Chapter Units (Unit[type=POST, post.kind=CHAPTER]) participate in the same `rating` field — each chapter's rating is independent of its parent book's rating. The system does NOT enforce `book.rating >= max(chapter.rating)`; the Unit-level rating is a maintainer-asserted label for the work's public-facing classification (main arc), while chapter-level ratings describe the actual content of each chapter. Bonus chapters MAY exceed the Unit rating without escalating it.
- `BookIndex.index` node schema gains an optional `rating?: ContentRating` field. BookIndex is a **frontend-managed cache** of chapter rating overrides used by the TOC renderer to show "this chapter differs from the work" badges without per-chapter fetches. A node's `rating` is written ONLY when `chapter.rating !== book.rating`; when they match, the field is omitted. The source of truth is always the chapter's own `Unit.rating`.
- Chapter editor auto-prefills `rating` from the parent book's rating when creating a new chapter (frontend convenience; maintainer can change it).
- BookIndex editor gains two new tools:
  - **(A) Resync index overrides** — a button that recomputes the `rating` override on every index node from current chapter `Unit.rating` values and the current book `Unit.rating`. Intended for use after the book's rating is changed, to refresh the cache.
  - **(B) Multi-select batch edit** — the TOC editor allows selecting multiple chapter entries and applying a single `rating` to all of them in one operation (updates each chapter's `Unit.rating`).
- User preference: `User.settings.content.optedInRatings: ContentRating[]` is introduced (persisted on the server via the existing `User.settings: Json?` column). Allowed rating set per request = `{GENERAL, R_15} ∪ optedInRatings`.
  - Unauthenticated users: always `{GENERAL, R_15}`.
  - Authenticated users: default `optedInRatings = []` → same as unauthenticated.
  - Toggling `R_18` or `R_18G` on in the Preferences UI triggers a confirmation modal at the moment the user ticks the checkbox. Untoggling does NOT require confirmation.
  - The preference is persistent and cross-device; no per-session or per-click prompting.
- Search filtering on the content index uses the set-based `ratings` filter. The app's default browse filter derives `ratings` from the caller's session.
- The previous single `NsfwToggle` UI primitive is replaced by a four-checkbox `RatingFilterChips` primitive.

## Capabilities

### New Capabilities

- `content-rating`: Defines the `ContentRating` enum, its placement on `Unit` as a maintainer-asserted label, the non-derivation invariant (the system does NOT enforce aggregation from chapters), the user-preference opt-in model, and the default allowed set for unauthenticated and authenticated callers.

### Modified Capabilities

- `unit-identity`: Replaces the `NSFW flagging` requirement with `Content rating` (field renamed and re-typed); updates the `Create a unit with a valid type` scenario to default `rating = GENERAL` instead of `nsfw = false`.
- `content-search-contract`: `ContentSearchDocument.nsfw` becomes `rating`. `ContentSearchOptions.nsfw` becomes `ratings` (array, set filter). `ZoneFilters.nsfw` becomes `ZoneFilters.ratings`.
- `content-sync`: The sync builder reads `unit.rating` and writes it to `ContentSearchDocument.rating` instead of the boolean path.
- `type-extension-book`: `BookIndex.index` node schema gains optional `rating`; the cache-write rule (only store when differing from book rating) is specified; the two editor tools (A resync, B batch edit) are specified at the TOC/BookIndex spec level as frontend-owned operations.
- `settings-preferences`: Adds an `Age rating opt-ins` requirement covering the `optedInRatings` setting, the per-tier checkbox UI, the confirmation-on-enable behavior, and persistence via `userApi.updateSettings()`.
- `app-search-feature`: Replaces the NSFW toggle filter with a four-value rating filter wired to the user-preference-derived allowed set.

## Impact

**Affected packages**:
- `package/server` — Prisma schema (remove `nsfw`, add `rating`), migration, `unit.service.ts`, `unit.mapper.ts`, `book.service.ts`, book mapper, chapter service, search sync in `meili/content/content.service.ts`.
- `package/search` — `sync.ts` (`buildContentDocument`, any `nsfw` references).
- `package/contract` — `unit.ts`, `book.ts` (BookIndex node schema), `meili/content.ts` (`ContentSearchDocument`, `ContentSearchOptions`), `zone.ts` (`ZoneFilters`), `search.ts`.
- `package/api` — any hook/query-option that exposes `nsfw` in arguments or response types.
- `package/app` — `search/` (filters, URL state, `NsfwToggle` removal, new rating chips), `book-edit/` (book metadata editor rating dropdown), chapter editor (rating selector, auto-prefill), TOC editor (A resync button, B batch-edit multi-select), settings preferences page (rating opt-in section with confirmation modal), locale strings.
- `package/admin` — any admin NSFW references.
- `package/ui` — new `RatingFilterChips` / `RatingBadge` / `RatingSelector` primitives (replace `NsfwToggle`).

**APIs**:
- Public search API input/output shape changes (breaking).
- Unit CRUD input/output shape changes (breaking).
- Book and Chapter CRUD shape changes (breaking).
- User settings shape extension (additive under `content.optedInRatings`).

**Dependencies**: no new runtime dependencies.

**Migration / backward-compatibility**: this is a dev-phase breaking change. The `nsfw` column is dropped; no heuristic backfill from `nsfw=true` to a specific rating tier is performed. All existing Units default to `GENERAL` and maintainers re-rate as needed. External consumers of the search API or unit contracts must update to the new shape in a single cut-over; no compatibility shim is provided.

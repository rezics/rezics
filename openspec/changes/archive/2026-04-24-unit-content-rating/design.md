## Context

Today every Unit carries a `nsfw: Boolean` flag set to `false` by default. Search sync denormalizes it into `ContentSearchDocument.nsfw`, and the app search UI exposes a single `NsfwToggle` that adds `nsfw: boolean` to `ContentSearchOptions`. Discovery filtering is therefore a binary: users either see all sensitive content or none of it, with no ability to distinguish R-15 suggestive content from R-18 explicit content or R-18G grotesque content. Chapters are modelled as `Unit(type=POST, post.kind=CHAPTER)`, so they are first-class Units with their own `nsfw` flag today, but the UI does not surface per-chapter NSFW state — the book is the only level at which sensitive content is declared.

The pixiv-style four-tier convention (`general` / `r-15` / `r-18` / `r-18g`) is already familiar to the target audience and gives maintainers enough granularity to label content honestly without over-flagging. This change introduces that convention as a first-class Unit field and redefines the data flow around it.

This is a dev-phase change; there is no production data, so the migration is allowed to be destructive.

## Goals / Non-Goals

**Goals:**
- Replace the binary `Unit.nsfw` with a four-tier `Unit.rating: ContentRating` enum.
- Make every Unit (including chapter Units) independently ratable.
- Let maintainers keep a multi-chapter work at a lower Unit-level rating than some of its chapters (bonus / 特典 scenario), with the system trusting the maintainer not to misuse this.
- Surface per-chapter rating differences in the TOC via a frontend-managed cache on `BookIndex`.
- Offer two editor tools — cache resync and multi-chapter batch edit — to keep per-chapter ratings and the index cache easy to manage.
- Persist per-user age-rating opt-ins (`R_18`, `R_18G`) on the server so the preference follows the account across devices, gated by a confirmation modal on enable.
- Swap the search index/contract from `nsfw: boolean` to `rating: ContentRating` / `ratings: ContentRating[]` with set-based filtering.

**Non-Goals:**
- Automatic derivation of a Unit's rating from its chapters or any invariant enforcing `book.rating ≥ max(chapter.rating)`. The system explicitly trusts the maintainer.
- Any behavioural migration from existing `nsfw=true` rows to a specific rating tier; all rows are re-defaulted to `GENERAL` and maintainers re-rate as needed.
- Per-session or per-click age confirmation prompting. Confirmation is strictly a Preferences-page event, one-shot per enable.
- External-platform rating systems (ESRB/CERO/PEGI). `Game.ageRatingKey` is untouched.
- A policy engine for server-side blocking of R-18 / R-18G delivery to minors. The server filters search responses by the caller's allowed set; content fetches of a specific Unit by ID are out of scope for this change.

## Decisions

### Decision 1 — Enum values and encoding

**Decision:** `ContentRating = GENERAL | R_15 | R_18 | R_18G`, a Prisma enum with the same identifier names in database, contract, and frontend. Shared constant object:

```ts
export const ContentRating = {
  GENERAL: "GENERAL",
  R_15: "R_15",
  R_18: "R_18",
  R_18G: "R_18G",
} as const;
```

**Rationale:** The user explicitly chose the DB-style identifiers across the stack for consistency. Prisma enum fields cannot use hyphens, so URL/JSON-style `r-15` would require a two-way map at every boundary. Single-form identifiers eliminate that cost. The four values are non-strictly ordinal — `R_18G` is a sibling of `R_18` (sexual-vs-grotesque distinction), not a strict "one step above." The enum is therefore modelled as a set of labels; any "≤ X" filter that needs an order is a UI convenience derived at the point of use, not a schema invariant.

**Alternatives considered:**
- Kebab-case strings at the contract layer with a DB-side enum mapper (rejected — two-form state and mapping churn).
- Boolean `nsfw` + optional `intensity: R_15 | R_18 | R_18G` (rejected — preserves binary mental model, still requires the same four filter checkboxes in the UI).
- Parallel flags (`rating: GENERAL | R_15 | R_18` + `hasGore: Boolean`) (rejected — user declined in favour of the four-value enum; gains precision at the cost of a two-column filter UX).

### Decision 2 — Rating is maintainer-asserted, not derived

**Decision:** `Unit.rating` is a declaratively set field. The system does NOT compute or enforce any aggregation from child Units (chapters). A Book may have `rating = R_15` while one of its chapter Units has `rating = R_18`; the maintainer is trusted to mark the Unit at the rating appropriate for discovery (main-arc characterisation).

**Rationale:** This is the core design choice that makes the bonus-chapter (特典) scenario possible. If the Unit rating were derived, a single bonus R-18 chapter would escalate the entire work to R-18 and damage discovery. Because rating exists at two layers — Unit (maintainer-asserted) and chapter Unit (content-accurate) — the TOC can show chapter-level badges for reader awareness without compromising catalog-level classification. Misuse is an editorial/moderation concern, not a schema concern.

**Alternatives considered:**
- Enforce `book.rating ≥ max(chapter.rating)` in service validators (rejected — eliminates the bonus-chapter use case, which is the main new capability).
- Compute an "effective rating" on the fly (rejected — doubles the field's meaning and invites subtle bugs in the search index, which must commit to one value).

### Decision 3 — BookIndex as a frontend-managed cache of rating overrides

**Decision:** `BookIndex.index` is the existing JSON TOC. Each node gains an optional `rating?: ContentRating` field. The write rule, enforced on the frontend, is:

```
if (chapter.rating !== book.rating) node.rating = chapter.rating
else delete node.rating
```

The source of truth remains each chapter's own `Unit.rating`. BookIndex is pure render-path cache: the TOC page uses `node.rating` (or its absence, meaning "same as book") to decide whether to display a rating badge next to the chapter entry, without fetching each chapter Unit.

**Rationale:** TOC renders in the book-detail page need to answer "does this chapter differ from the book?" for N chapters without an N+1 fetch. Storing the delta — and only the delta — keeps the JSON small and the rendering logic trivial (`node.rating ? <Badge/> : null`). Making the write frontend-owned mirrors how the JSON TOC is already edited in the TOC editor; the server does not need to understand rating semantics to persist or serve this cache.

**Alternatives considered:**
- Store every chapter's rating on every node unconditionally (rejected — unnecessary growth of the JSON, churn when books are re-rated).
- Compute the index server-side in a materialized view or trigger (rejected — introduces cross-layer coupling and a rebuild pathway that duplicates the client's knowledge of book vs chapter).
- Put rating on `Post` directly instead of on its Unit (rejected — chapter rating is a Unit-level classification shared with the rest of the system, not a post-specific field; Post already carries kind-specific fields and doesn't need rating).

### Decision 4 — Two editor tools: (A) cache resync, (B) multi-select batch edit

**Decision:** The TOC editor gains two independent tools:

- **(A) Resync index overrides** — a button that, given the current book Unit and its chapter Units, recomputes every node's `rating` override from scratch using the write rule. It does NOT change any chapter's `Unit.rating`. Intended for use right after a maintainer changes the book's rating; stale overrides that no longer diverge are removed, and newly divergent chapters acquire overrides.
- **(B) Multi-select batch edit** — the TOC editor allows the maintainer to check multiple chapter entries and apply a new `rating` to all of them in one operation. Each selected chapter's `Unit.rating` is updated, and the index node's `rating` override is re-computed afterward per the standard rule.

**Rationale:** A is purely a cache operation; B is a content edit. Distinguishing them keeps the semantic crisp: A has no undo concern (the cache is derivable), B does (chapter Units are changed). Implementing both lets the maintainer handle the two common lifecycle events — "I changed the book rating and want the TOC badges refreshed" (A) and "I want to re-rate these five chapters without clicking each one" (B). A can optionally run automatically after a book rating change, but the explicit button remains the manual escape hatch.

**Alternatives considered:**
- One button that does "propagate book rating to all chapters" (rejected — destructive; the maintainer only sometimes wants this, and never silently).
- Hide A behind B (rejected — mixes cache operations with content edits).

### Decision 5 — New chapter auto-prefill from parent book rating

**Decision:** When the chapter editor mounts in "create" mode, it reads the parent Book Unit's `rating` and pre-fills the new chapter's `rating` field with it. The maintainer can change the value before saving. The default is only a UX affordance; nothing downstream depends on it.

**Rationale:** Without prefill, every new chapter defaults to `GENERAL` regardless of the book, which is the wrong default for most R-rated works and forces repetitive re-selection. Prefilling from the book matches the maintainer's implicit expectation that a chapter inherits the book's bracket unless they declare otherwise.

### Decision 6 — User preference schema inside existing `User.settings`

**Decision:** Age-rating opt-ins live in the existing `User.settings: Json?` column under a `content.optedInRatings: ContentRating[]` path:

```jsonc
// User.settings
{
  "content": {
    "optedInRatings": ["R_18", "R_18G"]   // only opt-ins are stored
  }
}
```

The effective allowed set per request is computed as `{GENERAL, R_15} ∪ optedInRatings`. Unauthenticated callers are hard-coded to `{GENERAL, R_15}`.

**Rationale:** `User.settings` already exists; adding a namespaced `content` key avoids a schema migration and composes with future content-related preferences. Storing only the opt-ins (not the full allowed set) keeps the contract small and future-proof: if a fifth rating is ever introduced as always-on, no migration is needed. The union computation lives in the frontend filter derivation and/or the server route that applies the filter.

**Alternatives considered:**
- A dedicated `UserContentPreference` table (rejected — overkill for a handful of boolean-ish fields; breaks the pattern of using `User.settings`).
- Store the full allowed set (rejected — redundant and forces migrations whenever baseline tiers change).
- Store per-tier booleans (`allowR18: true, allowR18G: false`) (rejected — couples shape to the current enum; array of enum values composes with any future addition).

### Decision 7 — Confirmation UX at the Preferences page only

**Decision:** The Preferences page exposes four checkboxes (GENERAL, R_15, R_18, R_18G). GENERAL and R_15 are rendered but locked on. When the user ticks R_18 or R_18G, a modal opens asking for confirmation; only on confirm does the PATCH to `User.settings.content.optedInRatings` fire. Unticking a tier does NOT trigger confirmation and fires the PATCH directly. No confirmation fires anywhere else in the app.

**Rationale:** The user's explicit direction: "設置很少動，設定時確認就夠". Confirming at the data-change boundary is low-friction (happens once per tier enable) and avoids the known failure mode of per-click prompting training users to dismiss modals reflexively. Browsing pages simply honour whatever set is saved — no per-view gating.

### Decision 8 — Set-based filter contract (`ratings: ContentRating[]`)

**Decision:** `ContentSearchOptions` exposes `ratings: ContentRating[]` (set filter). The search service applies `unit.rating IN (...ratings)`. The app derives the set from the caller's allowed set. `ZoneFilters.ratings` follows the same shape; zones can narrow but never widen beyond the caller's allowed set — the final applied filter is the intersection.

**Rationale:** Set filter is the natural fit for four independent UI checkboxes. Any "≤ R_18" UI affordance (if ever added) resolves client-side to `["GENERAL", "R_15", "R_18"]` before hitting the API. This keeps the server endpoint agnostic to ordering and preserves the non-ordinal semantics of the enum.

## Risks / Trade-offs

- **[Risk] Maintainer under-rates a Unit to improve discovery.** A Book with substantial R-18 main-arc content could be labelled `R_15` to reach younger audiences. → Mitigation: this is an editorial/moderation problem, not a schema one. The spec documents that the Unit rating represents main-arc content; flagging and moderation tooling can be added in later changes. The trust model is explicit in the proposal and spec so reviewers and moderators share the same mental model.
- **[Risk] TOC cache drift between chapter Unit rating and BookIndex override.** Because writes are frontend-owned, an aborted edit or a chapter rating changed via another code path could leave a stale override. → Mitigation: the resync button (Decision 4) is the manual recovery tool and runs in O(N) chapters. We can later add a server-side "rebuild index overrides" endpoint if drift becomes common; the data model doesn't need to change.
- **[Risk] Search index falls out of sync with Unit rating.** The search sync already handles unit-level field patches for `nsfw`; we're renaming the path, not changing the mechanism. → Mitigation: extend `patchContentMetadata(unitId, { rating })` wherever `nsfw` is currently patched and verify the sync trigger list (unit update, book update) covers the new field.
- **[Trade-off] Non-ordinal enum.** Choosing a non-ordinal enum means future "≤ tier" UI is synthesized in the client. For this product's use-cases the trade is favourable: filter checkboxes are the primary UX; ordered comparisons are secondary. → Mitigation: a small client-side helper (`allRatingsUpTo(max)`) can be added in the `app-search-feature` layer if/when the ordered filter is introduced, without touching the contract.
- **[Trade-off] No backfill from `nsfw=true`.** All prior sensitive content is re-defaulted to `GENERAL` and needs manual re-rating. → Mitigation: acceptable given dev-phase status; an admin list view filtered by "was NSFW" is not needed because no such state persists after migration (the column is dropped).
- **[Trade-off] Frontend-owned cache.** Shifts responsibility for cache freshness to clients. → Mitigation: the cache is small, the write rule is a pure function, and the resync button provides a predictable recovery path.

## Migration Plan

Dev phase, destructive:

1. Prisma schema: drop `Unit.nsfw`; add `Unit.rating ContentRating @default(GENERAL)` with a new `enum ContentRating`. Reset database or let Prisma Migrate create a new column — no `nsfw → rating` mapping is generated.
2. Contracts: remove `nsfw` from `baseUnitSchema`, `unitListQuerySchema`, `unitListBodySchema`, `updateUnitSchema`, `createBookSchema`, `updateBookSchema`, `ContentSearchDocumentSchema`, `ContentSearchOptionsSchema`, `ZoneFilters`. Add `rating` where a single rating is appropriate, `ratings` where a filter is appropriate. Export the `ContentRating` constant object and Typebox union.
3. Server: update `unit.service`, `unit.mapper`, `book.service`, `book.mapper`, chapter service mappers. Any rating updates flow through `patchContentMetadata(unitId, { rating })` in `@rezics/search`.
4. Search package: rename `nsfw` to `rating` in `buildContentDocument`; adjust MeiliSearch filterable-attributes config.
5. Frontend: replace `NsfwToggle` with a `RatingFilterChips` primitive (four checkboxes), remove the `nsfw` field from `SearchQuery`, add `ratings` field, update `toContentSearchOptions`. Update book metadata editor, chapter editor, and TOC editor. Add Preferences section for opt-ins. Add confirmation modal.
6. Locale: rename `nsfw` strings and add four-tier strings plus opt-in modal copy.

No rollback is planned; there is no production data to protect. If the change needs to be undone, the same codebase state before this branch is the rollback.

## Open Questions

- Should the chapter editor's rating selector allow unsetting the rating (null) as a way to mean "inherit from book"? Current plan: no — every chapter Unit has a concrete `rating` (default `GENERAL` if not prefilled). The "match book" semantic lives in the BookIndex cache write rule, not in the chapter Unit. Confirm during implementation.
- Should resync (A) run automatically when the book rating changes, in addition to being a manual button? Current plan: manual only, because frontend-owned writes should be explicit; a later convenience hook in the book metadata editor can call the same resync routine on successful book-rating save. Not blocking for this change.

## Why

Two symptoms surfaced one underlying problem and an adjacent design gap.

The runtime symptom: `prisma.post.findMany(...)` rejects book-review and remark previews with "Invalid value for argument `kind`. Expected PostKind." because the frontend sends lowercase `"review"` / `"remark"` while the Prisma enum is uppercase. The trivial fix is wrong values at three call sites; the root cause is the post-list query schema typing `kind` as `t.Optional(t.String())`, which lets lowercase pass type checking and forces the backend into an unsafe `as PostKind` cast.

The semantic symptom: the `QUOTE` PostKind name foregrounds attribution to a speaker, but the library uses it for users highlighting memorable passages from books and game dialogue. The work and its author are already linked via `targetUnitId`; the post is about the fragment, not the act of citing someone. The codebase already half-admits this through hybrid component names like `QuoteExcerptList` and `QuoteExcerptPreview`. "Excerpt" (摘錄 / 抜粋) is the right name and the right time to commit to it is when we are tightening the contract that uses it anyway.

The adjacent gap: excerpt posts have no typed source field. Authors write `"《指環王》第三章，第一節"` into free-text titles and lose the ability to link back to the specific chapter or external page the passage came from. We can attach a structured `source` once the rename has settled.

The unit resolver: `/unit/:unitId` currently renders a generic page but is not a discovery primitive. Once excerpts can cite a unit by id, we want that id to resolve cleanly to whatever typed page the unit belongs on (book, chapter, shelf, review, etc.) without the excerpt author having to know the unit's type at write time.

These four pieces share call sites, review surfaces, and a single coherent intent ("excerpt posts gain a real type and a real source"). They ship as one OpenSpec change.

## What Changes

### Contract tightening
- `postListQuerySchema.kind` narrows from `t.Optional(t.String())` to `t.Optional(postKindLiterals)`.
- Backend `post.service.ts` drops the `as PostKind` cast.
- Three frontend call sites pass uppercase enum values: `BookReviewPage` (`'review'` → `PostKind.REVIEW`), `BookReviewsPreview` (same), `RemarkPreview` (`'remark'` → `PostKind.REMARK`).

### `QUOTE` → `EXCERPT` rename
- Prisma `PostKind.QUOTE` → `PostKind.EXCERPT`. One-shot data migration: `UPDATE Post SET kind = 'EXCERPT' WHERE kind = 'QUOTE'`.
- Contract const + literal union, route tree (`/quote/...` → `/excerpt/...`), app directory (`package/app/src/quote/` → `package/app/src/excerpt/`), components (`QuoteCard`, `QuotePage`, etc. → `ExcerptCard`, `ExcerptPage`), hybrid `QuoteExcerpt*` → `Excerpt*`, i18n keys (`quote.*` → `excerpt.*`), `buildUrl` case, Meili index filter, seed/mock data.
- **BREAKING** for any external consumer reading the `QUOTE` literal. No internal redirects from `/quote/...` are added — the rename is clean.

### Excerpt source metadata
- `postExtraSchema` grows an optional `source` field. The schema is a discriminated union with two modes:
  - `mode: 'unit'` — internal pointer with `unitId` and a free-form author-written `title`. Renders as an in-app link via `<Link to="/unit/$unitId">`. The unit resolver picks the typed destination at click time.
  - `mode: 'url'` — any well-formed URL (rezics or external) with a free-form `title`. The renderer routes through the global `<Link>` primitive (introduced by the `outbound-link-protection` change), so external destinations get the confirmation modal automatically.
- `source.unitId` (when used) MAY point at any unit; convention says it identifies the citation location (e.g., a chapter) inside the work named by the post's `targetUnitId`, but no backend ancestry constraint is enforced. Cross-work citation is permitted.
- `source.title` is a snapshot — what the author wrote at post time. It does not auto-update if the linked unit is renamed.
- The excerpt editor's source picker UX is "URL-first": a single URL input field is the primary affordance. If the URL classifies as an in-app `/unit/:id` route or a known typed-page route, the form auto-extracts the unit id, switches the stored value to `mode: 'unit'`, and pre-fills `title` from the unit's display name (still freely editable). A collapsed "pick from this work" section exposes a tree under `targetUnitId` for users who prefer browsing.

### Unit resolver
- `/unit/:unitId` becomes a loader-driven redirect with no rendered output. The loader fetches the unit, runs `buildUrl(unit)` to find its typed destination, and either redirects there or falls through to `/unit/:unitId/view`.
- `/unit/:unitId/view` absorbs the current generic renderer behavior — the fallback for unit types that have no typed page yet.
- Status / visibility rules mirror the typed pages: DELETED → 404; DRAFT / PRIVATE / UNLISTED → 404 for non-owner, redirect for owner. A shared `canAccessUnit(unit, viewer)` helper keeps this consistent.
- Redirect-loop safety: an integration test asserts that for every unit type, resolving from `/unit/:id` terminates in a single redirect.

## Capabilities

### New Capabilities
- `unit-resolver`: `/unit/:unitId` resolver loader, typed-page redirect via `buildUrl`, generic fallback at `/unit/:unitId/view`, status/visibility rules, redirect-loop safety.

### Modified Capabilities
- `post-kind-contract`: rename `QUOTE` to `EXCERPT` across the PostKind union, scenarios, and `buildUrl` routing; tighten `postListQuerySchema.kind` to use the literal union.
- `type-extension-post`: rename `kindKey = "quote"` to `kindKey = "excerpt"`; add `extra.source` discriminated union (`unit` or `url` mode); document the snapshot semantics of `source.title`.
- `composed-editors`: add the excerpt-source picker as a composed editor concern (URL-first input with auto-classification, collapsed unit-tree picker fallback, free-form title pre-filled from internal-unit display name).

## Impact

### Affected Packages
- `package/server` — Prisma `PostKind` rename + data migration; `post.service.ts` cast removal; `extra.source` validation in `post.api.ts`; Meili sync filter update.
- `package/contract` — `postKindLiterals` value rename; `postListQuerySchema.kind` tightening; `excerptSourceSchema` discriminated union added to `postExtraSchema`; `buildUrl` route case rename.
- `package/api` — `PostFilters` inherits the narrowed type automatically; no manual change.
- `package/app` — directory rename `quote/` → `excerpt/`; component renames; route tree (`/quote/...` → `/excerpt/...`, plus the `/unit/:unitId` resolver and `/unit/:unitId/view` split); excerpt-source picker UI; markdown rendering of `source` link via `<Link>`; i18n key migration; three lowercase-call-site fixes.
- `package/admin` — minor surface (admin lists referencing PostKind values).
- `package/search` — Meili index filter literal update.
- `package/server/seed` and any mocks — `mockQuotes.ts` → `mockExcerpts.ts`, `kind: 'QUOTE'` → `kind: 'EXCERPT'`.

### Backward Compatibility
- **Database:** one-shot `UPDATE Post SET kind = 'EXCERPT' WHERE kind = 'QUOTE'`. No rollback strategy beyond the inverse update; the rename is committed.
- **Frontend routes:** no `/quote/...` → `/excerpt/...` redirects. External links bookmarked at `/quote/...` 404 after this change.
- **Contract:** the `QUOTE` literal is removed entirely; consumers must move to `EXCERPT`. Inside this monorepo this is a compile-time fix; external consumers (none currently known) must migrate.
- **`source` field:** new and optional. Existing posts without `extra.source` simply render without a source link.
- **Resolver:** `/unit/:unitId/view` is a new route; the generic-renderer behavior is preserved there.

### Dependencies
- **Prerequisite:** `outbound-link-protection` change must land first. The excerpt-source renderer consumes the `<Link>` primitive (`@rezics/ui`) for both `unit`-mode and `url`-mode rendering. Without it, this change would have to ship a one-off external-link handler that the next change would immediately delete.

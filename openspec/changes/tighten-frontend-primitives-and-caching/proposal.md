## Why

Three related frontend hygiene issues are eroding UX consistency and cache correctness in the app package:

1. **Score input is hand-rolled.** `RemarkInlineForm` and `RemarkEditDialog` render a custom `ToggleButtonGroup` of ten numeric buttons instead of MUI `<Rating>`. Two unused MUI Rating wrappers in `@rezics/ui` (`RatingWithInput`, `ScoreFormEdit`) add dead weight. The contract already enforces integer 1–10 (`SCORE_MIN/MAX` in `@rezics/contract`), so a custom widget has no technical justification.

2. **TanStack Query keys are half-disciplined.** Domain key factories exist in `package/api/src/<domain>/<domain>.keys.ts`, but several take filter parameters (`PostFilters`, kind, limit) and drop them on the floor — notably `postKeys.byTarget()`. Components also reach around the factories: `ReviewsPage.tsx:80`, `UserUnitsPage.tsx:98`/`:177`, and tag/realm pages each write inline `queryKey: [...]` literals. The result is cache collisions (REVIEW and REMARK queries for the same book sharing a key, batch-reaction queries keyed on unstable array identity) and queries that cannot be reliably invalidated.

3. **List empty states are inconsistent.** Some lists show a clear message (`SearchResultList` → "No results found"; `ReviewSearchPage` → "No reviews found"; `ReviewListSection` → "No reviews yet."). Others render silently (`RemarkList`, `ExcerptList`, `ExcerptPreview` when `units = []`). Copy is unlocalized English, sometimes mixed with a single Chinese string inside `ExcerptCard`. There is no shared empty-state primitive or contract.

Fixing these together is cheaper than as three separate changes: they all touch the same feature layers (remark + review + excerpt), share the same validation pass (tsc per package + convention check + dev-server smoke), and the fixes interlock — e.g., empty-state contract depends on hooks returning clean `data.length === 0` states, which depends on query keys not spilling across filters.

## What Changes

### Rating primitive
- **BREAKING (UI only)**: Replace `ToggleButtonGroup` score picker with MUI `<Rating max={SCORE_MAX} precision={1}>` in `RemarkInlineForm.tsx` and `RemarkEditDialog.tsx`. Visual appearance changes from numbered buttons to 10 stars.
- Delete `package/app/src/engagement/components/ScoreInput.tsx`.
- Delete `package/ui/src/primitive/control/rating/Rating.tsx` (`RatingWithInput`).
- Delete `package/ui/src/composite/forms/field/RatingField.tsx` (`ScoreFormEdit`).
- New rule: score inputs SHALL render MUI `<Rating>` directly. No custom pickers, no wrappers.

### TanStack Query key discipline
- `postKeys` and any other list/byTarget factory SHALL embed filter parameters (e.g., `kind`, `limit`, `cursor`) into the key array when those filters vary the response. `postKeys.byTarget(targetUnitId, filters)` becomes filter-aware.
- Remove inline `queryKey: [...]` literals from components. Identified sites: `review/pages/ReviewsPage.tsx`, `shelf/pages/UserUnitsPage.tsx`, `tag/pages/TagByUnitPage.tsx`, `tag/components/TagListEdit.tsx`, `realm/pages/RealmManagePage.tsx`. Each call site migrates to a per-domain factory (existing or new).
- Introduce a batch-reaction-summary hook / key factory so `ReviewsPage` and `UserUnitsPage` stop writing `["reaction-summary-batch", ...]` by hand. Stable key composition: normalize `targetIds` (sorted, de-duplicated) before they enter the key.
- Enforcement via `bun run check:convention`: forbid inline `queryKey: [` literals outside `package/api/src/**/*.keys.ts` (and the query options / mutations files that import those factories).

### List empty states
- Introduce a shared `EmptyState` primitive (location decided in design.md) with slots for icon, title, description, and optional action — wrapping MUI `Stack` + `Typography` for consistent spacing and theming.
- All user-facing list views SHALL render `EmptyState` when `data.length === 0` and the query is in a settled (non-loading, non-error) state. First-pass targets: `RemarkList`, `ExcerptList`, `ExcerptPreview`, `ReviewSearchPage`, `ReviewListSection`, `SearchResultList`. Existing text-only empty messages (e.g., "No reviews yet.") migrate to `EmptyState`.
- Move empty-state copy through i18n keys; no more mixed-language string literals in `ExcerptCard`.
- Per-field fallback ("暂无摘录内容" inside a card for a missing description) is distinct from list-level empty state and SHALL remain a localized per-card fallback, not be conflated with `EmptyState`.

## Capabilities

### New Capabilities
- `score-input-primitive`: Rendering convention that all score input uses MUI `<Rating>` directly with `max = SCORE_MAX` and `precision = 1`. Forbids custom pickers and wrappers.
- `tanstack-query-keys`: Query-key discipline — every interactive query uses a per-domain key factory in `package/api/src/**/*.keys.ts`; filter params that vary the response SHALL be embedded in the key; no inline `queryKey` literals in components; arrays inside keys SHALL be normalized (sorted, de-duplicated) for stable identity.
- `list-empty-state`: Shared `EmptyState` component and the contract that every list-rendering screen uses it for the `data.length === 0` settled state; copy passes through i18n.

### Modified Capabilities
- `review-remark-ux`: Score input language updated to reference `score-input-primitive`; remark list display updated to require `list-empty-state` when no remarks exist.

## Impact

- **Affected packages**:
  - `package/app` — remark forms, review pages, shelf pages, tag pages, realm pages, excerpt components, search result components, new empty-state integrations.
  - `package/ui` — two rating wrappers deleted; potentially new `EmptyState` primitive (see design.md for placement).
  - `package/api` — post / reaction / tag / realm key factories extended or introduced; new batch-reaction-summary hook.
  - Repo tooling — `bun run check:convention` extended with an inline-queryKey rule.
- **APIs / contracts**: none changed in `@rezics/contract`. Backend endpoints unchanged; client-side caching discipline only.
- **Database**: none.
- **Backward compatibility**: Visual change in remark score input (buttons → stars); users retain existing scores (no data migration). Cache keys change, which invalidates any persisted query cache on deploy — acceptable for a SPA with no cache persistence layer today.
- **Tests**: snapshot tests covering migrated components (remark forms, review lists, excerpt list, search results) will need refresh. New component-level tests for `EmptyState` and the batch-reaction-summary hook are scoped in tasks.md.
- **i18n**: new translation keys for list empty-state copy; existing English strings migrate to keys.

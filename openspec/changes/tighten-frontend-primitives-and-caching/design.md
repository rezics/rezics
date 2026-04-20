## Context

This change bundles three frontend hygiene fixes in the Rezics book-library monorepo. Each sits in a different layer but they share the same audit surface (app feature folders), validation pass (per-package tsc + `check:convention` + dev-server smoke), and stakeholders (remark / review / excerpt reviewers).

**Current state — per thread.**

### Rating primitive
- Custom `ScoreInput` at `package/app/src/engagement/components/ScoreInput.tsx` renders a `ToggleButtonGroup` of 10 integer buttons.
- Used by `RemarkInlineForm.tsx:61` and `RemarkEditDialog.tsx:63`.
- Two MUI-Rating wrappers in `@rezics/ui` are dead code: `RatingWithInput` (`primitive/control/rating/Rating.tsx`), `ScoreFormEdit` (`composite/forms/field/RatingField.tsx`). Zero import sites.
- Contract is already integer-only: `SCORE_MIN=1`, `SCORE_MAX=10`, `scoreValueSchema = t.Integer({ minimum, maximum })` in `package/contract/src/score.ts`.

### TanStack Query key discipline
Key factories live in `package/api/src/<domain>/<domain>.keys.ts`:
- `postKeys.byTarget(targetUnitId)` → `["posts", "target", targetUnitId]` — filters are accepted by `postKeys.list()` but `byTarget()` does not receive them. The same key is used by both REVIEW and REMARK fetches for a given book, colliding.
- `reactionKeys.summary(targetId)` → `["reactions", "summary", { targetId }]` — per-target key is well-formed.
- `scoreKeys.*` — all primitive-typed, well-formed.
- Inline `queryKey` literals in components (audited):
  - `review/pages/ReviewsPage.tsx:80` → `["reaction-summary-batch", tab, bookUnitId, currentTargetIds]`
  - `shelf/pages/UserUnitsPage.tsx:98` → `["reaction-summary-batch", "user", userId, "shelves", shelfTargetIds]`
  - `shelf/pages/UserUnitsPage.tsx:177` → `["reaction-summary-batch", "user", userId, tab, reviewTargetIds]`
  - `tag/pages/TagByUnitPage.tsx:22` and `:86` → `["tag", "detail", id]`
  - `tag/components/TagListEdit.tsx:60` → `["tags", "search", searchTerm]`
  - `realm/pages/RealmManagePage.tsx:71` → `["realms", "detail", realmId]`
- Three of these embed unstable array identity (`currentTargetIds`, `shelfTargetIds`, `reviewTargetIds`) into the key without normalization.
- No convention check currently forbids inline `queryKey` literals.

### List empty states
- Explicit empty-state sites (inconsistent copy, unlocalized):
  - `ReviewSearchPage.tsx:52–55` → `<Typography>No reviews found</Typography>`
  - `ReviewListSection.tsx:29–34` → `<Typography>No reviews yet.</Typography>`
  - `SearchResultList.tsx:78–83` → `<div class="py-8 text-center"><Typography>No results found</Typography></div>`
- Silent fallthrough sites:
  - `RemarkList.tsx` — maps `posts` into a `<Stack>`; empty array renders empty `<Stack>`.
  - `ExcerptList.tsx` — same pattern.
  - `ExcerptPreview.tsx:31–35` — passes empty array to `ExcerptList`.
- Per-card field fallback (localized Chinese): `ExcerptCard.tsx:35` shows `"暂无摘录内容"` when `excerpt.translations?.[0]?.description` is absent. This is a distinct concern from list-level empty state.
- No shared `EmptyState` component in `@rezics/ui` or `package/app/src/common/`. No existing spec covers list empty-state uniformly (two specs — `realm-frontend`, `realm-tag-context` — mention it in passing).

**Stakeholders**: remark authors, review readers, excerpt browsers, future frontend contributors who need a referenceable convention.

## Goals / Non-Goals

**Goals:**
- Replace the hand-rolled score picker with MUI `<Rating>` at every remaining call site; delete the three dead / obsolete components.
- Lock in a query-key discipline that makes cache keys filter-aware, component-free (no inline literals), and array-stable, then enforce it with a convention check.
- Introduce one shared `EmptyState` primitive and migrate identified list views to use it with i18n'd copy.
- Encode the three rules in specs so future work cannot regress silently.

**Non-Goals:**
- No change to `@rezics/contract` schemas or backend endpoints.
- No visual redesign of `EmptyState` beyond MUI primitives (`Stack`, `Typography`, optional icon slot). A design-system pass is a separate initiative.
- No audit or rewrite of query keys outside the app-level cache layer (e.g., Meilisearch query construction internals).
- No attempt to persist or hydrate the TanStack cache across reloads.
- No fine-grained cache normalization (e.g., normalized entity stores). "Unit-level granularity" here means each list/detail/filter variant has its own cache line, not that every entity is individually keyed across all queries.

## Decisions

### D1. Score input uses MUI `<Rating>` directly
Each form imports `Rating` from `@mui/material/Rating` with `max={SCORE_MAX}`, `precision={1}`, `value: number | null`, `onChange: (_, value) => setScore(value)`. No wrapper.
Alternatives rejected: `RatingWithInput` (redundant TextField for integer-only domain); a new `@rezics/app`-local wrapper (no responsibility to add); keeping the `ToggleButtonGroup` (contradicts MUI-first convention).

### D2. Delete the two unused `@rezics/ui` rating wrappers
Both are zero-import dead code. Keeping them invites regression under the new `score-input-primitive` rule.

### D3. Query-key factories are the single source of keys
**Every** interactive query's `queryKey` SHALL come from a factory in `package/api/src/<domain>/<domain>.keys.ts`. Components and pages SHALL NOT write `queryKey: [...]` literals. Hooks in `package/api/src/<domain>/<domain>.queries.ts` (TanStack `queryOptions` / `useQuery` wrappers) are the only permitted callers of the factories.
Alternative rejected: allowing inline literals "for simple cases" — every current violation started as "just a simple case" and calcified.

### D4. Filter params go into the key array, not the queryFn's closure
When a factory's parameters affect the server response (e.g., `kind: PostKind`, `limit`, `cursor`, `sort`, `searchTerm`), those parameters SHALL be embedded into the key array. Example evolution:

```ts
// before
byTarget: (targetUnitId: string) =>
  ["posts", "target", targetUnitId] as const,

// after
byTarget: (targetUnitId: string, filters?: PostByTargetFilters) =>
  ["posts", "target", targetUnitId, filters ?? null] as const,
```

The object literal (`filters`) is serializable and structurally stable under TanStack's key equality. Treating absent filters as `null` (not `undefined`) keeps the key shape deterministic.
Alternative rejected: spreading filters as positional elements — less self-documenting and position-fragile.

### D5. Arrays inside keys must be normalized
For keys that legitimately contain arrays (e.g., `targetIds` for batch reactions), the factory SHALL sort and de-duplicate before placing the array in the key. `[b, a, a]` and `[a, b]` must produce identical keys. Factory helper:

```ts
const normalizeIds = (ids: readonly string[]) =>
  Array.from(new Set(ids)).sort();
```

This eliminates the identity-churn bug present in the three `reaction-summary-batch` sites.

### D6. A new `reactionKeys.summaryBatch(targetIds)` factory and `useBatchReactionSummary` hook
The three inline `reaction-summary-batch` sites migrate to:

```ts
reactionKeys.summaryBatch: (targetIds) =>
  ["reactions", "summary", "batch", normalizeIds(targetIds)] as const,

useBatchReactionSummary(targetIds, options?)
```

Named `summaryBatch` (not a namespaced string) so it shares the `["reactions", "summary", ...]` prefix, allowing a single `invalidateQueries({ queryKey: reactionKeys.summaries() })` call to invalidate both scalar and batch variants.

### D7. `EmptyState` lives in `@rezics/ui`
New file: `package/ui/src/composite/feedback/EmptyState.tsx`. API:

```tsx
<EmptyState
  title={t("list.empty.reviews.title")}
  description={t("list.empty.reviews.description")}  // optional
  icon={<InboxOutlinedIcon />}                        // optional
  action={<Button>Write a review</Button>}            // optional
/>
```

Implementation: MUI `Stack` with centered `Typography`, optional icon at the top, optional action at the bottom. Responsive spacing via `sx={{ py: { xs: 4, sm: 6 } }}`.
Alternatives rejected: putting it in `package/app-shell` (wrong layer; not a shell concern); a per-feature empty-state component (the whole point is de-duplication).

### D8. Empty-state contract is about the settled-empty case
`EmptyState` is shown when the query is **settled** (`!isLoading && !error`) **and** the data collection is empty. Loading and error states remain separate. `QueryErrorDisplay` (already exists) handles error. Loading is the caller's responsibility (current pattern: conditional `t("common.loading")` or skeleton).

### D9. i18n keys for empty-state copy
Each migration site introduces two keys: `<feature>.list.empty.title` and optionally `<feature>.list.empty.description`. Existing hard-coded strings ("No reviews found", "No reviews yet.", "No results found") become those keys. Namespacing: feature root (e.g., `review`, `excerpt`, `remark`, `search`).

### D10. Card-level field fallbacks stay distinct from `EmptyState`
`ExcerptCard` renders a short localized fallback for a missing description *within a card* (the card still exists). That is not an empty state — it is a per-field fallback. It SHALL stay, migrated only so far as its literal string moves into an i18n key (to align with D9). `EmptyState` is solely for `list.length === 0`.

### D11. Enforcement — convention check
Add a rule to `bun run check:convention`:

> Forbid the string `queryKey: [` in `package/app/**/*.{ts,tsx}`, `package/admin/**/*.{ts,tsx}`, and `package/ui/**/*.{ts,tsx}`. Allow it only in `package/api/src/**/*.{keys,queries,mutations}.ts`.

Implementation: extend the existing conventions script with one regex check. Failure message: cite the offending file and suggest the factory to use.

### D12. Migration ordering
The three threads can be merged in one PR but implemented in isolated commits:
1. `score-input-primitive` (smallest blast radius; 2 form files + 3 deletions).
2. `tanstack-query-keys` (biggest; touches 7 component sites + key factories + convention check).
3. `list-empty-state` (depends on (2) settling, because the hook states used by `EmptyState` call sites must be clean).

## Risks / Trade-offs

- **[Risk] The convention check false-positives on legitimate advanced uses (e.g., a bespoke `invalidateQueries` passing an inline key prefix).**
  → Mitigation: the rule matches `queryKey: [` specifically (not `queryKey:` alone), which targets `useQuery` / `queryOptions` configs. `invalidateQueries({ queryKey: postKeys.lists() })` uses a factory call and doesn't trigger the pattern.

- **[Risk] Users accustomed to the numeric buttons lose the ability to read exact values at a glance.**
  → Mitigation: MUI `<Rating>` renders a default hover tooltip showing the integer value; optionally enable `getLabelText` for accessibility.

- **[Risk] Changing `postKeys.byTarget()` to take filters invalidates persisted caches and breaks any code that currently relies on the filterless key matching.**
  → Mitigation: no cache persistence layer exists today; in-memory cache invalidation on deploy is a refetch, not a bug. Repo-wide grep during implementation ensures no caller relies on the old signature.

- **[Risk] i18n key churn across three features in one change.**
  → Mitigation: keys are additive (new); renames of existing hard-coded strings are mechanical. A single translation PR follow-up can back-fill non-English locales.

- **[Risk] Three workstreams in one change inflate PR size and review cost.**
  → Mitigation: commit-level separation (D12) lets reviewers read them in sequence; the change boundary stays with OpenSpec, not Git. Alternative — three separate changes — was rejected per user direction (higher coordination cost, overlapping touchpoints in remark + review + excerpt).

- **[Trade-off] `EmptyState` in `@rezics/ui` pulls a new module into the shared package; small API surface, worth the single source of truth.**

## Migration Plan

1. **Rating (fastest, isolated):** swap both remark forms to MUI `<Rating>`, delete `ScoreInput.tsx` and the two `@rezics/ui` wrappers. Verify per-package tsc.
2. **Query keys:**
   a. Extend `postKeys.byTarget()` and any other filter-bearing factory to embed filters. Update call sites in `package/api/src/post/post.queries.ts`.
   b. Introduce `reactionKeys.summaryBatch` + `useBatchReactionSummary` hook. Migrate the three inline `reaction-summary-batch` sites.
   c. Introduce factories for tag / realm inline keys; migrate those sites.
   d. Add the `queryKey: [` check to `bun run check:convention`. CI gate.
3. **Empty states:**
   a. Create `EmptyState` in `@rezics/ui`, export via the package barrel.
   b. Migrate explicit sites (`ReviewSearchPage`, `ReviewListSection`, `SearchResultList`) — swap hard-coded `<Typography>` to `EmptyState` with i18n keys.
   c. Add empty-state rendering to silent sites (`RemarkList`, `ExcerptList`, `ExcerptPreview`).
   d. Move `ExcerptCard`'s per-field fallback string into an i18n key (distinct from list-level empty state).
4. **Validation:** full `bun run check:convention`, per-package `tsc --noEmit`, targeted tests, dev-server smoke of each migrated screen.

Rollback: revert per-commit; no data-layer or contract changes to unwind.

## Open Questions

- **`postKeys.byTarget` filter shape**: accept the existing `PostFilters` TypeScript type, or introduce a narrower `PostByTargetFilters` that excludes `targetUnitId` (already positional)? Implementation chooses; document in the tasks.
- **Batch-reaction-summary endpoint shape on the server**: unchanged (`reaction-summary` spec already describes it). No contract work needed — the change is purely frontend hook + key composition.

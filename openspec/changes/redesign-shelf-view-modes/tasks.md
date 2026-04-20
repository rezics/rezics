## 1. Contract & API type updates

- [ ] 1.1 Update `ShelfView` in `package/api/src/shelf/shelf.types.ts` from `"grid" | "list" | "review"` to `"nested" | "flat" | "masonry"`.
- [ ] 1.2 Grep the repo for the literals `"grid"`, `"list"`, `"review"` in proximity to `ShelfView`/`viewMode` identifiers (especially `package/api`, `package/app`, `package/admin`, `package/contract`) and migrate every consumer; remove any dead legacy references.
- [ ] 1.3 Check `package/contract` for any Typebox schema that enumerates `ShelfView`; update the literal set if present.
- [ ] 1.4 Run `tsc --noEmit` in `package/api`, `package/app`, `package/admin`, `package/contract` per the project's "tsc per package" convention and resolve any type errors introduced by the rename.

## 2. Pure derivation module (`package/app/src/shelf/models/`)

- [ ] 2.1 Create `package/app/src/shelf/models/shelfStream.ts` exporting `ShelfStreamEntry` (discriminated union `prime | review`) and `deriveShelfStream(enriched, mode, sort, sortPrimeOnly)` per the signature in `design.md` §Decision 3.
- [ ] 2.2 Implement `nested` emission: one `{ kind: 'prime', enriched }` per shelf item; attached reviews stay on `enriched.attachedReviews`.
- [ ] 2.3 Implement `flat`/`masonry` emission: for each item emit the `prime` entry followed by one `{ kind: 'review', parentItemRef, review }` per attached review.
- [ ] 2.4 Implement comparator wiring: `manual` → order by `ShelfItem.position`; `time` → by `createdAt` desc; `title` → by `Intl.Collator` on `titleOf(entry)`.
- [ ] 2.5 Implement `sortPrimeOnly = true` behaviour: comparator applied to primes only; each prime's reviews follow it in original `reviewIds` order.
- [ ] 2.6 Implement `sortPrimeOnly = false` behaviour in flat/masonry: flatten first, then apply comparator across all entries as peers. Manual sort ignores the flag.
- [ ] 2.7 Move/extend `package/app/src/shelf/pages/titleOf.ts` to handle `ShelfStreamEntry` (both `prime` and `review` kinds); ensure the model has no React or hooks imports.
- [ ] 2.8 Ensure `package/app/src/shelf/models/` has no imports from `hooks/`, `states/`, or any React runtime per the feature-standard rule.

## 3. Unit tests for derivation

- [ ] 3.1 Add `package/app/src/shelf/models/shelfStream.test.ts` using `bun:test`.
- [ ] 3.2 Test: nested mode emits exactly N entries for a shelf with N items regardless of review count.
- [ ] 3.3 Test: flat mode emits N + M entries (N primes, M reviews) in prime-adjacent order when `sortPrimeOnly = true`.
- [ ] 3.4 Test: flat + title sort + `sortPrimeOnly = true` keeps each review immediately after its prime even when the review's title would sort elsewhere.
- [ ] 3.5 Test: flat + title sort + `sortPrimeOnly = false` interleaves reviews and primes by title per the scenario in `specs/shelf-display-modes/spec.md`.
- [ ] 3.6 Test: manual sort ignores `sortPrimeOnly` and produces identical output for both values of the flag.
- [ ] 3.7 Test: flat and masonry produce identical stream order for the same inputs (layout does not affect derivation).
- [ ] 3.8 Test: derivation is pure — calling it twice in a row returns deep-equal arrays.
- [ ] 3.9 Run `bun test` inside `package/app` and confirm all new tests pass.

## 4. `ShelfPage.tsx` wiring

- [ ] 4.1 Update the default `useState` for view mode in `package/app/src/shelf/pages/ShelfPage.tsx` to `"nested"`.
- [ ] 4.2 Add `sortPrimeOnly: boolean` state with default `true`.
- [ ] 4.3 Add a read-path legacy mapping function `normalizePersistedViewMode(raw): ShelfView | undefined` that maps `"review" → "nested"`, `"list" → "flat"`, `"grid" → "masonry"`, passes through the three new literals, and returns `undefined` for anything else. Apply it when reading `shelf.extra.viewMode`.
- [ ] 4.4 Replace the inline `sortedEnriched` `useMemo` with a call to `deriveShelfStream(hydration.enriched, effectiveViewMode, sortMode, sortPrimeOnly)`.
- [ ] 4.5 Filter orphans from the derived stream (both `prime` entries whose itemRef is an orphan, and `review` entries whose parent's itemRef is an orphan).
- [ ] 4.6 Replace the ToggleButtonGroup with three buttons labelled/iconed for `nested` / `flat` / `masonry` per `design.md` §Decision 7.
- [ ] 4.7 Add the `sortPrimeOnly` checkbox; gate its visibility with `mode ∈ {flat, masonry} && sort !== 'manual'`. Preserve state across hide/show cycles (don't reset on hide).
- [ ] 4.8 Render branches:
  - `nested` → existing grid/list of one card per prime; reviews surfaced via renderer tabs.
  - `flat` → vertical stack of rows, one row per stream entry.
  - `masonry` → CSS masonry container (see task 5) over the stream entries.

## 5. `ShelfItemRenderer.tsx` updates

- [ ] 5.1 Change the renderer to accept a `ShelfStreamEntry` instead of `EnrichedShelfItem + viewMode`, or add a sibling component that renders review entries (whichever is cleaner — keep one codepath per entry kind).
- [ ] 5.2 For `kind: 'review'` entries, render via the existing `ReviewCard` from `@/review/components/item/ReviewCard`. Do not render as a tab.
- [ ] 5.3 For `kind: 'prime'` entries in `nested` mode, render the existing prime card and attach reviews as tabs (new — use MUI `Tabs` from `@rezics/ui`'s MUI-first convention). Each tab body shows one `ReviewCard`.
- [ ] 5.4 For `kind: 'prime'` entries in `flat` or `masonry` mode, render the prime card with no tab strip (reviews are now their own entries).
- [ ] 5.5 Implement the masonry container with `// MOCK:` annotation per the project's mock convention (e.g. CSS `column-count` responsive to breakpoint). State in the comment that this is a placeholder until the real masonry primitive lands.

## 6. Persistence path

- [ ] 6.1 On the existing write path that updates `shelf.extra.viewMode` (owner-only), ensure the value written is one of the new literals. No new write path needed — this is a one-line literal change.
- [ ] 6.2 Manually verify in a dev session that a shelf whose `extra.viewMode` was written as `"grid"` by a prior UI version opens in the new `masonry` view, and that changing the view and saving overwrites it with `"masonry"`.

## 7. Validation & cleanup

- [ ] 7.1 Run `bun test` in `package/app` — all new and pre-existing shelf tests pass.
- [ ] 7.2 Run `tsc --noEmit` per affected package per the "tsc per package" convention.
- [ ] 7.3 Run `bun run check:convention` to confirm the convention gate still passes.
- [ ] 7.4 Start the dev server and manually exercise: nested mode default, flat with prime-only sort (title), flat with prime-only sort off, masonry layout, legacy `"grid"` value loaded as masonry.
- [ ] 7.5 Grep for any remaining `"grid"`/`"list"`/`"review"` literal strings used as `ShelfView` values and confirm none remain in live code (mock data or // MOCK: comments may persist).
- [ ] 7.6 Confirm `openspec validate redesign-shelf-view-modes` passes before archiving.

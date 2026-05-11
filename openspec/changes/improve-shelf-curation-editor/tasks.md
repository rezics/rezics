## 1. Dependency Alignment

- [ ] 1.1 Inspect `add-user-hover-preview` after it lands or reaches usable shape; record the public user preview export path and required user data shape
- [ ] 1.2 Rebase or adjust this implementation plan if `add-user-hover-preview` changes `PostAuthorHeader`, user feature exports, or profile route helpers

## 2. Unit Card Foundation

- [ ] 2.1 Add a unit summary model under `package/app/src/unit/models/` for `UnitCard` input data, including title, kind, image, content preview, author, addedAt, and translation metadata
- [ ] 2.2 Implement pure mapper helpers for common sources: `UnitDTO`-like data and hydrated shelf entries
- [ ] 2.3 Implement `UnitCard` under `package/app/src/unit/components/` with fixed-height layout, clamped text, stable image sizing, and token-backed styles
- [ ] 2.4 Wire author rendering through the shared user hover preview component from the user feature; provide a narrow slot only if needed for integration
- [ ] 2.5 Export `UnitCard` and related public types from `package/app/src/unit/index.ts`
- [ ] 2.6 Add `UnitCard` Storybook stories for default, missing image, long text, translation metadata, shelf added-time metadata, and author preview states
- [ ] 2.7 Add focused tests for unit summary mapper helpers

## 3. Shelf Sort Model

- [ ] 3.1 Replace field-only shelf sort types with `{ field, order }` types in `@rezics/api/shelf` and app shelf models
- [ ] 3.2 Rename ambiguous `time` sort usage to `addedAt` where the timestamp is `ShelfItem.createdAt`
- [ ] 3.3 Update `deriveShelfStream` to sort by manual position, shelf added time, and title in both ascending and descending directions
- [ ] 3.4 Add model tests for manual asc, manual desc, addedAt asc, addedAt desc, title asc, title desc, and deterministic tie breakers
- [ ] 3.5 Migrate all app callsites from `ShelfSortMode` string state to the new sort state and run `rg -n "ShelfSortMode|sortMode|\"time\""` to confirm no stale shelf sort usage remains

## 4. Fourth Shelf View

- [ ] 4.1 Extend `ShelfView` to include `"unit"` and update persisted view-mode normalization to accept the new value
- [ ] 4.2 Update shelf detail view controls to expose the fourth view with a clear visible label
- [ ] 4.3 Update shelf editor view controls to expose the fourth view and prefer it for curation workflows where appropriate
- [ ] 4.4 Render `viewMode = "unit"` using fixed-height `UnitCard` rows through a shelf-to-unit-summary adapter
- [ ] 4.5 Add shelf stream/rendering tests or stories that cover `unit` view with books, posts/reviews, shelves, tags, missing images, and long text

## 5. Add Item Composition

- [ ] 5.1 Add `UnitSearchSelect` or equivalent unit feature component backed by existing unit search/list query APIs
- [ ] 5.2 Refactor existing URL import behavior into a source component usable inside a broader `Add item` composition
- [ ] 5.3 Add contextual browse behavior that appears only after a parsed URL/search result/external prop supplies a valid work-like context
- [ ] 5.4 Implement `UnitAddPicker` or equivalent composition exported from `@/unit`
- [ ] 5.5 Replace shelf editor's direct `UnitPicker` block with the `Add item` composition and ensure repeated additions keep the panel mounted
- [ ] 5.6 Add Storybook coverage for search results, URL candidates, browse-after-resolution, parse errors, empty search, and repeated add actions

## 6. Reorder Controls And Drag Performance

- [ ] 6.1 Gate drag handles, cross-page move controls, and dnd sensors to `viewMode === "unit"` and `sort.field === "manual"`
- [ ] 6.2 Hide cross-page move controls under all non-manual sort fields and all rich views
- [ ] 6.3 Replace full rich-card dragging with a lightweight drag overlay for unit rows
- [ ] 6.4 Ensure unit reorder rows reserve fixed height before, during, and after drag; clamp text and stabilize image dimensions
- [ ] 6.5 Update position calculation for manual ascending and manual descending visual orders
- [ ] 6.6 Fix cross-page move semantics so frontend and server use the same page size and active manual order, or replace cross-page move with client-resolved destination-edge reorder
- [ ] 6.7 Add tests for reorder-control visibility and asc/desc position math

## 7. Added-Time Metadata

- [ ] 7.1 Ensure shelf item `createdAt` is available in the editor row adapter and unit view summary
- [ ] 7.2 Render localized added-time metadata in unit rows
- [ ] 7.3 Ensure added-time metadata is visible when sorting by `addedAt`

## 8. Validation

- [ ] 8.1 Run focused model tests for unit card summary mapping, shelf stream sorting, and position math
- [ ] 8.2 Run `bun -F @rezics/app build`
- [ ] 8.3 Run relevant Storybook smoke checks for `UnitCard`, unit add composition, and shelf editor stories
- [ ] 8.4 Run `bun run check:convention` and fix new convention violations
- [ ] 8.5 Manually open a shelf editor, switch to unit view, add via search, import via URL, reveal browse from a resolved work, drag in manual desc, save, refresh, and verify order plus added-time metadata persist

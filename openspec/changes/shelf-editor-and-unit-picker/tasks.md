## 1. Shared fractional-index util

- [ ] 1.1 Move `package/api/src/tag/fractional-index.ts` to `package/api/src/shared/fractional-index.ts`; re-export from the original location so the tag feature keeps working without touching callsites
- [ ] 1.2 Update `package/api/src/tag/fractional-index.test.ts` import path; confirm `bun -F @rezics/api test` passes for the tag suite
- [ ] 1.3 Verify no `package/server` import touches the client-side fractional file (server has its own `package/server/src/shelf/fractional-index.ts`); document the dual-implementation invariant in the moved file's header comment

## 2. Contract additions for batch op

- [ ] 2.1 In `package/contract/src/shelf.ts`, add `shelfItemBatchOpSchema` as the discriminated union of `add | reorder | reorderToPage | delete | setTags` ops; export the static type
- [ ] 2.2 Add `shelfItemBatchRequestSchema` (array of ops, optional `baseVersion`) and `shelfItemBatchResponseSchema` (`results: Array<{ status, op, item?, reason? }>`)
- [ ] 2.3 Run `bun -F @rezics/contract build` to confirm Typebox schemas compile

## 3. Server: batch endpoint

- [ ] 3.1 In `package/server/src/shelf/shelf.service.ts`, add a `applyBatch(shelfUnitId, ops)` method that wraps a `prisma.$transaction` and applies each op in order, collecting per-op results
- [ ] 3.2 Implement the `reorderToPage` branch: read the destination page's first item via the same cursor query as `listItems`, compute the new position via the server-side `fractional-index.keyBefore`, and apply
- [ ] 3.3 Enforce a 200-op-per-request cap (configurable via constant in the service); return HTTP 413 above the cap
- [ ] 3.4 Wire the route `PATCH /shelf/:shelfUnitId/items/batch` in `package/server/src/shelf/shelf.api.ts` with the new contract schemas and existing ownership middleware
- [ ] 3.5 Add `package/server/src/shelf/shelf.service.test.ts` cases for: ordered application, mixed success/failure, cap rejection, cross-page move resolution
- [ ] 3.6 Run `bun -F @rezics/server test`

## 4. API client + mutation

- [ ] 4.1 In `package/api/src/shelf/shelf.api.ts`, add `batchUpdateItems(shelfUnitId, ops): Promise<BatchResponse>`
- [ ] 4.2 In `package/api/src/shelf/shelf.mutations.ts`, add `useBatchUpdateShelfItemsMutation` with optimistic-update support against the `shelfItemsQuery` cache (apply ops to cached pages before request, revert failed ops on response)
- [ ] 4.3 Re-export the mutation from `package/api/src/shelf/index.ts`

## 5. New `unit` feature: parser + hook

- [ ] 5.1 Create `package/app/src/unit/` with the layered subdirectories (`models/`, `hooks/`, `components/`, `index.ts`)
- [ ] 5.2 Implement `models/unitParamKind.ts`: param-name → kind mapping (`bookId` → `book`, `chapterId` → `chapter`, `unitId` / `unitSlug` → `unit`, etc.)
- [ ] 5.3 Implement `models/types.ts`: `Candidate`, `IdentifierType = "id" | "slug"`, `CandidateKind`
- [ ] 5.4 Implement `models/parseUrlToUnitCandidates.ts`: pure function `(getMatchedRoutes, input) => Candidate[]` that normalises the URL, calls `getMatchedRoutes(pathname)`, extracts unit-bearing params, derives kind from suffix, returns deepest-first ordering
- [ ] 5.5 Add `models/parseUrlToUnitCandidates.test.ts` covering: single-id URL, two-id URL (`/book/$id/read/$chapterId`), slug URL, unparseable input, hash-and-search-stripping, http(s) origin stripping
- [ ] 5.6 Implement `hooks/useUnitCandidates.ts`: injects `useRouter()`, debounces input, runs the parser, fetches each candidate's unit detail via `unitQueries.detail` or `unitQueries.bySlug` (add the latter if missing in `@rezics/api/unit`)

## 6. New `unit` feature: UnitPicker component

- [ ] 6.1 Implement `components/UnitPicker/UnitPicker.tsx` with input field, candidates list (using `renderItemAction`), browse panel for `workContextUnitId`
- [ ] 6.2 Implement `components/UnitPicker/UnitCandidateRow.tsx`: kind chip, title (resolved from query), identifier preview, slot for the action button
- [ ] 6.3 Add `components/UnitPicker/UnitPicker.stories.tsx` covering: single-select shell (excerpt-style), multi-add shell (shelf-style), parse errors, browse panel populated
- [ ] 6.4 Export `UnitPicker`, `useUnitCandidates`, `Candidate` from `package/app/src/unit/index.ts`

## 7. Excerpt migration to UnitPicker

- [ ] 7.1 Rewrite `package/app/src/excerpt/components/source/ExcerptSourcePicker.tsx` as a thin wrapper that renders `<UnitPicker>` with single-select action that maps the chosen `Candidate` to `ExcerptSource` (`mode: "unit"`)
- [ ] 7.2 Delete `package/app/src/excerpt/components/source/ExcerptSourcePicker.tsx`'s inline `TreeDisclosure` and `displayTitle` (now in `UnitPicker`)
- [ ] 7.3 Update `package/app/src/excerpt/components/source/ExcerptSourcePicker.stories.tsx` to assert the new behavior end-to-end (URL with two ids picks the chapter)
- [ ] 7.4 Delete `package/app/src/shared/utils/parse-app-route.ts` and its tests; run `rg -n parse-app-route\\|parseAppRoute package/app/src` to confirm zero remaining callsites; fix any stragglers

## 8. Shelf editor: items section state

- [ ] 8.1 Create `package/app/src/shelf/states/itemOpLog.ts` (or co-located in the feature's `states/` if introducing one): in-memory op log store with `enqueue`, `coalesce`, `clear`, `markFailed(opId, reason)`; cover with `bun:test`
- [ ] 8.2 Define `package/app/src/shelf/models/positionMath.ts`: thin wrappers around the shared `fractional-index` helpers for `appendAfter(last)`, `betweenNeighbors(a, b)`; cover with tests including edge cases (empty list, single item, ties)
- [ ] 8.3 Define `package/app/src/shelf/hooks/useShelfItemsEditor.ts` that combines the op log store with `shelfItemsQuery` and the batch mutation; exposes `enqueueAdd`, `enqueueReorder(itemRef, between)`, `enqueueCrossPageMove(itemRef, toPage)`, `enqueueDelete`, `save`, `discard`, `dirty`, `pendingCount`

## 9. Shelf editor: items section UI

- [ ] 9.1 Add a horizontal divider and items section heading below the existing metadata form in `package/app/src/shelf/pages/ShelfEditPage.tsx`
- [ ] 9.2 Remove the `onSuccess: navigate(...)` from the existing metadata Save handler so the editor stays mounted after a successful metadata update; metadata button transitions to disabled state on clean
- [ ] 9.3 Render `<UnitPicker workContextUnitId={...} renderItemAction={addAction} />` directly below the section heading; wire the action to `enqueueAdd`
- [ ] 9.4 Render the paginated items list using existing `shelfStream` flattening to respect `viewMode`; build a new `ShelfEditorItemRow` component with left control column (drag handle, MoveRight, delete) and content
- [ ] 9.5 Integrate dnd-kit (already in `@rezics/ui`) for page-local drag-and-drop; drop handler computes position via `positionMath.betweenNeighbors` and calls `enqueueReorder`
- [ ] 9.6 Implement the cross-page move modal: list all page indices, dispatch `enqueueCrossPageMove(itemRef, toPage)` on selection
- [ ] 9.7 Add a sort selector with `position` and at least one alternative sort; hide drag handles when sort ≠ `position`; keep delete and MoveRight visible
- [ ] 9.8 Implement the sticky footer with `Discard ops` and `Save · N ops` buttons wired to `discard` and `save`; show partial failure summary inline and a retry control for failed ops
- [ ] 9.9 Use TanStack Router's `useBlocker` to attach the unified leave-prompt that fires when either metadata or items are dirty

## 10. Nested-mode rendering in the editor

- [ ] 10.1 Update or extend `ShelfItemRenderer` so it can be reused inside the editor with an `editControls` slot: render left controls only on primary entries (flat or nested) and never on attached children that are rendered inside a parent card (nested mode)
- [ ] 10.2 In flat mode, ensure the stream emits attached review/tag entries as siblings so they receive their own row + control column

## 11. Storybook coverage

- [ ] 11.1 Add `ShelfEditPage.stories.tsx` (or `ShelfEditorItemsSection.stories.tsx`) covering: empty shelf, paginated multi-page shelf, dirty state with pending ops, partial save failure, flat vs nested viewMode rendering, cross-page move modal open
- [ ] 11.2 Run `bun -F @rezics/ui storybook --no-open` smoke check; visually confirm via `@rezics/ui` storybook port 6007 if available

## 12. Validation

- [ ] 12.1 Run `bun -F @rezics/contract build`, `bun -F @rezics/api test`, `bun -F @rezics/server test`, `bun -F @rezics/app build`
- [ ] 12.2 Run `bun run check:convention` and fix any R5/R7/R9 violations
- [ ] 12.3 Run `bun run knip` and clear new unused exports/dependencies
- [ ] 12.4 Manual UI walk-through: open an owner's shelf editor, paste a `/book/$id/read/$chapterId` URL, confirm chapter is the top candidate, add it, reorder, save, refresh, verify persistence

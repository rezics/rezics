## Why

The shelf edit page (`package/app/src/shelf/pages/ShelfEditPage.tsx`) currently
only edits a shelf's metadata (title / description / cover URL). Owners cannot
add, remove, or reorder shelf items from the edit page — the only path is the
external collect modal. Curating a shelf is the core ownership workflow, so the
gap forces multi-page workarounds for the most common task.

In parallel, `ExcerptSourcePicker` has a URL-parsing bug: `parseAppRoute()` only
extracts `segments[1]`, so URLs that carry two unit identifiers (e.g.
`/book/$bookId/read/$chapterId`) silently resolve to the outer unit (book)
instead of the more specific inner unit (chapter). The shelf editor's
"add unit" flow needs exactly the same URL-to-unit resolution that excerpt
needs, so we unify both behind a shared `UnitPicker`.

## What Changes

- **Shelf editor — items management section** added below the existing
  metadata form, separated by a horizontal divider. Owners can add, remove,
  and reorder items inline. Metadata area is preserved (layout untouched);
  the only behavioral change is that metadata Save now stays on the page
  after success so item editing can continue.
- **Op-log batch save** for item operations: frontend computes fractional
  positions locally (reusing the existing `fractional-index.ts` algorithm),
  accumulates `add`/`reorder`/`delete`/`setTags` ops, and submits them as a
  single batch via a new `PATCH /shelf/:id/items/batch` endpoint. Metadata
  has its own independent Save button.
- **Pagination + drag-reorder**: items list paginates as today. Drag-and-drop
  reorders within the current page only. A `MoveRight` icon button on each
  row opens a modal to move the item to the first position of another page.
  Reorder controls render only under manual (`position`) sort; other sort
  modes hide drag handles but still allow delete.
- **`viewMode` is respected in the editor**: in `flat` mode, attached
  reviews/tags appear as their own rows with control columns; in `nested`
  mode, attached children render as in-card tabs without controls.
- **`UnitPicker` shared component** introduced as a new `unit` feature in
  `package/app/src/unit/`. It uses TanStack Router's `router.getMatchedRoutes(pathname)`
  to extract every `${kind}Id` / `${kind}Slug` param from a pasted URL, ranks
  candidates deepest-first, and exposes a single component with an action
  slot — single-select shells for excerpt, multi-add shells for shelf.
- **`ExcerptSourcePicker` becomes a thin shell** over `UnitPicker` and
  inherits the multi-unitId URL fix. Its `TreeDisclosure` sub-units browser
  moves into `UnitPicker` so both flows benefit.
- **Server `PATCH /shelf/:id/items/batch`** accepts an op log and applies
  each op in a single transaction. Partial success is reported per-op so
  the client can retry failed ops without rebuilding the batch.

## Capabilities

### New Capabilities

- `unit-picker`: Shared UI capability that parses a URL into unit candidates
  via TanStack Router, displays them deepest-first, and exposes a pluggable
  action slot so excerpt (single-select replace) and shelf (multi-add) share
  the same parsing and rendering pipeline.
- `shelf-items-editor`: Frontend editor capability covering the items-management
  section of the shelf edit page — paginated list with manual-sort drag-reorder,
  cross-page move modal, delete, attached-children handling per `viewMode`,
  op-log dirty tracking, and batch save with partial-success retry.
- `shelf-items-batch-mutation`: Server capability for the new
  `PATCH /shelf/:id/items/batch` endpoint that accepts an op log and applies
  add/reorder/delete/setTags ops in one transaction with per-op outcomes.

### Modified Capabilities

(none — `shelf-structure` and `unit-resolver` remain unchanged in their
existing requirements. The new batch endpoint and URL parser are additive
behaviors covered by the three new capabilities above.)

## Impact

**Affected packages**

- `package/app` — `shelf/pages/ShelfEditPage.tsx` (items section appended),
  new `unit/` feature (UnitPicker + parser hooks), `excerpt/components/source/ExcerptSourcePicker.tsx`
  rewritten as a shell, `shared/utils/parse-app-route.ts` retired.
- `package/api` — `shelf/shelf.api.ts` gains `batchUpdateItems`,
  `shelf/shelf.mutations.ts` gains a corresponding mutation hook.
  `tag/fractional-index.ts` promoted to a shared util location used by
  shelf-side code.
- `package/contract` — `shelf.ts` adds `shelfBatchOpSchema` and
  `shelfBatchRequestSchema` + response schema.
- `package/server` — `shelf/shelf.api.ts` adds the batch route,
  `shelf/shelf.service.ts` gains a transactional batch handler.

**Migration / compatibility**

- No database migration. `ShelfItem.position` semantics unchanged.
- Existing per-op endpoints (`POST /shelf/:id/items`, `PATCH /shelf/:id/items/:ref/position`,
  `DELETE /shelf/:id/items/:ref`) remain available; the batch endpoint is
  additive. Internal callers (the new editor) use the batch endpoint
  exclusively.
- `parseAppRoute()` is deleted (per CLAUDE.md development-stage policy: no
  compatibility shims for internal renames). All callsites migrate to the new
  `UnitPicker` / `parseUrlToUnitCandidates`.

**Out of scope**

- Reordering across non-position sort modes (drag is disabled there by design).
- Bulk multi-line URL paste in the picker (single-line only in v1).
- A separate read-only fallback when total items exceed a virtualization
  threshold — pagination handles arbitrary sizes already.
- Live collaborative editing — a shelf has a single owner per the user model.

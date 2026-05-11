## Context

The archived shelf editor change added item management, URL-based unit picking,
batch item ops, page-local drag reorder, and the current three shelf views:
`nested`, `flat`, and `masonry`. The implementation reuses the rich
`ShelfItemRenderer` inside sortable rows. That makes editor rows visually
consistent with the shelf detail page, but it also makes dragging expensive:
each sortable row can include full book, review, post, action, tab, image, and
reaction surfaces with highly variable heights.

The new direction is to separate curation from rich reading. Rich views remain
for browsing. The new `unit` view is a fixed-height curation view that renders
through reusable `unit` feature components and is the only view where manual
drag reorder is enabled.

`add-user-hover-preview` is active in parallel. Its design introduces an app
user feature composite that renders avatar/name profile previews from supplied
public user data. This change should consume that composite instead of building
another author hover surface in shelf or unit code.

## Goals / Non-Goals

**Goals:**

- Add a fourth shelf view mode, `unit`, optimized for scanning and curation.
- Add a reusable `UnitCard` in `package/app/src/unit/` with fixed-height
  layout, image, title, translation-derived fields, concise content, author,
  and item metadata slots.
- Make reorder performance predictable by using fixed-height rows and a
  lightweight drag overlay in the `unit` view only.
- Replace the editor's direct URL picker with an `Add item` composition that
  supports search, URL import, and contextual browse.
- Model sorting as `(field, order)` instead of field-only mode, with both
  ascending and descending orders for manual, added-time, and title sorting.
- Surface shelf-item `createdAt` as the item added time in unit rows.
- Coordinate author rendering with `add-user-hover-preview`.

**Non-Goals:**

- No rewrite of rich `nested`, `flat`, or `masonry` presentation cards.
- No virtualization as the first performance boundary.
- No new backend search service unless existing unit list/search APIs cannot
  satisfy the add-item search flow.
- No custom author hover implementation inside shelf or unit components.

## Decisions

### 1. Add `unit` as a curation-first shelf view

`ShelfView` becomes `"nested" | "flat" | "masonry" | "unit"`. The new view
renders one fixed-height unit summary per stream entry. It is valid in both
shelf detail and shelf edit contexts, but its primary reason to exist is the
editor's high-performance manual sorting surface.

The existing views keep their current rich rendering roles:

```text
nested  -> rich prime card with attached reviews in tabs
flat    -> rich row stream of primes and attachments
masonry -> rich masonry-style stream
unit    -> fixed-height unit summaries for scanning and curation
```

Alternative considered: optimize drag inside existing rich rows. Rejected
because the rich rows have intrinsically variable height and expensive nested
content. Fixed-height curation rows create a stronger performance boundary and
do not compromise the reading-oriented views.

### 2. Put reusable unit summary rendering in the `unit` feature

Create a `UnitCard` component under `package/app/src/unit/`, exported through
the unit feature index. The card should be data-driven and avoid fetching. A
caller passes a normalized summary shape derived from whatever source it owns:
`UnitDTO`, hydrated shelf item data, search result data, or URL candidate data.

Target data shape:

```ts
type UnitCardSummary = {
  unitId: string;
  kind: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  contentPreview?: string;
  author?: PublicUserLike | null;
  addedAt?: string | Date | null;
  translationMeta?: {
    language?: string;
    sourceTitle?: string;
    overrideTitle?: string;
  };
};
```

The exact type can be refined during implementation, but the important boundary
is that mapping logic lives in pure `unit/models` or shelf-local adapter models,
not in the card render body.

Alternative considered: keep shelf-specific item cards in the shelf feature.
Rejected because search results, URL candidates, browse rows, and shelf rows
all need the same compact unit vocabulary.

### 3. Author identity uses the shared user hover preview

`UnitCard` should render author identity through the user preview composite
introduced by `add-user-hover-preview` once that change lands. Until the
component is available, implementation should depend on the exported user
feature API rather than deep-importing or re-creating preview internals.

If the user preview component exposes only trigger-level composition, `UnitCard`
can accept an `authorSlot` escape hatch while keeping the default path wired to
the shared preview.

Alternative considered: render author text directly in `UnitCard`. Rejected
because it would create inconsistent hover/focus behavior and duplicate the
active user-preview change.

### 4. Sorting becomes field plus order

Replace `ShelfSortMode = "manual" | "time" | "title"` with a sort state shaped
like:

```ts
type ShelfSortField = "manual" | "addedAt" | "title";
type ShelfSortOrder = "asc" | "desc";
type ShelfSortState = { field: ShelfSortField; order: ShelfSortOrder };
```

`addedAt` refers to `ShelfItem.createdAt`, not the underlying content's own
creation date. Defaults should prefer the common curation order:

- `manual`: `desc`
- `addedAt`: `desc`
- `title`: `asc`

Manual `desc` means higher fractional positions render first. This aligns with
the current append behavior, where new items receive positions after the last
item.

Alternative considered: keep `time` as an ambiguous sort field. Rejected
because shelf curation needs to distinguish shelf-added time from content
publication time.

### 5. Reorder controls are gated by both view and sort

Manual reorder controls render only when:

```text
viewMode === "unit" && sort.field === "manual"
```

This includes drag handles, cross-page move controls, and drag/drop sensors.
Non-manual sorts hide all reorder controls. The existing rich views also hide
all reorder controls even if the sort field is manual, because they are not the
performance-safe sorting surface.

Delete and non-reorder item actions can remain available where appropriate.

Alternative considered: keep MoveRight under non-manual sort. Rejected because
cross-page move is still a position mutation, so showing it while the visible
order is not manual creates misleading semantics.

### 6. Fixed height is the drag performance boundary

The unit view's row height must be stable before, during, and after dragging.
Rows can be moderately tall, but their block size must not depend on dynamic
content. Text uses line clamps, images use fixed aspect/size constraints, and
metadata regions reserve stable space.

During drag, render a lightweight `DragOverlay` summary rather than moving the
full card subtree. The sortable list should not wrap rich `nested`, `flat`, or
`masonry` cards. Memoization can help, but fixed layout and light overlay are
the primary constraints.

Alternative considered: virtualize first. Rejected for v1 because the current
page size is small enough; the jank comes from row complexity and layout
instability during drag, not from thousands of DOM nodes.

### 7. Add item is a composed unit selection workflow

The shelf editor should render an `Add item` panel instead of a bare `Unit URL`
field. The unit feature owns reusable pieces:

```text
UnitSearchSelect   -> search content and select/add results
UnitUrlImport      -> parse pasted app URLs into candidates
UnitBrowseRelated  -> browse sub-units after a work context exists
UnitAddPicker      -> shelf/excerpt-friendly composition of the above
```

`Browse related` should appear only after there is a valid work-like context:
a parsed URL candidate, a selected search result, or an explicit work context
from a caller. Passing a shelf id as `workContextUnitId` is not sufficient.

Alternative considered: add search to the existing URL-first `UnitPicker`.
Rejected because the UI concept becomes clearer if the outer component is
`Add item` and URL import is just one source.

### 8. Cross-page move uses visual manual order semantics

If cross-page move remains part of manual sorting, its op must understand the
visible manual order and page size. The current server constant mismatch
between frontend page size and `CROSS_PAGE_PAGE_SIZE` must be removed.

Acceptable implementation paths:

- Include `pageSize` and `order` in the cross-page reorder op and resolve the
  destination edge server-side.
- Or fetch the destination page edge client-side and submit a normal position
  reorder op.

Either way, "page K" must mean the same visual page the editor shows.

## Risks / Trade-offs

- Existing rich views no longer support drag controls -> This is intentional.
  The editor can guide users to switch to the unit view for manual sorting.
- `unit` as a view-mode name may read generically -> It matches the feature
  component ownership. If product copy needs more clarity, the visible label can
  be "Unit cards" while the persisted value stays `unit`.
- `UnitCard` may depend on `add-user-hover-preview` landing first -> Keep the
  task order explicit and use the user feature public export once available.
- Manual descending reorder is easy to implement incorrectly -> Add model tests
  for neighbor calculation in both asc and desc visual orders.
- Browse-after-resolution can hide useful browsing when no context exists ->
  Search remains the default add path, and URL import can create context when
  users paste a book/work link.

## Migration Plan

1. Land or rebase onto `add-user-hover-preview` enough to know the public user
   preview export.
2. Add the unit summary model and `UnitCard` stories.
3. Add sort field/order model tests and update shelf stream derivation.
4. Add the `unit` shelf view in detail and editor surfaces.
5. Replace shelf editor add area with the composed add-item panel.
6. Gate all reorder controls to `unit + manual` and replace full-row drag with
   fixed-height rows plus lightweight overlay.
7. Update cross-page move semantics or remove the mismatch by converting moves
   to client-resolved normal reorder ops.
8. Run focused unit tests, Storybook checks, app build, and a manual shelf edit
   walkthrough.

Rollback is a normal revert. The change is frontend-heavy and should not need a
data migration.

## Open Questions

- Should the visible label for the new `unit` view be "Unit", "Unit cards", or
  "Compact"?
- Should the default shelf detail sort also switch to manual descending, or
  should that default apply only in the editor's unit view?
- Should cross-page move remain in v1 once fixed-height drag is available, or
  should page-local drag plus pagination be the first shipped version?

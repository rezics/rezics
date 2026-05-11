## Why

Shelf curation is now possible in the edit page, but the experience is still
too heavy for daily use: drag reorder is janky, adding items is framed around
a URL field instead of a broader "add item" workflow, and shelf entries do not
surface the metadata curators need most, especially when an item was added.

This change makes the shelf editor a practical curation workspace by adding a
fixed-height unit view, reusable unit rendering primitives, clearer add-item
flows, and stricter reorder-control visibility.

## Problem

The existing shelf views render rich content cards that are appropriate for
reading but expensive for drag sorting. They also vary greatly in height, which
makes pointer movement and layout work unstable during reorder. The editor
currently exposes URL import and browse affordances too early, and it lacks a
general search-and-add path for content.

Shelf items also need clearer information architecture. For a shelf, the most
important timestamp is often the time the item was added to the shelf, not only
the content's own creation time. Sort modes need explicit ascending and
descending directions, with descending being the common default for added-time
and manual insertion order.

## Goals

- Add a fourth shelf view mode that renders entries through reusable unit
  feature components.
- Introduce a reusable fixed-height `UnitCard` component that can show image,
  title, translation override fields, concise content text, and author
  information.
- Keep drag reorder performant by enabling manual reorder controls only in the
  new fixed-height unit view.
- Replace the editor's bare URL-first add area with an `Add item` composition
  that supports search, URL import, and browse-after-resolution.
- Add two-direction sorting for manual and added-time modes, defaulting to the
  descending order where it better matches curator expectations.
- Surface shelf-item added time in the unit view and in sort-dependent editor
  contexts.
- Coordinate author rendering with the in-progress `add-user-hover-preview`
  change so unit cards use the shared user preview affordance.

## Non-goals

- Do not redesign full book, post, review, or shelf detail cards.
- Do not add virtualization as the primary fix for drag jank; fixed-height
  rows and lightweight drag previews are the first performance boundary.
- Do not add a new backend search endpoint unless existing unit search/list
  APIs prove insufficient during implementation.
- Do not implement collaborative shelf editing.
- Do not fork or duplicate the user hover preview component being introduced
  by `add-user-hover-preview`.

## Scope

This change covers the app-side shelf detail/editor UI, unit feature
components used by shelf rendering and add workflows, and the client-side sort
model. Backend changes should be limited to query shape or sort support if the
current shelf items API cannot return the required order and page semantics.

## What Changes

- Add `unit` as a fourth shelf view mode beside `nested`, `flat`, and
  `masonry`.
- Add a reusable `UnitCard` under the `unit` feature. It renders a stable,
  fixed-height unit summary with optional media, title, translation-derived
  metadata, concise content, author identity, and added-time metadata supplied
  by the caller.
- Extend shelf sort state from a mode-only value to a field/order model so
  manual and added-time sorting support both ascending and descending order.
- Default added-time sorting to descending. Manual sorting also supports
  descending display so newest appended positions can appear first.
- Restrict manual reorder controls, including drag handles and cross-page move
  actions, to `viewMode = "unit"` and `sort.field = "manual"`. All other view
  and sort combinations remain browse/edit-delete surfaces without reorder UI.
- Replace the shelf editor's direct `UnitPicker` block with an `Add item`
  composition that includes unit search, URL import, and contextual browse.
  Browse appears only after a URL/search result resolves to a work-like unit or
  when a valid work context is explicitly available.
- Update shelf editor rows to use fixed-height unit summaries and a lightweight
  drag overlay while sorting.
- Integrate with `add-user-hover-preview` by rendering author identity through
  the shared preview component once that change lands.

## Capabilities

### New Capabilities

- `unit-card`: Reusable unit summary card/component behavior for image, title,
  translation-aware fields, concise content, author identity preview, and
  stable fixed-height rendering.

### Modified Capabilities

- `shelf-display-modes`: Add the fourth `unit` view mode and define how it
  participates in sorting and shelf stream rendering.
- `shelf-items-editor`: Change add-item composition, reorder-control
  visibility, fixed-height drag behavior, added-time display, and sort
  direction support in the editor.
- `unit-picker`: Extend the picker into a more general unit selection/add
  composition with search and browse-after-resolution behavior.

## Impact

- Affected packages: `package/app`, `package/api`, and possibly
  `package/contract` / `package/server` if shelf item list sorting must be
  represented at the API boundary.
- Likely app files: `package/app/src/unit/`, `package/app/src/shelf/`,
  `package/app/src/post/components/parts/PostAuthorHeader.tsx` only through
  coordination with the separate user preview change.
- Existing shelf view mode strings are in active development. Adding `unit` is
  a clear cutover; no legacy alias is required beyond the legacy mappings
  already defined for earlier view names.
- Storybook coverage is required for the new `UnitCard`, the add-item
  composition, the unit shelf view, manual drag states, and author-preview
  integration states.

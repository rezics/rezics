## Context

Book editing currently uses `BookEditLayout`, which directly renders the app
header, the main app sidebar wrapper, and `BookEditorNavigation`. That layout is
already doing the job of a broader edit console: it provides return navigation,
primary edit sections, and edit-only operations such as authority and history.
The implementation is still named and shaped as a Book-only layout.

Future library Unit types such as Game and Media need the same console pattern.
Wiki posts and other Post-backed editors need a lighter variant that may have
only return and primary edit navigation, while Wiki-capable surfaces can opt into
authority and history. Chapter editing is a special case: a chapter is not a
`UnitType`; it is represented as `Unit(type=POST)` with `Post.kind=CHAPTER`.
Chapter edit therefore should remain contextual to the Book edit console instead
of becoming a parallel console.

There are also two defects in the current Book history integration:

- The old `/book/:bookId/history...` route family still exists as compatibility
  redirects even though the product direction is to remove direct aliases.
- `/book/:bookId/edit/history/compare/:targetSequence` is nested under the
  history route but the parent history component has no outlet, so child routes
  do not render.

## Goals / Non-Goals

**Goals:**

- Introduce a generic edit console layout contract in `package/app`.
- Migrate Book edit to the generic layout without changing Book edit URLs.
- Keep chapter edit inside the Book edit console and render chapter context
  below the console divider.
- Allow future Game, Media, Wiki post, and Post editors to adopt the same layout
  by providing navigation configuration and capability flags.
- Remove direct non-edit Book history aliases.
- Fix Book history detail and compare route rendering under the edit console.
- Fix the edit sidebar overflow bug caused by an empty lower context area.

**Non-Goals:**

- Do not implement full Game, Media, Wiki post, or generic Post edit pages in
  this change.
- Do not change Unit, Post, authority, history, or Prisma data models.
- Do not change server-side permission semantics.
- Do not add a new UI dependency or redesign the app shell.
- Do not create a separate chapter edit console.

## Decisions

### Define Edit Console As A Shared App Layout

The reusable layout should live in `package/app` as an app composition pattern,
not in `@rezics/ui` initially. It depends on app routing, feature navigation,
the app header, and route-local capability decisions. `@rezics/ui` can remain the
source for primitives and tokens.

The layout contract should accept:

- `returnItem`: one localized return action such as "Back to book" or "Back to
  game".
- `primaryItems`: feature-specific edit sections.
- `operationalItems`: optional edit-only operations such as authority and
  history.
- `contextSlot`: optional lower sidebar content rendered below the divider.
- `children`: routed main content.

Alternatives considered:

- Keep `BookEditLayout` and add variants. Rejected because it would force future
  Game/Wiki/Post editors to import Book-shaped concepts.
- Move the layout directly into `@rezics/ui`. Rejected for now because route
  ownership, TanStack Router links, app header behavior, and feature capability
  checks are app-specific.

### Use Configuration Instead Of UnitType Switches

The generic layout should not switch on `UnitType` or `PostKind`. Each feature
route should provide its own console configuration. Book can provide Book edit
items; future Game can provide Game edit items; Wiki post can opt into history
and authority when its feature owns those routes.

Alternatives considered:

- Add a central registry keyed by `UnitType`. Rejected for this change because
  not every edit surface maps cleanly to `UnitType` and chapter editing is
  explicitly Post-backed context within Book.

### Keep Chapter Editing As Book Console Context

When editing `/book/:bookId/edit/:chapterId`, the upper console navigation still
belongs to the Book. The lower context area below the divider should show the
current chapter context, such as the chapter title, back-to-chapter-list entry,
or future chapter-local navigation.

Alternatives considered:

- Create `/chapter/:chapterId/edit` with its own console. Rejected because it
  hides the Book content-structure context and treats chapter as an independent
  library Unit type, which it is not.

### Restructure History Routes Around A Parent Outlet

Book edit history should use a route layout at `/book/:bookId/edit/history` that
renders the edit history frame and an outlet. The index child renders the
timeline; sibling child routes render revision detail and compare pages.

Target shape:

```text
/book/:bookId/edit/history
  route/layout -> history frame + outlet
  index        -> revision timeline
  $sequence    -> revision detail
  compare/$targetSequence -> compare surface
```

This makes compare and detail pages render inside the edit console route family
instead of being swallowed by a parent component without an outlet.

### Remove Non-Edit Book History Routes

The old `/book/:bookId/history...` route family should be deleted, not retained
as aliases or redirects. Internal app links must point to the edit-console
history route family.

Alternatives considered:

- Keep redirects for bookmarks. Rejected for the current development-stage
  project because internal route cutovers are expected to update all callsites in
  one change.

### Make Sidebar Context Height Conditional

The sidebar should not create an always-present scroll container for an empty
context area. The outer sidebar should avoid unconditional `overflow-auto`, and
only the lower context slot should scroll when it contains content that exceeds
available space.

The implementation should preserve mobile drawer behavior and the existing app
sidebar navigation semantics while using design tokens and restrained, borderless
app styling.

## Risks / Trade-offs

- [Risk] A generic layout becomes too abstract before the second concrete
  consumer exists. -> Mitigate by extracting only the Book-proven shape and
  leaving future Game/Wiki/Post configuration as a contract, not full
  implementation.
- [Risk] Removing legacy history routes breaks bookmarked development URLs. ->
  Mitigate by updating all internal links and documenting the canonical
  edit-console route family.
- [Risk] Sidebar context content may conflict with primary navigation density. ->
  Mitigate by treating context as lower-priority, below-divider navigation with
  its own bounded scroll area.
- [Risk] Authority/history labels become inconsistent across surfaces. ->
  Mitigate with shared i18n keys for generic operation labels and per-surface
  return labels.

## Migration Plan

1. Create the generic edit console layout and navigation configuration types in
   `package/app`.
2. Migrate Book edit routes to use the generic layout while keeping the current
   canonical `/book/:bookId/edit...` URLs.
3. Move Book edit sidebar item construction from `BookEditorNavigation` into a
   Book-specific configuration factory.
4. Add a Book chapter context renderer below the sidebar divider for chapter edit
   routes.
5. Restructure Book edit history routes to provide a parent outlet and child
   index/detail/compare routes.
6. Remove the non-edit Book history route files and update internal links.
7. Fix sidebar overflow so empty context content does not produce a permanent
   scrollbar.
8. Add focused tests or stories for Book edit console navigation, chapter
   context, history compare rendering, legacy route removal, and sidebar overflow
   behavior.

Rollback strategy:

- Revert Book edit route composition to `BookEditLayout` if the shared layout
  blocks Book editing, while keeping history route fixes independent where
  possible.
- If direct history route removal causes unacceptable product fallout, restore a
  separate explicit compatibility change rather than leaving accidental aliases.

## Open Questions

- Which future surface should be the second concrete consumer after Book: Game
  edit, Wiki post edit, or generic Post edit?
- Should the lower context slot eventually support grouped collapsible context,
  or remain a simple slot until a second context-heavy editor exists?

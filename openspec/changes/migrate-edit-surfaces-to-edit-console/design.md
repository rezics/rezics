## Context

The app already has a reusable `EditConsoleLayout` and Book edit routes that
render outside `_mainLayout` via `routes/book_/$bookId/edit`. Other edit
surfaces still live under `_mainLayout` or only exist as inline dialogs. The
current `useCanEdit` helper also conflates two decisions:

- whether the viewer should see an editor entry point
- whether the viewer can save a specific field or operation

That conflation does not fit collaborative surfaces. A Book, future Game, or
Wiki Post can be fully locked for ordinary content fields while still exposing
valid editor work such as tags or externally governed metadata.

The target design makes editor entry a surface-level capability decision and
leaves field-level permission checks with existing server-side update gates,
field locks, and collaborative authority paths.

## Goals / Non-Goals

**Goals:**

- Preserve public edit URLs while moving migrated edit routes out of the main
  browsing layout.
- Use the generic edit console for Unit-backed and Post-backed editor routes.
- Define `canEnterEditor` separately from concrete update permission.
- Show visible editor icons for focal detail surfaces and keep post tree reply
  edit actions in ReactionBar overflow.
- Keep ordinary post/review/remark/reply edits owner/admin controlled.
- Keep collaborative Book/Game/Wiki editor entry available to authenticated
  non-blocked users when at least one editor capability can apply.
- Render a localized "edited" marker from post timestamps.

**Non-Goals:**

- Replacing server permission gates or field-lock enforcement.
- Adding new database tables or changing lock semantics.
- Moving account settings/profile settings into the content edit console.
- Implementing structured wiki slot editing beyond existing Markdown editing.
- Introducing TanStack virtual routes for this migration.

## Decisions

### Use a shared pathless editor route family

Migrate editor routes into a pathless `_editor` branch:

```txt
routes/
  _mainLayout/
  _editor/
    route.tsx
    book/$bookId/edit/...
    shelf/$shelfId/edit.tsx
    review/$reviewId/edit.tsx
    remark/$reviewId/edit.tsx
    excerpt/$unitId/edit.tsx
    entity/$unitId/edit.tsx
    post/$rootPostUnitId/edit.tsx
    post/$rootPostUnitId/continue/$unitId/edit.tsx
```

The `_editor` pathless segment keeps URLs such as `/book/$bookId/edit` and
`/review/$reviewId/edit` stable while avoiding `_mainLayout`. This is closer to
TanStack Router's layout model than continuing the current one-off `book_`
escape pattern for every surface.

Alternative considered: keep adding top-level non-nested folders such as
`book_`, `post_`, `shelf_`. This preserves behavior but scales poorly and
spreads editor ownership across unrelated route roots.

Alternative considered: switch this area to TanStack virtual routes. Virtual
routes can organize large route trees, but the app is currently file-route
driven and this migration does not need a second routing configuration style.

### Introduce editor-entry decisions

Add an app/API-layer helper conceptually shaped like:

```ts
type EditorEntryDecision =
  | {
      canEnter: true;
      reason:
        | "owner"
        | "admin"
        | "collaborator"
        | "community"
        | "taggable";
    }
  | {
      canEnter: false;
      reason: "anonymous" | "blocked" | "no-capability";
    };
```

This helper is for affordance visibility and route entry. It does not authorize
mutations. Concrete saves still call existing mutations and rely on server
permission checks, field locks, and collaborative metadata admission.

For ordinary author-owned surfaces, `canEnterEditor` remains equivalent to the
current owner/admin update permission. For collaborative surfaces, it can return
true for authenticated non-blocked users even when content fields are locked,
because tags or externally governed operations can still be available.

### Keep focal and tree post edit behavior separate

Focal post surfaces use visible editor icons and editor routes. Examples:

- review detail
- remark detail
- excerpt detail where the focal unit is the page subject
- generic root post detail
- continue-thread focal post

Post tree rows are not focal route subjects. Their edit action is section-owned
and rendered inside the ReactionBar overflow menu. If selected, it opens the
inline edit dialog/editor in place. `PostReply` remains a pure presentation
component and does not import authorization hooks or edit dialogs.

### Reuse edit console configuration per surface

Book keeps its richer console with primary items and operational items. Simple
surfaces provide a minimal console with a localized return item and a single
main editor page. Future Game/Media/Wiki surfaces can opt into authority and
history operational items through explicit configuration rather than hardcoded
Unit type checks inside the layout.

### Render edited marker in post metadata

Post display components SHALL show a localized edited marker when both
timestamps are parseable and `updatedAt` differs from `createdAt`. This is
presentation metadata, not an authorization concern.

## Risks / Trade-offs

- Route migration can break typed `to` references if routes are moved without
  updating generated route types. Mitigation: migrate in small route groups and
  run route generation/type checking after each group.
- Showing editor entry for collaborative surfaces can create an empty-feeling
  editor if every tab is disabled. Mitigation: at least one available
  capability, such as tags, must remain visible; unavailable fields must explain
  their locked or unauthorized state.
- Existing `useCanEdit` call sites may be incorrectly used for editor entry.
  Mitigation: introduce a separate editor-entry helper and audit focal entry
  points explicitly.
- ReactionBar overflow may become a dumping ground for unrelated controls.
  Mitigation: reserve row-local edit overflow for section-owned post tree
  actions and keep global action tokens limited.

## Migration Plan

1. Add editor-entry helper types and tests without changing existing UI.
2. Create the `_editor` route branch and migrate Book edit routes first,
   preserving URLs.
3. Migrate simple edit routes one surface at a time: Shelf, Review, Remark,
   Excerpt, Entity.
4. Add focal Post editor routes and wire visible focal post edit icons.
5. Add post tree overflow edit entry and keep inline editing for non-current
   nodes.
6. Add the post edited marker and localized message.
7. Run route generation, type checks, conventions, and focused frontend tests.

Rollback is a route-level revert: migrated route files can be moved back under
their previous branch as long as public URLs and page components remain intact.

## Open Questions

- Whether Entity should remain admin-only for editor entry or later adopt a
  broader collaborative-entry model. This change keeps current Entity authority
  unless a separate Entity collaboration change expands it.
- Whether Wiki Post history should be exposed immediately in the post editor
  console or only after the existing history UI is wired for post revisions.

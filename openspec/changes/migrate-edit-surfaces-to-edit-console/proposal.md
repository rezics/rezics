## Why

Existing edit surfaces use inconsistent layouts and inconsistent entry rules:
Book editing already uses the edit console outside the main browsing layout,
while Shelf, Review, Remark, Excerpt, Entity, and Post editing remain scattered
across main-layout routes or inline-only flows. This makes edit affordances hard
to reason about, especially for collaborative surfaces where entering the
editor is not the same as being allowed to edit every field.

This change consolidates edit surfaces around the reusable edit console and
separates editor-entry permission from field-level edit permission.

## What Changes

- Introduce an editor entry policy that distinguishes `canEnterEditor` from
  per-field or per-operation permission.
- Show visible editor entry icons for focal editable surfaces such as Book,
  future Game/Media work surfaces, Entity, Shelf, Review, Remark, Excerpt, and
  focal Post detail surfaces when the viewer has an editor-entry capability.
- Treat collaborative surfaces such as Book, future Game, and Wiki Post as
  editor-enterable for authenticated non-blocked users when at least one editor
  capability can apply, even if all ordinary content fields are locked, because
  tag or externally governed edits can still be available.
- Keep ordinary author-owned surfaces such as ordinary Review, Remark, Excerpt,
  and reply posts owner/admin controlled for editor entry.
- Move existing edit routes that currently render under the main browsing
  layout into a shared editor route family that renders through the edit
  console while preserving public URLs.
- Add a focal Post editor route for current-URL post surfaces, while keeping
  non-current post-tree nodes on inline editing.
- Place post-tree reply edit entry inside the ReactionBar overflow menu, only
  for viewers who can edit that row.
- Render a localized "edited" marker for posts whose `createdAt` and
  `updatedAt` timestamps differ.

## Capabilities

### New Capabilities

- `editor-entry-policy`: Defines editor-entry decisions, visible edit icon
  rules, collaborative-surface entry behavior, and the distinction between
  entering the editor and editing a specific field.

### Modified Capabilities

- `edit-console-layout`: Expand the reusable edit console adoption from Book
  to migrated Unit-backed and Post-backed edit surfaces.
- `edit-console-navigation`: Define editor route-family ownership for migrated
  edit routes and preserve public edit URLs while moving them out of the main
  browsing layout.
- `post-presentation-architecture`: Clarify focal post editor entry, tree-node
  inline edit ownership, and the post "edited" marker.
- `engagement-reaction-bar`: Allow section-owned overflow content to host a
  permission-gated edit action for post tree rows without making presentation
  components own edit authorization.

## Impact

- Affected packages:
  - `package/app`: route files, edit console layout composition, focal detail
    action areas, post tree row actions, post timestamp presentation, and
    localized messages.
  - `package/api`: editor-entry helper hooks may be added alongside existing
    `useCanEdit` without changing the existing owner-edit helper contract.
  - `package/contract`: permission helper semantics may be referenced or
    extended for editor-entry decisions, but existing update permission helpers
    remain backward compatible.
- No API route removal is expected. Existing public edit URLs should remain
  stable.
- No database migration is expected.
- Backward compatibility: existing content update gates remain authoritative.
  Entering an editor never bypasses field locks, collaboration rules, owner
  checks, or server-side update permissions.

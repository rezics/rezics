## Context

Book editing currently uses `BookEditLayout` with a left sidebar populated from
`BookEditorNavigation`, while book detail pages use tab navigation and an
optional right sidebar slot. History currently lives under the book detail
route family, and field-lock management is embedded in the history page's
authority tab. That mixes three concepts that now need clearer boundaries:
reader-facing book detail, edit-console navigation, and authority management.

The backend authority model is already in place. `UnitFieldLock("*")` closes a
Unit to community editorial contributions, while the primary owner, admins, and
owner/maintainer collaborators can bypass locks through the server authority
gate. This change should reorganize the app surfaces around that model without
changing the server permission semantics.

## Goals / Non-Goals

**Goals:**

- Establish a consistent edit-console sidebar pattern for Unit-backed editing,
  starting with books.
- Make authority/field locks and history standalone edit-console pages.
- Present `UnitFieldLock("*")` as a whole-object community lock that covers
  child field lock controls without materializing child locks.
- Preserve server-side authority checks as the source of truth.
- Keep public/detail navigation separate from edit-only management tools.

**Non-Goals:**

- Do not change the `UnitFieldLock` data model.
- Do not add allow-list exceptions under `UnitFieldLock("*")`.
- Do not introduce new permission roles.
- Do not make history private by default; visibility still follows the
  existing history authority contract.
- Do not redesign every edit surface in the first implementation batch.

## Decisions

### Use The Edit Sidebar As Navigation Only

The edit sidebar owns route entry points, not the management UI itself. Lock
management belongs on a standalone authority page such as
`/book/:bookId/edit/authority`; history belongs on a standalone history page
such as `/book/:bookId/edit/history`.

Alternatives considered:

- Put lock controls directly in the sidebar. Rejected because the sidebar would
  become a dense form surface and would not scale to history, collaborators, or
  audit controls.
- Use a right-side Sheet for lock management. Rejected for this workflow because
  the product direction is that all edit surfaces have a persistent edit
  console sidebar with page-level tools.

### Treat Authority As More Than Locks

The sidebar item should be named around authority or permissions, not only
"Locks". The initial page can focus on field locks, but the route should have
room for collaborators, lock mutation audit, and role explanations.

Recommended initial naming:

- Sidebar label: `Authority` or localized equivalent of "Permissions & Locks".
- Page title: `Permissions & Locks`.
- Sections: community editing, field locks, collaborators if implemented in the
  same pass.

### Render Whole-Object Lock As Coverage

When `UnitFieldLock("*")` exists, the authority page shows the top-level "lock
all editable fields" switch as active. Field-level controls below it are
disabled and annotated as covered by the whole-object lock. The implementation
must not create or imply individual child lock rows for every field.

Alternatives considered:

- Expand `*` into one lock row per known path. Rejected because it creates noisy
  persistence, makes future field additions ambiguous, and weakens the simple
  meaning of the sentinel.
- Allow users to uncheck child fields while `*` remains active. Rejected for v1
  because the current model has deny locks only and no allow exception layer.

### Keep Lock Status Visible In Edit Forms

Community editors should not need the authority page to understand a blocked
field. Collaborative edit forms should show lightweight lock status near locked
fields and preserve drafts when a locked-field save fails. Privileged actors may
still edit locked fields, but the UI should indicate that the field is locked
for community contributors.

### Move Canonical Book History Into The Edit Console

Book history should be reachable from the edit sidebar. Existing detail history
routes may be retained as compatibility redirects or public aliases, but the
canonical editing workflow uses the edit-console route. This keeps history near
restore, compare, and authority workflows.

### Start With Book Edit, Then Generalize

Book edit is the first target because it already has a sidebar layout. The
implementation should extract only the reusable shape needed for future
Unit-backed editors, avoiding a broad navigation framework before the second
consumer exists.

## Risks / Trade-offs

- [Risk] Moving history can remove a useful public discovery path. -> Mitigate
  by explicitly deciding whether old `/book/:bookId/history` routes redirect,
  alias, or remain linked from detail pages.
- [Risk] Users may think `*` creates all child locks. -> Mitigate with copy that
  says child fields are "covered by all-fields lock" and by persisting only the
  sentinel row.
- [Risk] Authority page grows into an admin duplicate. -> Mitigate by keeping it
  scoped to per-Unit edit authority and leaving global operations in admin.
- [Risk] Sidebar labels become inconsistent across edit surfaces. -> Mitigate by
  defining the shared edit-console navigation vocabulary in the new capability.
- [Risk] Route migration breaks bookmarked history links. -> Mitigate with
  compatibility redirects or retained read-only aliases until routes stabilize.

## Migration Plan

1. Add the book edit sidebar entries for authority and history.
2. Move or wrap the existing `AuthorityPanel` into a dedicated authority page.
3. Move book history list/detail/compare/restore entry points under the edit
   route family, retaining redirects or aliases for existing routes.
4. Add lock-all presentation and field coverage behavior to the authority page.
5. Add localized labels and accessible names for sidebar items and lock
   controls.
6. Verify that server authority tests remain unchanged; add focused app tests or
   stories for sidebar navigation and lock coverage states.

Rollback strategy:

- Keep existing history and authority components reusable while route migration
  lands.
- If the edit-console route migration is blocked, ship the sidebar authority
  entry first and retain existing history routes until a follow-up.

## Open Questions

- Should the public book detail page keep a visible history entry after the edit
  console becomes canonical, or should public users reach history only from
  links in edit/manage contexts?
- Should collaborator management ship on the same authority page in v1, or
  should the first implementation focus only on field locks and reserve a
  section placeholder?

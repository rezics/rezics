## Why

Book editing already has a sidebar navigation pattern, while authority locks and
history are still split across mixed product-detail and history-page surfaces.
As field locks become the primary way to close personal works to community
contributions, every edit surface needs a consistent edit console where
authority and history are discoverable, separate pages rather than incidental
panels.

## What Changes

- Introduce an edit-console navigation capability for Unit-backed edit surfaces,
  starting with book editing.
- Extend the book edit sidebar with first-class entries for authority/field
  locks and edit history.
- Move lock management into a standalone authority page reached from the edit
  sidebar.
- Move book edit history into a standalone edit-console history page reached
  from the edit sidebar.
- Preserve the existing lock semantics: locks restrict community contributions;
  primary owners, admins, and sufficiently privileged collaborators can still
  edit according to server authority rules.
- Render whole-object `UnitFieldLock("*")` as a top-level "lock all editable
  fields" switch. When active, field-level lock controls are shown as covered
  by the whole-object lock rather than persisted as individual child locks.
- Keep public/detail reading surfaces separate from edit-console navigation.
  Any public history entry point must be explicitly retained or removed by the
  implementation rather than left as a duplicate accidental path.

## Capabilities

### New Capabilities

- `edit-console-navigation`: Defines the shared edit-console sidebar model,
  route placement, active-state behavior, and page ownership for edit-only
  operational tools such as authority and history.

### Modified Capabilities

- `content-authority`: Adds product UI requirements for the authority/lock
  management page, including whole-object lock presentation and field coverage
  behavior.
- `history-product-ui`: Moves book history access into the edit console and
  clarifies how edit-console history relates to any public/detail history entry
  points.

## Impact

- Affected packages:
  - `package/app`: Book edit sidebar/navigation, new authority page, relocated
    history route/page composition, and lock status affordances.
  - `package/api`: No new API is expected, but existing authority/history hooks
    may need new query invalidation or route-local usage.
  - `package/contract`: No schema change is expected unless the implementation
    discovers missing stable lock-path labels.
  - `package/server`: No authority semantics change is expected; server behavior
    should remain the source of truth for lock bypass and denial.
  - `package/i18n`: Adds labels for edit-console navigation, authority page
    sections, lock-all coverage text, and history route copy.
- Dependencies:
  - No new runtime dependencies are expected.
- Compatibility:
  - Existing edit forms and server authority checks remain compatible.
  - Existing history URLs may be redirected or retained as compatibility routes,
    but the canonical edit workflow should use `/edit/...` routes.
- Migration:
  - Start with book edit because it already has `BookEditLayout` and sidebar
    navigation.
  - Later Unit-backed edit surfaces can adopt the same edit-console navigation
    capability without changing lock semantics.

## ADDED Requirements

### Requirement: Editor routes preserve public URLs outside main layout

Migrated edit routes SHALL preserve their public URL paths while rendering under
an editor route family that is separate from the main browsing layout. Route
organization MAY use a TanStack Router pathless editor segment so the file
structure owns editor layout without adding path segments to URLs.

#### Scenario: Review edit URL remains stable

- **WHEN** an actor opens `/review/:reviewId/edit`
- **THEN** the app SHALL render the Review editor under the edit console route
  family
- **AND** the URL SHALL remain `/review/:reviewId/edit`
- **AND** the main browsing layout SHALL NOT wrap the editor page

#### Scenario: Book edit URL remains stable after migration

- **WHEN** an actor opens `/book/:bookId/edit`
- **THEN** the app SHALL render the Book editor under the edit console route
  family
- **AND** existing Book edit child URLs such as `/book/:bookId/edit/tag` SHALL
  remain valid

### Requirement: Focal editor navigation returns to read surface

Every migrated editor console SHALL expose a localized return action that sends
the actor back to the corresponding read/detail surface for the edited content.

#### Scenario: Focal post editor returns to thread

- **WHEN** an actor opens a focal Post editor route
- **THEN** the editor console SHALL include a localized return action to the
  corresponding post thread or continue-thread read surface

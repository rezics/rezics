## ADDED Requirements

### Requirement: Entity feature owns attribution edit queue

The app package SHALL keep reusable entity attribution edit queue state under `package/app/src/entity`. The queue SHALL be reusable by book, game, media, post, chapter, and future library content editors. Book-specific editor components MAY compose the queue, but SHALL NOT own the reusable add/remove/reorder/coalescing model.

#### Scenario: Book editor uses shared entity attribution queue

- **WHEN** the book metadata editor lets a user edit authors or other entity credits
- **THEN** it SHALL use the shared entity attribution edit queue from the entity feature
- **AND** it SHALL NOT maintain a book-only implementation of the reusable queue model

#### Scenario: Future media editor can reuse queue

- **WHEN** a future media editor needs cast, studio, character, or subject entity attribution editing
- **THEN** it SHALL be able to reuse the entity feature queue without importing from the book feature

### Requirement: Entity attribution queue commits through batch endpoint

The entity attribution edit queue SHALL convert local user operations into final per-role batch operations before save. Saving the queue SHALL call the unit-scoped entity attribution batch endpoint once for the target Unit.

#### Scenario: Local operations coalesce into set operations

- **WHEN** a user locally adds, removes, and reorders authors before pressing save
- **THEN** the queue SHALL produce a final `setCredits` operation for the author role
- **AND** it SHALL not call the single link/unlink endpoints for each local operation

#### Scenario: Failed batch preserves local draft

- **WHEN** the batch save fails due to validation, authority, or network error
- **THEN** the editor SHALL preserve the local queue state
- **AND** the UI SHALL surface the save failure without silently discarding unsaved changes

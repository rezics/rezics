# app-entity-feature-architecture Specification

## Purpose

This capability defines how the app package organizes Entity-related page
features so that detail, edit, and self-claim surfaces live in a single
consolidated feature boundary while the reusable EntityPicker remains a
separate feature, and route URLs and behavior are preserved.

## Requirements

### Requirement: Consolidated Entity page feature

The app package SHALL keep Entity detail, edit, and self-claim page surfaces
inside the `package/app/src/entity` feature using the standard app feature
layers.

#### Scenario: Entity page code is colocated

- **WHEN** a maintainer inspects Entity detail, edit, and self-claim page code
- **THEN** the code is located under `package/app/src/entity` rather than
  separate top-level `entity-detail`, `entity-edit`, or `entity-self-claim`
  feature folders

#### Scenario: Entity feature layers remain valid

- **WHEN** Entity page code is moved into the consolidated feature
- **THEN** pure model code remains under `models/`, data hooks remain under
  `hooks/`, business sections remain under `sections/`, visual components remain
  under `components/`, and route-level page components remain under `pages/`

### Requirement: Reusable EntityPicker boundary

The app package SHALL keep EntityPicker as a separate reusable feature boundary
at `package/app/src/entity-picker`.

#### Scenario: Attribution flow uses EntityPicker

- **WHEN** attribution editing code needs to choose or create an entity
- **THEN** it imports EntityPicker from the `entity-picker` feature rather than
  reaching into Entity page internals

#### Scenario: Entity page consolidation does not absorb picker internals

- **WHEN** Entity detail, edit, and self-claim code is consolidated
- **THEN** picker-specific components, hooks, inline create behavior, and picker
  stories remain owned by `package/app/src/entity-picker`

### Requirement: Route behavior preservation

The app package SHALL preserve existing Entity route URLs, params, and page
behavior while updating route imports to the consolidated feature boundary.

#### Scenario: Entity routes continue to resolve

- **WHEN** users navigate to the existing Entity detail, slug detail, edit,
  my-entities, or new-entity routes
- **THEN** the same pages render with the same route params and user-facing
  behavior as before the consolidation

#### Scenario: Obsolete feature imports are removed

- **WHEN** the consolidation is complete
- **THEN** app code no longer imports from `@/entity-detail`, `@/entity-edit`,
  or `@/entity-self-claim`

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

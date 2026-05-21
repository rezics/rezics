## ADDED Requirements

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

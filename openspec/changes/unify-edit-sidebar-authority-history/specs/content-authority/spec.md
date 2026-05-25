## ADDED Requirements

### Requirement: Authority page for field locks

The app SHALL provide a standalone edit-console authority page for actors who
can manage Unit authority. The page SHALL expose field-lock management for the
current Unit and SHALL distinguish lock management from ordinary edit forms.

#### Scenario: Owner opens authority page

- **WHEN** a primary owner opens the edit-console authority page for a Unit
- **THEN** the page SHALL display current field locks for that Unit
- **AND** the page SHALL provide controls to add or remove locks according to
  server authority

#### Scenario: Unauthorized actor cannot manage locks

- **WHEN** an actor without lock-management authority reaches the authority page
- **THEN** the app SHALL avoid rendering lock mutation controls
- **AND** any attempted lock mutation SHALL still be rejected by the server

### Requirement: Whole-object lock presentation

The authority page SHALL render `UnitFieldLock("*")` as a top-level control that
locks all editable editorial fields against community contributions. When this
whole-object lock is active, field-level controls SHALL be disabled and shown as
covered by the whole-object lock rather than persisted as independent child
locks.

#### Scenario: Whole-object lock covers child fields

- **WHEN** the Unit has a field lock with `path = "*"`
- **THEN** the authority page SHALL show the all-fields lock control as active
- **AND** individual field lock controls SHALL be disabled or read-only with a
  visible covered-by-all-fields-lock state

#### Scenario: Turning on whole-object lock creates one lock row

- **WHEN** an authorized actor enables the all-fields lock
- **THEN** the app SHALL request creation of a single `UnitFieldLock` with
  `path = "*"`
- **AND** it SHALL NOT create lock rows for every listed child field

#### Scenario: Turning off whole-object lock restores field controls

- **WHEN** an authorized actor removes the all-fields lock
- **THEN** the app SHALL request deletion of the `UnitFieldLock` with
  `path = "*"`
- **AND** field-level lock controls SHALL become editable according to the
  remaining lock rows and actor authority

### Requirement: Field lock grouping and labels

The authority page SHALL group lockable fields by product meaning rather than
displaying an unstructured path list. Each visible field label SHALL have a
stable underlying lock path available for advanced inspection or debugging.

#### Scenario: Translation fields are grouped by language

- **WHEN** a Unit has multiple translation languages
- **THEN** the authority page SHALL show lockable translation fields with
  user-facing language labels
- **AND** each control SHALL map to the canonical lock path for that language
  and field

#### Scenario: Advanced path remains inspectable

- **WHEN** a maintainer reviews a lockable field
- **THEN** the UI SHALL provide access to the canonical lock path
- **AND** the displayed path SHALL match the value sent to the lock API

### Requirement: Lock status on collaborative edit forms

Collaborative edit forms SHALL surface locked-field status near affected fields
or save errors. Privileged actors who can edit through locks SHALL still see
that the field is locked for community contributors.

#### Scenario: Community editor sees locked field state

- **WHEN** a community editor opens a collaborative edit form with a locked
  field
- **THEN** the UI SHALL show that the field is locked or unavailable for their
  edit
- **AND** a failed save due to a locked field SHALL preserve unsaved input

#### Scenario: Maintainer can edit locked field with context

- **WHEN** a maintainer opens a collaborative edit form with a locked field
- **THEN** the field MAY remain editable
- **AND** the UI SHALL indicate that the field is locked for ordinary community
  contributors

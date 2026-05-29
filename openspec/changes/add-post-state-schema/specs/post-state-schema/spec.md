## ADDED Requirements

### Requirement: Post lifecycle state is a generic, behaviorally inert field

A post SHALL have an optional `state` field of generic string type. `state` is a
presentation label only: it SHALL NOT gate any backend behavior. A post with no
lifecycle SHALL have `state = null`, which SHALL be the default for every post
unless a stateful tag and schema apply.

#### Scenario: Post without a stateful tag has null state

- **WHEN** a post is created without any stateful tag
- **THEN** its `state` SHALL be null
- **AND** no lifecycle SHALL apply to it

#### Scenario: State does not gate replies

- **GIVEN** a post whose `state` is a terminal label (e.g. `closed` or
  `answered`) and whose `isLocked` is false
- **WHEN** a user replies
- **THEN** the reply SHALL be accepted, because reply permission depends on
  `isLocked`, not on `state`

### Requirement: A post's state schema is selected by a snapshotted tag slug

A post's legal `state` values, initial state, and transitions SHALL be
determined by a schema keyed on the slug of the post's classifying tag. That slug
SHALL be snapshotted at creation into `extra.stateSchemaTag`. The snapshot SHALL
NOT change when tags are later added or removed; re-pointing it SHALL require an
explicit migration. A post SHALL have at most one stateful tag.

#### Scenario: Schema tag is snapshotted at creation

- **WHEN** a post is created bearing a stateful tag (e.g. the question tag)
- **THEN** `extra.stateSchemaTag` SHALL be set to that tag's slug
- **AND** the post's `state` SHALL be initialized to the schema's initial state

#### Scenario: At most one stateful tag

- **GIVEN** a post that already bears a stateful tag
- **WHEN** a second stateful tag is applied
- **THEN** the request SHALL be rejected

#### Scenario: Snapshot does not drift with later tag changes

- **GIVEN** a post with `extra.stateSchemaTag` set at creation
- **WHEN** tags are later added to or removed from the post
- **THEN** `extra.stateSchemaTag` SHALL remain unchanged

### Requirement: A code registry defines official state schemas by tag slug

The system SHALL maintain a state-schema registry keyed by official tag slug.
Each schema SHALL define an initial state, the set of legal states, and the
allowed transitions between them. State entries MAY carry rendering hints but
SHALL NOT carry behavior flags. This change SHALL ship the official `question`
and `issue` schemas. Per-realm custom schema overrides SHALL NOT be implemented
in this change.

#### Scenario: Question schema

- **WHEN** the registry is consulted for the official question tag slug
- **THEN** it SHALL return a schema with states `open`, `answered`, `closed` and
  initial state `open`

#### Scenario: Issue schema

- **WHEN** the registry is consulted for the official issue tag slug
- **THEN** it SHALL return a schema with states `open`, `closed`, initial state
  `open`, and a close reason vocabulary of `COMPLETED`, `NOT_PLANNED`,
  `DUPLICATE`

### Requirement: State transitions are validated against the schema

A write that changes a post's `state` SHALL be accepted only if the target value
is a legal state in the post's schema and the transition from the current state
is allowed. Illegal states or transitions SHALL be rejected.

#### Scenario: Illegal state value rejected

- **GIVEN** a post governed by the question schema
- **WHEN** a client attempts to set `state` to a value not in the schema
- **THEN** the request SHALL be rejected with a validation error

#### Scenario: Disallowed transition rejected

- **GIVEN** a post whose schema does not allow a direct transition between two
  states
- **WHEN** a client attempts that transition
- **THEN** the request SHALL be rejected

### Requirement: Hard gates depend only on backend-owned fields

Reply permission SHALL depend only on `Post.isLocked`. Feed visibility and
read-only status SHALL depend only on `Unit.status`. Neither SHALL depend on
`Post.state`. Closing a post (setting a terminal `state`) SHALL NOT
automatically lock replies; locking SHALL be a separate, explicit write to
`isLocked`.

#### Scenario: Closing does not lock

- **GIVEN** an open post
- **WHEN** its `state` is set to `closed` without changing `isLocked`
- **THEN** `isLocked` SHALL remain false
- **AND** replies SHALL still be accepted

#### Scenario: Lock is independent of state

- **WHEN** a post is locked via `isLocked = true`
- **THEN** replies SHALL be rejected regardless of the post's `state`

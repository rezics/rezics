## ADDED Requirements

### Requirement: Post lifecycle state is a single generic, behaviorally inert slug

A post SHALL have an optional `state` field of generic string type whose value,
when present, is a kebab-case slug (lowercase, `-` separated). `state` is a
presentation label only: it SHALL NOT gate any backend behavior. A post with no
lifecycle SHALL have `state = null`, which SHALL be the default for every post
unless a stateful tag and schema apply. The lifecycle SHALL be a single axis;
there SHALL NOT be a separate outcome/resolution field.

#### Scenario: Post without a stateful tag has null state

- **WHEN** a post is created without any stateful tag
- **THEN** its `state` SHALL be null
- **AND** no lifecycle SHALL apply to it

#### Scenario: State does not gate replies

- **GIVEN** a post whose `state` is a closed-bucket value (e.g. `not-planned` or
  `solved`) and whose `isLocked` is false
- **WHEN** a user replies
- **THEN** the reply SHALL be accepted, because reply permission depends on
  `isLocked`, not on `state`

### Requirement: A post's state schema is selected by a snapshotted tag slug

A post's legal `state` values, initial state, and transitions SHALL be determined
by a schema keyed on the slug of the post's classifying tag. That slug SHALL be
snapshotted at creation into `extra.stateSchemaTag`. The snapshot SHALL NOT change
when tags are later added or removed; re-pointing it SHALL require an explicit
migration. A post SHALL have at most one stateful tag.

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
Each schema SHALL define an initial state, a set of values, and the allowed
transitions between them. Each value SHALL be a kebab-case slug carrying a
`bucket` of `active` or `closed`. Values SHALL NOT carry behavior flags. This
change SHALL ship the official `question` and `issue` schemas. Per-realm custom
schema overrides SHALL NOT be implemented in this change.

#### Scenario: Question schema

- **WHEN** the registry is consulted for the official question tag slug
- **THEN** it SHALL return a schema with initial state `open` and values
  `open` (active), `solved` (closed), `not-planned` (closed), `duplicate`
  (closed), and `off-topic` (closed)

#### Scenario: Issue schema

- **WHEN** the registry is consulted for the official issue tag slug
- **THEN** it SHALL return a schema with initial state `open` and values
  `open` (active), `completed` (closed), `not-planned` (closed), and `duplicate`
  (closed)

### Requirement: Each state value resolves to a tag for rendering, with slug fallback

Each state value SHALL resolve to a tag for rendering by slug. By default the
value slug SHALL be used as the tag slug; a schema MAY override the tag slug for
a value. When a tag exists for the resolved slug, its localized name and
presentation attributes SHALL be used. When no tag exists, the client SHALL
render the raw value slug. The system SHALL NOT define a separate display-label
field.

#### Scenario: Value renders via its mapped tag

- **GIVEN** a value `solved` resolving to a tag whose slug is `solved`
- **WHEN** the value is rendered
- **THEN** the tag's localized name and presentation attributes SHALL be used

#### Scenario: Missing tag falls back to the slug

- **GIVEN** a value whose resolved tag slug has no corresponding tag
- **WHEN** the value is rendered
- **THEN** the raw value slug SHALL be rendered

### Requirement: active and closed are derived filter buckets, not stored values

The values `active` and `closed` SHALL NOT be stored on a post. They SHALL be
derived groupings over the schema's value buckets, used for listing filters. A
filter for in-progress posts SHALL match values whose bucket is `active`; a
filter for concluded posts SHALL match values whose bucket is `closed`. The
bucket SHALL be decoupled from `isLocked` and from `Unit.status`.

#### Scenario: Bucket filter matches by value bucket

- **WHEN** posts are filtered by the `closed` bucket
- **THEN** the query SHALL match posts whose `state` is any value declared
  `closed` in the applicable schema (e.g. `state IN` the closed-bucket slugs)
- **AND** SHALL NOT require a stored `closed` value or an anti-join

### Requirement: Closing requires a reason; there is no bare closed value

A schema SHALL NOT define a bare `closed` value. Concluding a post SHALL set a
specific closed-bucket reason value. Reopening SHALL be a transition from a
closed-bucket value back to the initial state where the schema allows it.

#### Scenario: Closing writes a reason value

- **GIVEN** an open post governed by the issue schema
- **WHEN** it is closed
- **THEN** its `state` SHALL be set to a closed-bucket reason value
  (`completed`, `not-planned`, or `duplicate`)
- **AND** there SHALL be no value `closed`

#### Scenario: Reopen returns to the initial state

- **GIVEN** a post whose `state` is a closed-bucket value and whose schema allows
  reopening
- **WHEN** it is reopened
- **THEN** its `state` SHALL transition to the schema's initial state

### Requirement: State writes are validated against the schema; reads are lenient

A write that changes a post's `state` SHALL be accepted only if the target value
is a legal value in the post's schema and the transition from the current state
is allowed; illegal values or transitions SHALL be rejected. The read contract
SHALL type `state` as a generic string and SHALL NOT reject unknown values on
read, so that adding a value does not break existing clients.

#### Scenario: Illegal value rejected on write

- **GIVEN** a post governed by the question schema
- **WHEN** a client attempts to write a `state` not in the schema
- **THEN** the request SHALL be rejected with a validation error

#### Scenario: Disallowed transition rejected on write

- **GIVEN** a post whose schema does not allow a direct transition between two
  values
- **WHEN** a client attempts that transition
- **THEN** the request SHALL be rejected

#### Scenario: Unknown value tolerated on read

- **GIVEN** a post whose `state` value is not known to an older client
- **WHEN** the client reads the post
- **THEN** parsing SHALL succeed
- **AND** the client SHALL render the raw slug

### Requirement: Hard gates depend only on backend-owned fields

Reply permission SHALL depend only on `Post.isLocked`. Feed visibility and
read-only status SHALL depend only on `Unit.status`. Neither SHALL depend on
`Post.state`. Concluding a post (setting a closed-bucket value) SHALL NOT
automatically lock replies; locking SHALL be a separate, explicit write to
`isLocked`.

#### Scenario: Closing does not lock

- **GIVEN** an open post
- **WHEN** its `state` is set to a closed-bucket value without changing
  `isLocked`
- **THEN** `isLocked` SHALL remain false
- **AND** replies SHALL still be accepted

#### Scenario: Lock is independent of state

- **WHEN** a post is locked via `isLocked = true`
- **THEN** replies SHALL be rejected regardless of the post's `state`
</content>

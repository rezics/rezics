## ADDED Requirements

### Requirement: Initial editorial creation revisions
The main server SHALL write an initial editorial `HistoryOutbox` row in the
same transaction as any successful creation of content whose later canonical
edits are in editorial content-history scope. The initial revision SHALL capture
the created editable content state as an effective PATCH payload and SHALL use
the same per-Unit sequence allocator as later history rows.

#### Scenario: Book creation records initial revision
- **WHEN** an authenticated user creates a Book through a wiki or personal
  creation path
- **THEN** the server SHALL create the canonical Book rows and one
  `HistoryOutbox` row in the same transaction
- **AND** the outbox row SHALL have sequence `1` for that Book Unit when no
  earlier history exists
- **AND** the revision payload SHALL include the created Book editable metadata
  and provided translations

#### Scenario: Entity creation records initial revision
- **WHEN** an authenticated user creates an Entity through a wiki or personal
  creation path
- **THEN** the server SHALL create the canonical Entity rows and one
  `HistoryOutbox` row in the same transaction
- **AND** the revision payload SHALL include the created Entity editable
  metadata and provided translations

#### Scenario: Out-of-scope create does not record editorial revision
- **WHEN** a normal reply, reaction, tag-governance write, or generic low-level
  Unit create succeeds
- **THEN** the system SHALL NOT create an editorial content-history revision
  solely because a row was created

## MODIFIED Requirements

### Requirement: PATCH-shape editorial payloads

Editorial revision payloads SHALL carry a `patch` field containing the effective
sparse JSON sub-tree applied by the canonical mutation. Payloads SHALL NOT
include a `slots` field. Payload references to other Units SHALL store ids, not
denormalized display names. Writers SHALL omit unchanged paths from post-cutover
revision payloads even when the submitted request body included those paths.

#### Scenario: Attribution revision stores referenced entity id in the patch

- **WHEN** a credit attribution change submits PATCH `{ credits: { authors: [{ targetUnitId: "ent-7" }] } }`
- **THEN** the revision payload's `patch.credits.authors[0].targetUnitId` SHALL be `"ent-7"`
- **AND** it SHALL NOT copy the entity's current display name into the payload

#### Scenario: Editorial payload omits the slots field

- **WHEN** the history service consumes a post-cutover editorial outbox event
- **THEN** the persisted payload SHALL contain a `patch` field
- **AND** SHALL NOT contain a `slots` field

#### Scenario: Externally-governed paths produce no editorial revision

- **WHEN** a write to `tags` or `realmTagApplications` occurs through the dedicated governance API
- **THEN** no editorial `HistoryOutbox` row SHALL be created for that write
- **AND** the dedicated governance system SHALL retain its own audit trail

#### Scenario: Title-only translation edit stores title-only patch

- **WHEN** a Book translation update request includes unchanged `summary`,
  `subtitle`, and `description` values but changes only `title`
- **THEN** the canonical translation row SHALL update
- **AND** the history outbox revision payload SHALL include
  `translations.<language>.title`
- **AND** it SHALL NOT include unchanged `summary`, `subtitle`, or
  `description` leaves

### Requirement: `changedFieldKeys` is a derived projection

`UnitRevision.changedFieldKeys` SHALL NOT be persisted as a stored column on post-cutover revisions. The history service SHALL derive the changed-paths list at read time by walking the stored effective `patch` sub-tree and emitting one entry per leaf path. Each entry is a free-form JSON path string consistent with the editorial PATCH path vocabulary. The derived list MAY be cached in the read DTO but SHALL NOT be persisted as canonical state.

For pre-cutover revisions, the history reader SHALL read `changedFieldKeys` from the legacy data preserved by the cutover migration (`legacyChangedKeys` inside the payload).

#### Scenario: Edit that changes English description and authors

- **WHEN** a client submits PATCH `{ translations: { en: { description: "..." } }, credits: { authors: [...] } }`
- **AND** the history service serves the resulting post-cutover revision
- **THEN** the derived `changedFieldKeys` SHALL include `translations.en.description` and `credits.authors`
- **AND** the derived list SHALL NOT include `translations.en.title` or any other untouched path

#### Scenario: Pre-cutover revision uses preserved changed keys

- **WHEN** the history reader serves a revision created before this change landed
- **THEN** `changedFieldKeys` SHALL be read from the preserved legacy data
- **AND** the values SHALL remain whatever the pre-cutover system emitted (e.g. `post.body`)

#### Scenario: Metadata-only PATCH does not create a revision

- **WHEN** a PATCH is submitted but produces no effective change after sparse merge (every leaf already equals the stored value)
- **THEN** the editorial endpoint SHALL NOT write a `HistoryOutbox` row
- **AND** no `UnitRevision` SHALL be created

#### Scenario: Timeline chips match effective translation edit
- **WHEN** a user changes only a Book translation title
- **AND** the history service serves the resulting timeline revision
- **THEN** `changedFieldKeys` SHALL contain `translations.<language>.title`
- **AND** it SHALL NOT contain unchanged translation field paths

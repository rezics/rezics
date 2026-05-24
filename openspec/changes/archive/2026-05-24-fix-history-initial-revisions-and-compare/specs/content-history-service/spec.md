## ADDED Requirements

### Requirement: Initial editorial creation revisions
The main server SHALL write an initial editorial `HistoryOutbox` row in the
same transaction as any successful creation of content whose later canonical
edits are in editorial content-history scope. The initial revision SHALL capture
the created editable content state as an effective PATCH payload and SHALL use
the same per-Unit sequence allocator as later history rows.

The set of paths included in the initial revision SHALL equal the set of paths
that subsequent edit revisions of the same content type would emit for the same
content state. There SHALL NOT exist any editorial path that is recorded by
later edits but omitted by initial creation, and vice versa.

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

#### Scenario: Initial revision path coverage equals edit revision path coverage
- **WHEN** the same editable content state is reached either by creation or by
  a sequence of edits from an empty initial state
- **THEN** the union of editorial leaf paths emitted in both cases SHALL be
  identical
- **AND** there SHALL NOT be any path that the create writer omits but an edit
  writer would emit for the same value

### Requirement: Per-path snapshot index
The history service SHALL maintain a derived per-path snapshot index that
records the value of every editorial leaf path at every sequence in which it
was touched. The index SHALL be keyed by `(unit_id, sequence, path)` and SHALL
support a lookup that returns the most recent value of a given path at or
before a given sequence in a single index seek. The index SHALL be derived
state owned by the history service and SHALL NOT be authoritative; revision
payloads remain the canonical source.

Leaf path granularity SHALL follow the editorial PATCH path vocabulary: nested
objects in the payload SHALL be exploded path-by-path, and scalar values and
arrays SHALL each be stored as a single leaf row. Array elements SHALL NOT be
exploded into individual rows; an array path's value SHALL be the complete
array as written.

#### Scenario: Outbox ingest populates the index
- **WHEN** the history service ingests an editorial outbox event for unit `U`
  at sequence `S` with effective PATCH containing leaves `p1, p2, ..., pn`
- **THEN** the history service SHALL upsert rows `(U, S, p1, v1)`, `(U, S, p2, v2)`, ..., `(U, S, pn, vn)` into the per-path snapshot index
- **AND** the row values SHALL be the leaf values as written in the PATCH

#### Scenario: Nested objects explode, arrays do not
- **WHEN** an effective PATCH contains `{ credits: { authors: [{ targetUnitId: "ent-7" }] } }`
- **THEN** the index SHALL contain exactly one row for path `credits.authors`
- **AND** the row's value SHALL be the full array `[{ targetUnitId: "ent-7" }]`
- **AND** the index SHALL NOT contain rows for `credits.authors[0]` or `credits.authors[0].targetUnitId`

#### Scenario: Latest-touch lookup is single-seek
- **WHEN** a caller asks for the most recent value of path `P` for unit `U`
  at or before sequence `X`
- **THEN** the history service SHALL return the value and originating sequence
  of the latest row `(U, P, s)` with `s <= X`, or null if no such row exists
- **AND** the response SHALL be served by a single index seek without scanning
  unrelated revisions

#### Scenario: Existing revisions are backfilled
- **WHEN** the per-path snapshot index is first created
- **THEN** the history service SHALL populate it once by exploding every
  existing `UnitRevision` payload, including pre-cutover slot-shaped payloads
  and post-cutover PATCH payloads, using the same leaf path vocabulary

### Requirement: Path-snapshot compare reconstruction
The history service SHALL expose a means to compute the set of editorial
differences between any two revisions of the same Unit without folding revision
payloads in sequence order. Given a base sequence `B` and target sequence `T`
for unit `U`, the service SHALL compute the candidate path set as the union of
editorial leaf paths touched by revisions in the open-closed range `(B, T]`,
then for each candidate path return the latest value at or before `B` and the
latest value at or before `T`.

Callers SHALL NOT need to read intermediate revision payloads to assemble
effective states. The compare result SHALL be derivable from per-path lookups
against the snapshot index alone.

#### Scenario: Non-adjacent compare reports range-internal changes
- **WHEN** revision 1 sets `translations.zh-hant.title = "A"`
- **AND** revision 2 sets `translations.zh-hant.summary = "S2"`
- **AND** revision 3 sets `translations.zh-hant.title = "B"`
- **AND** a caller requests compare with base = 1, target = 3
- **THEN** the candidate path set SHALL include `translations.zh-hant.title` and `translations.zh-hant.summary`
- **AND** the base values SHALL be the values at sequence 1
- **AND** the target values SHALL be the values at sequence 3
- **AND** the result SHALL show the title changing from `A` to `B`
- **AND** the result SHALL show the summary changing from the value at sequence 1 to `S2`

#### Scenario: Missing initial revision returns null base
- **WHEN** a path was first touched by sequence `K` where `K > B`
- **AND** a caller requests compare with base = `B`, target >= `K`
- **THEN** the base value for that path SHALL be null
- **AND** the result SHALL render this as an additive change rather than an
  equality

#### Scenario: Adjacent compare returns endpoint patch union
- **WHEN** a caller requests compare with base = `T - 1`, target = `T`
- **THEN** the candidate path set SHALL equal the leaf paths touched by
  revision `T`
- **AND** the response cost SHALL be bounded by the size of revision `T`'s
  patch, not by `T`

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

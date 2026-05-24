# content-history-service Specification

## Purpose

Defines the independent `@rezics/history` service that persists Unit revisions and structure events alongside the canonical main server. The main server remains authoritative for content writes and permission checks; it captures history through a same-transaction `HistoryOutbox` table consumed asynchronously by the history service. This v1 mechanism avoids CDC, Kafka, Debezium, or external queues, prevents dual-write loss, and keeps history reads eventually consistent with canonical state. Post-cutover editorial revisions store the submitted editorial PATCH sub-tree as their content-addressed payload; pre-cutover revisions retain their stored `slots`-shape payload byte-for-byte. High-change structures use event history.

## Requirements

### Requirement: Independent history service
The system SHALL provide an independent `@rezics/history` service package with its own Prisma schema, persistence tables, and read APIs for Unit revisions and structure events. The main server SHALL remain the authority for canonical content writes and permission checks.

#### Scenario: History reads are served by history service
- **WHEN** a client requests a Unit revision timeline
- **THEN** the request SHALL be served by the history service API or an API client wrapper around it
- **AND** canonical current Unit state SHALL still be read from the main server

### Requirement: Transactional history outbox
The main server SHALL write a `HistoryOutbox` row in the same database transaction as any canonical mutation that is in history scope. This v1 mechanism SHALL NOT require CDC, Kafka, Debezium, or an external queue.

#### Scenario: Canonical write and outbox commit together
- **WHEN** a collaborative Unit edit succeeds
- **THEN** the canonical row changes and the `HistoryOutbox` row SHALL commit in the same main database transaction

#### Scenario: Canonical rollback removes outbox
- **WHEN** a collaborative Unit edit transaction rolls back
- **THEN** no `HistoryOutbox` row for that failed edit SHALL remain

### Requirement: No synchronous history HTTP in canonical transaction
The main server SHALL NOT call the history service over HTTP from inside the canonical content transaction.

#### Scenario: Mutation writes outbox instead of remote history call
- **WHEN** a main server mutation records history
- **THEN** it SHALL write a `HistoryOutbox` row
- **AND** it SHALL NOT hold the main DB transaction open while waiting for the history service

### Requirement: Exact payload capture
The main server SHALL write enough payload into `HistoryOutbox` for the history service to persist the exact post-mutation revision or event. The history service SHALL NOT reconstruct revision content by later reading main current state.

#### Scenario: Consecutive edits preserve distinct revisions
- **WHEN** two edits to the same Unit commit in sequence before the history service consumes the first outbox row
- **THEN** the first history revision SHALL reflect the first committed state
- **AND** the second history revision SHALL reflect the second committed state

### Requirement: Per-Unit sequence
The system SHALL assign a monotonically increasing sequence per Unit for history records in main transaction scope before or during outbox creation.

#### Scenario: Concurrent edits receive ordered sequences
- **WHEN** two edits to the same Unit commit concurrently
- **THEN** their history outbox rows SHALL receive distinct per-Unit sequence values
- **AND** the sequence order SHALL match canonical commit order

### Requirement: Editorial revision storage

The history service SHALL store editorial Unit revisions as content-addressed snapshots using `UnitRevision` and `RevisionContent`-style records. For post-cutover revisions, the canonical payload is the submitted editorial PATCH sub-tree. Identical PATCH payloads SHALL share the same content hash. Pre-cutover revisions retain their stored `slots`-shape payload byte-for-byte.

#### Scenario: Revision stores patch by hash

- **WHEN** the history service consumes a post-cutover editorial outbox event
- **THEN** it SHALL store the submitted PATCH sub-tree in `RevisionContent` keyed by the canonical hash of that sub-tree
- **AND** it SHALL create a `UnitRevision` row pointing to that hash

#### Scenario: Duplicate patch deduplicates content

- **WHEN** two post-cutover revisions have identical PATCH payloads
- **THEN** they SHALL point to the same `RevisionContent` hash
- **AND** only one `RevisionContent` row SHALL be stored for that payload

#### Scenario: Pre-cutover revisions are read in their stored shape

- **WHEN** the history reader serves a revision created before this change landed
- **THEN** it SHALL return the stored `slots`-shape payload unchanged
- **AND** it SHALL NOT rewrite the payload into `patch`-shape

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

### Requirement: Structure event history
High-change structures such as book content structure SHALL use event history rather than full editorial snapshots for every node operation.

#### Scenario: Content structure node update records event
- **WHEN** a chapter/content-structure node title is updated
- **THEN** the history service SHALL persist a structure event for the operation
- **AND** it SHALL NOT require a full Unit editorial snapshot solely for that node update

### Requirement: History outbox consumption
The history service SHALL claim, process, retry, and mark outbox rows using an idempotent consumer. Failed rows SHALL remain observable and retryable.

#### Scenario: Consumer retries failed row
- **WHEN** processing a `HistoryOutbox` row fails due to a transient history database error
- **THEN** the row SHALL remain pending or failed with retry metadata
- **AND** a later consumer pass SHALL be able to process it without duplicating the final history record

### Requirement: Eventually consistent history UI
History reads SHALL be allowed to lag behind canonical writes. Clients SHALL treat missing just-created revisions as eventual consistency rather than canonical write failure.

#### Scenario: Timeline lag after edit
- **WHEN** a collaborative edit succeeds but the history service has not consumed the outbox row yet
- **THEN** current Unit detail reads from main SHALL show the edited content
- **AND** the history timeline MAY omit the new revision until ingestion completes

### Requirement: Revision content hash is based on the patch payload

The history system SHALL compute `UnitRevision.contentHash` from the canonical serialization of the stored PATCH sub-tree (for post-cutover revisions) or the stored `slots` payload (for pre-cutover revisions). Two editorial revisions with identical canonical payloads SHALL point to the same `RevisionContent` row even when authored by different actors or at different sequences.

#### Scenario: Identical patches deduplicate across sequences

- **WHEN** the history service ingests two editorial revision payloads whose `patch` sub-trees are byte-identical
- **AND** the revisions have different sequence values or actors
- **THEN** both `UnitRevision` rows SHALL reference the same `RevisionContent.hash`
- **AND** only one `RevisionContent` row SHALL be stored

#### Scenario: Restore metadata does not change patch hash

- **WHEN** a restore edit submits a PATCH whose content is byte-identical to a previous PATCH
- **THEN** the resulting new revision SHALL receive a new sequence
- **AND** the new revision SHALL reuse the previous revision's content hash
- **AND** restore metadata SHALL be stored on the revision record without changing the content hash

### Requirement: Structure batch events

The history service SHALL support a `book.contentStructure.batch` structure event payload that represents one logical BookContentStructure save. The event payload SHALL contain an ordered `operations` array whose entries describe node-level domain changes such as create, update, move, delete, link, unlink, or bulk replace.

#### Scenario: History service persists batch event

- **WHEN** the outbox consumer receives a structure event with `eventType = "book.contentStructure.batch"`
- **THEN** the history service SHALL persist one `StructureEvent` row for the Unit sequence
- **AND** the persisted payload SHALL preserve the ordered `operations` array

#### Scenario: Reprocessing batch event is idempotent

- **WHEN** the outbox consumer retries the same `book.contentStructure.batch` outbox row
- **THEN** the history service SHALL NOT create a duplicate `StructureEvent`
- **AND** the existing event SHALL remain unchanged

### Requirement: History read DTOs support product display

History revision and structure-event read DTOs SHALL provide enough stable metadata for product UI display: id, unitId, sequence, actorUserId, changedFieldKeys, message, createdAt, ingestedAt, and content or event payload where permitted by the requester's authority.

#### Scenario: Timeline entry carries display metadata

- **WHEN** a client requests a Unit revision timeline
- **THEN** every revision item SHALL include sequence, actorUserId, changedFieldKeys, message, createdAt, and ingestedAt
- **AND** the client SHALL be able to render the timeline without fetching each single revision first

#### Scenario: Raw content can be omitted by permission

- **WHEN** a viewer lacks raw history payload permission
- **THEN** revision timeline and structure-event timeline responses SHALL still include metadata
- **AND** raw content payloads SHALL be omitted or redacted according to the history authority contract

### Requirement: Product APIs acknowledge ingestion lag

History read APIs SHALL allow history to lag behind canonical writes and SHALL expose enough state for clients to distinguish an empty history from a failed request. A successful empty timeline SHALL return an empty list and a nullable cursor rather than an error.

#### Scenario: Empty timeline is successful

- **WHEN** a Unit has no ingested history records
- **THEN** the revision timeline endpoint SHALL return `revisions = []`
- **AND** it SHALL return `nextCursor = null`
- **AND** the response SHALL NOT be treated as a 404

#### Scenario: Newly saved edit may be absent temporarily

- **WHEN** a canonical edit succeeds and its outbox row has not been consumed
- **THEN** the history timeline MAY omit that edit
- **AND** current Unit reads from the main server SHALL remain authoritative for the latest content

### Requirement: History persistence excludes draft and autosave records

The history service SHALL persist only canonical history records delivered through `HistoryOutbox`. `UnitRevision`, `RevisionContent`, and `StructureEvent` SHALL NOT be used as storage for editor draft state, autosave snapshots, uncommitted operation logs, or frontend recovery data.

#### Scenario: Autosave is stored outside history

- **WHEN** a future editor autosaves unsaved user work
- **THEN** that autosave SHALL NOT create a `UnitRevision` or `StructureEvent`
- **AND** any persistent autosave storage SHALL be specified separately from content history

#### Scenario: Batch commit is history eligible

- **WHEN** a server endpoint applies a canonical batch mutation that is in history scope
- **THEN** the resulting `HistoryOutbox` payload MAY be ingested as a `UnitRevision` or `StructureEvent`
- **AND** the persisted history record SHALL represent the semantic batch commit rather than each local UI operation

### Requirement: History schema comments explain canonical commit semantics

The history service Prisma schema SHALL include comments on `UnitRevision`, `RevisionContent`, and `StructureEvent` explaining that they store canonical history commits. The comments SHALL distinguish editorial PATCH revisions from high-change structure batch events and SHALL warn that editor autosave/draft/op-log persistence belongs outside these models.

#### Scenario: UnitRevision comment identifies editorial commit semantics

- **WHEN** a maintainer inspects the history service Prisma schema
- **THEN** the `UnitRevision` model comment SHALL identify it as an editorial commit record
- **AND** the comment SHALL state that it is not an autosave or draft log

#### Scenario: StructureEvent comment identifies batch event semantics

- **WHEN** a maintainer inspects the history service Prisma schema
- **THEN** the `StructureEvent` model comment SHALL identify it as a high-change structure batch event record
- **AND** the comment SHALL state that it is not a per-drag or per-click UI operation log

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

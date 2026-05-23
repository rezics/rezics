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

Editorial revision payloads SHALL carry a `patch` field containing the submitted sparse JSON sub-tree exactly as the client submitted it. Payloads SHALL NOT include a `slots` field. Payload references to other Units SHALL store ids, not denormalized display names.

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

### Requirement: `changedFieldKeys` is a derived projection

`UnitRevision.changedFieldKeys` SHALL NOT be persisted as a stored column on post-cutover revisions. The history service SHALL derive the changed-paths list at read time by walking the stored `patch` sub-tree and emitting one entry per leaf path. Each entry is a free-form JSON path string consistent with the editorial PATCH path vocabulary. The derived list MAY be cached in the read DTO but SHALL NOT be persisted as canonical state.

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

# content-history-service Specification

## Purpose

Defines the independent `@rezics/history` service that persists Unit revisions and structure events alongside the canonical main server. The main server remains authoritative for content writes and permission checks; it captures history through a same-transaction `HistoryOutbox` table consumed asynchronously by the history service. This v1 mechanism avoids CDC, Kafka, Debezium, or external queues, prevents dual-write loss, and keeps history reads eventually consistent with canonical state. Editorial revisions are stored as content-addressed slot-based snapshots; high-change structures use event history.

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
The history service SHALL store editorial Unit revisions as content-addressed snapshots using `UnitRevision` and `RevisionContent`-style records. Identical canonical payloads SHALL share the same content hash.

#### Scenario: Revision stores content by hash
- **WHEN** the history service consumes an editorial outbox event
- **THEN** it SHALL store the canonical payload in `RevisionContent` keyed by hash
- **AND** it SHALL create a `UnitRevision` row pointing to that hash

#### Scenario: Duplicate payload deduplicates content
- **WHEN** two revisions have identical canonical payloads
- **THEN** they SHALL point to the same `RevisionContent` hash

### Requirement: Slot-based editorial payloads
Editorial revision payloads SHALL be slot-based and SHALL use stable slot names such as `unit`, `translations`, `extension`, `credits`, `subjects`, `tags`, and `post`. Payload references to other Units SHALL store ids, not denormalized display names.

#### Scenario: Attribution revision stores entity id
- **WHEN** a credit attribution changes on a book
- **THEN** the revision payload SHALL store the referenced entity Unit id
- **AND** it SHALL NOT copy the entity's current display name into the revision payload

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

### Requirement: Revision content hash is based on canonical content

The history system SHALL compute `UnitRevision.contentHash` from the canonical revision content payload, not from outbox metadata such as sequence, actor, message, category, or outbox row id. Two editorial revisions with identical content payloads SHALL point to the same `RevisionContent` row even when they were authored by different actors or at different sequences.

#### Scenario: Identical editorial content deduplicates across sequences

- **WHEN** the history service ingests two editorial revision payloads with identical `slots`
- **AND** the revisions have different sequence values or actors
- **THEN** both `UnitRevision` rows SHALL reference the same `RevisionContent.hash`
- **AND** only one `RevisionContent` row SHALL be stored for that canonical payload

#### Scenario: Metadata-only difference does not create a new content blob

- **WHEN** a restore saves content that exactly matches an older revision but uses a new message
- **THEN** the new revision SHALL receive a new sequence
- **AND** the new revision SHALL reuse the older revision's content hash

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

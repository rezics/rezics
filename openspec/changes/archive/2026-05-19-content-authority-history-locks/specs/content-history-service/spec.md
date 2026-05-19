## ADDED Requirements

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

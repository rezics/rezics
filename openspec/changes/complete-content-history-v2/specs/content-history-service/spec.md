## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Transactional history outbox

The main server SHALL write a `HistoryOutbox` row in the same database
transaction as any canonical mutation that is in history scope. This mechanism
SHALL preserve same-transaction atomicity for history capture while allowing
delivery to be performed asynchronously by `@rezics/job-runner`.

#### Scenario: Canonical write and outbox commit together

- **WHEN** a collaborative Unit edit succeeds
- **THEN** the canonical row changes and the `HistoryOutbox` row SHALL commit
  in the same main database transaction

#### Scenario: Canonical rollback removes outbox

- **WHEN** a collaborative Unit edit transaction rolls back
- **THEN** no `HistoryOutbox` row for that failed edit SHALL remain

#### Scenario: Outbox insert is delivered through queued ingestion

- **WHEN** Sequin observes a committed `HistoryOutbox` insert
- **THEN** the job-runner SHALL enqueue `history.outbox.ingest` for that outbox
  row
- **AND** the history service SHALL NOT need to poll the main database as the
  default ingestion mechanism

### Requirement: History outbox consumption

History outbox ingestion SHALL be performed by an idempotent job-runner handler
that claims or verifies the target `HistoryOutbox` row, writes the corresponding
history record, and marks the outbox row processed. Failed rows SHALL remain
observable and retryable through job-runner and outbox metadata.

#### Scenario: Consumer retries failed row

- **WHEN** processing a `HistoryOutbox` row fails due to a transient history
  database error
- **THEN** the job SHALL retry according to the `history.ingest` lane policy
- **AND** the outbox row SHALL remain pending or failed with retry metadata
- **AND** a later retry SHALL be able to process it without duplicating the
  final history record

#### Scenario: Duplicate history ingest command is idempotent

- **WHEN** two `history.outbox.ingest` jobs for the same `HistoryOutbox.id` are
  delivered or retried
- **THEN** at most one final `UnitRevision` or `StructureEvent` SHALL be
  persisted for the outbox payload
- **AND** duplicate attempts SHALL converge on the same processed outbox state

## ADDED Requirements

### Requirement: History poller is disabled after queue cutover

The `@rezics/history` polling consumer SHALL be disabled by default after
queued history ingestion is enabled. A temporary explicit fallback flag MAY
exist during migration, but the system SHALL NOT run the poller and
job-runner ingestion as concurrent default owners of the same outbox.

#### Scenario: Default history service startup does not poll

- **WHEN** `@rezics/history` starts after queue cutover with default
  configuration
- **THEN** it SHALL serve history APIs
- **AND** it SHALL NOT start the `HistoryOutbox` polling loop

#### Scenario: Fallback poller requires explicit opt-in

- **WHEN** an operator enables the temporary fallback poller flag
- **THEN** the history service MAY poll the outbox
- **AND** deployment documentation SHALL warn that the job-runner history
  worker should not concurrently own the same rows

### Requirement: History ingest jobs preserve exact payload semantics

The `history.outbox.ingest` handler SHALL read the stored `HistoryOutbox`
payload and persist history from that payload. It SHALL NOT reconstruct
revision content by reading current main database state.

#### Scenario: Delayed history job preserves older revision payload

- **WHEN** two edits commit before the first `history.outbox.ingest` job runs
- **THEN** each job SHALL persist the exact payload stored in its own outbox
  row
- **AND** the first revision SHALL NOT be overwritten by current state from the
  second edit

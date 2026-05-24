## MODIFIED Requirements

### Requirement: Fan-out partial sync uses cursor-based batching

Fan-out functions and job-runner fanout handlers SHALL process documents in
batches using cursor-based pagination, consistent with existing full sync
functions. Runtime fanout handlers SHALL process a bounded segment per job and
SHALL re-enqueue a continuation command with the next cursor when more targets
remain.

#### Scenario: Large fan-out is segmented

- **GIVEN** a user has 10,000 posts
- **WHEN** a runtime post-author fanout command is processed
- **THEN** the handler SHALL process posts in cursor-based batches
- **AND** it SHALL stop at the configured per-job segment limit
- **AND** it SHALL re-enqueue a continuation command when more posts remain

## ADDED Requirements

### Requirement: Job runner invokes partial sync primitives

Runtime search projection jobs SHALL invoke the existing `@rezics/search`
partial sync primitives instead of duplicating projection logic inside
`@rezics/job-runner`.

#### Scenario: Content tag job reuses search package helper

- **WHEN** the job-runner handles `search.content.patchTags`
- **THEN** it SHALL call the `@rezics/search` content tag patch helper with the
  configured SearchClient and server Prisma client
- **AND** it SHALL NOT rebuild tag projection logic inside the handler

### Requirement: Partial sync commands are idempotent current-state operations

Partial sync commands SHALL be safe to retry. A retried command SHALL compute
the desired projection from current database state and SHALL NOT depend on the
original CDC event ordering or before/after values.

#### Scenario: Retried translation patch reflects latest database state

- **WHEN** a `search.content.patchTranslations` job fails and later retries
- **THEN** the retry SHALL read current `UnitTranslation` rows
- **AND** the resulting document fields SHALL reflect the latest committed
  translations, not the stale CDC payload

### Requirement: Progress search sync is queued at runtime

Runtime changes to `UserUnitProgress` SHALL enqueue progress search sync or
remove jobs. The worker handler SHALL call the existing progress projection
helpers and SHALL keep progress document ids deterministic by `(userId, unitId)`.

#### Scenario: Progress upsert enqueues sync job

- **WHEN** a runtime progress upsert commits
- **THEN** the system SHALL enqueue `search.progress.sync(userId, unitId)`
- **AND** the worker handler SHALL write the `user_unit_progress` document using
  the current database row

#### Scenario: Progress soft delete enqueues remove job

- **WHEN** a runtime progress row is deleted or marked deleted
- **THEN** the system SHALL enqueue `search.progress.remove(userId, unitId)`
- **AND** the worker handler SHALL remove the deterministic progress document

### Requirement: Search sync jobs distinguish full, partial, delete, and fanout effects

Search command kinds SHALL explicitly identify whether the job performs a full
current-state sync, a partial field-group patch, a delete/remove, or a fanout
segment. Lane names alone SHALL NOT be used to infer handler behavior.

#### Scenario: Command kind selects handler

- **WHEN** the worker receives a job on `search.sync.slow`
- **THEN** it SHALL dispatch by command kind such as
  `search.content.patchTags`, `search.content.patchTranslations`, or
  `search.post.patchTarget`
- **AND** it SHALL NOT infer the operation solely from the lane name

### Requirement: Meilisearch task failures remain observable through job failures

Search jobs SHALL keep Meilisearch write failures observable through job
failure or retry state. When a handler error occurs before successful task
enqueue, the job SHALL fail or retry. If the Meilisearch client returns a task
uid successfully, the job SHALL record enough output metadata to correlate the
job with the Meilisearch task where practical.

#### Scenario: Meili request failure retries job

- **WHEN** the Meilisearch write request fails before returning a task
- **THEN** the search job SHALL fail or retry according to lane retry policy
- **AND** the failure SHALL be visible in job-runner admin inspection

#### Scenario: Meili task uid is recorded

- **WHEN** a handler receives a Meilisearch task uid from a write operation
- **THEN** the job output or logs SHALL include the task uid and index name
  where practical

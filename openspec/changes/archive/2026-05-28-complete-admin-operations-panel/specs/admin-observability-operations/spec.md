## ADDED Requirements

### Requirement: Admin observability covers services, queues, sync, and search

The admin panel SHALL provide observability for system status, job-runner queues, Sequin/CDC, Meilisearch, history outbox, sync lag, and failed jobs.

#### Scenario: Queue has failed jobs

- **WHEN** job-runner reports failed jobs
- **THEN** the admin observability area SHALL show lane, state, attempt count, source metadata, and safe failure summary

### Requirement: Browser calls only Rezics admin APIs

The admin browser app SHALL call Rezics typed admin APIs and SHALL not call private database, Meili, Sequin, or job-runner internals directly.

#### Scenario: Meili status loads

- **WHEN** admin opens Meili status
- **THEN** the browser SHALL fetch a server-provided safe summary rather than using Meili credentials directly

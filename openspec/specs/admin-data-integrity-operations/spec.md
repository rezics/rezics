# admin-data-integrity-operations Specification

## Purpose
TBD - created by archiving change complete-admin-operations-panel. Update Purpose after archive.
## Requirements
### Requirement: Admin exposes drift detection and repair workflows

The admin panel SHALL expose drift checks and repair workflows for search projection, history outbox, work-domain membership, slugs/aliases, attribution, source-site data, and denormalized counters.

#### Scenario: Admin runs dry-run repair

- **WHEN** an admin starts a dry-run for search drift repair
- **THEN** the system SHALL return affected counts and sample targets without mutating data

### Requirement: Repair jobs are queued and trackable

Long-running repair operations SHALL run through job-runner or equivalent durable operation state with status, progress, retries, and safe failure summaries.

#### Scenario: Repair job fails

- **WHEN** a repair job fails
- **THEN** the admin panel SHALL show safe error summary, retry eligibility, and audit link


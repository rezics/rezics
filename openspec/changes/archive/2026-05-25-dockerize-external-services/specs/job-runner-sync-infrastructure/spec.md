## ADDED Requirements

### Requirement: Managed local Sequin source readiness

The managed local external-services workflow SHALL provide a Sequin source
PostgreSQL database that is started with logical replication enabled before
Sequin connects. The job-runner Sequin configuration SHALL remain responsible
for the local publication and replication slot names used by CDC routing.

#### Scenario: Managed source is ready before Sequin starts

- **WHEN** the repo-managed external-services stack starts Sequin for local
  development
- **THEN** the source PostgreSQL service SHALL already be running with
  `wal_level=logical`
- **AND** the source PostgreSQL service SHALL allow creation or use of the
  configured Sequin logical replication slot

#### Scenario: Publication and slot names stay aligned

- **WHEN** local Sequin connects to the managed source database
- **THEN** it SHALL use the publication and replication slot names configured
  for `@rezics/job-runner`
- **AND** source database verification SHALL report drift between the managed
  database and the configured publication or slot names

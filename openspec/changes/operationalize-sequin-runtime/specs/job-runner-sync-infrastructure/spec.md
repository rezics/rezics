## ADDED Requirements

### Requirement: Sequin runtime is configured as infrastructure

The system SHALL provide source-controlled Sequin runtime configuration that
defines the source database connection, replication slot, publication, HTTP
endpoint, and webhook sink required to deliver CDC messages to
`@rezics/job-runner`. The checked-in configuration SHALL NOT contain production
secrets.

#### Scenario: Sequin starts from checked-in config

- **WHEN** an operator starts the bundled Sequin runtime with required
  environment variables
- **THEN** Sequin SHALL load the checked-in config file through its config file
  path setting
- **AND** the loaded configuration SHALL define the source database,
  replication slot, publication, job-runner HTTP endpoint, and webhook sink

#### Scenario: Secrets remain environment-owned

- **WHEN** the Sequin config and compose files are inspected
- **THEN** production database credentials, Sequin secret keys, and webhook
  secrets SHALL be supplied through environment variables
- **AND** checked-in files SHALL NOT contain production secret values

### Requirement: Sequin delivers CDC to job-runner only

Sequin SHALL deliver Rezics CDC webhook messages to `@rezics/job-runner`.
`@rezics/history` SHALL NOT be configured as a direct Sequin webhook target for
normal queued ingestion.

#### Scenario: HistoryOutbox CDC routes through job-runner

- **WHEN** Sequin delivers an insert for `HistoryOutbox`
- **THEN** the webhook target SHALL be `@rezics/job-runner`
- **AND** job-runner SHALL enqueue a `history.outbox.ingest` command on the
  `history.ingest` lane

#### Scenario: History service is not a Sequin sink

- **WHEN** the bundled Sequin sink configuration is inspected
- **THEN** it SHALL NOT contain an HTTP sink that targets `@rezics/history`
- **AND** history read APIs SHALL remain independent of CDC webhook delivery

### Requirement: Sequin compose supports production and development

The system SHALL provide a compose-based Sequin runtime with a reusable base
topology for production-capable deployment and a development override for
host-local services.

#### Scenario: Base compose defines durable Sequin dependencies

- **WHEN** the base Sequin compose file is inspected
- **THEN** it SHALL define Sequin, Sequin's state Postgres, and Redis services
- **AND** it SHALL use persistent volumes for Sequin state dependencies
- **AND** it SHALL mount the checked-in Sequin config into the Sequin service

#### Scenario: Development override handles host-local services

- **WHEN** the development compose override is used
- **THEN** Sequin SHALL be able to reach a host-local source Postgres and a
  host-local Bun job-runner
- **AND** local UI/API ports MAY be exposed for operator inspection

### Requirement: Sequin startup supports Docker and Podman

The Sequin startup command SHALL use a wrapper that can launch the compose stack
with either Docker or Podman. Runtime selection SHALL be deterministic and
operator-overridable.

#### Scenario: Explicit runtime override is honored

- **WHEN** `CONTAINER_RUNTIME` is set to a supported runtime value
- **THEN** the Sequin startup wrapper SHALL use that runtime
- **AND** it SHALL fail with a clear error if the requested runtime is not
  available

#### Scenario: Runtime auto-detection is deterministic

- **WHEN** `CONTAINER_RUNTIME` is not set
- **THEN** the Sequin startup wrapper SHALL select the first available supported
  compose runtime in its documented order
- **AND** it SHALL print clear setup guidance if no supported runtime is
  available

### Requirement: Sequin publication handles Prisma table identifiers

The Sequin source publication setup SHALL account for Prisma's quoted PascalCase
table names. Publication SQL or equivalent setup SHALL preserve exact table
names such as `"HistoryOutbox"` and `"UnitTranslation"`.

#### Scenario: Publication SQL quotes PascalCase table names

- **WHEN** publication setup SQL is generated or documented for Prisma-managed
  tables
- **THEN** PascalCase table identifiers SHALL be double-quoted
- **AND** unquoted lowercase-equivalent table references SHALL NOT be used for
  those tables

#### Scenario: YAML table filters are verified before relying on them

- **WHEN** Sequin sink-level table filters are used for Prisma PascalCase
  tables
- **THEN** the implementation SHALL verify the exact expected table string
  format through Sequin config validation or startup logs
- **AND** publication setup SHALL remain the authoritative table boundary until
  that verification is complete

### Requirement: Sequin runtime has documented preflight and verification

The system SHALL document the operational checks required before enabling the
Sequin runtime and the manual verification steps that prove CDC reaches the
intended job-runner lanes.

#### Scenario: Operator checks prerequisites before startup

- **WHEN** an operator follows the Sequin operations documentation
- **THEN** they SHALL be instructed to verify logical replication support,
  replication-capable credentials, publication ownership, webhook secret
  alignment, and job-runner reachability

#### Scenario: Operator verifies search and history delivery

- **WHEN** Sequin is running against a non-production environment
- **THEN** the documented verification SHALL include at least one
  search-affecting table change
- **AND** it SHALL include at least one `HistoryOutbox` insert routed to
  `history.outbox.ingest`

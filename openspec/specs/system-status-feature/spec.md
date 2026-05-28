# system-status-feature Specification

## Purpose

Defines a root/admin-only internal system status capability for Rezics. The
status API aggregates safe operational status for Rezics services, databases,
job-runner queues, Meilisearch, and Sequin CDC support, returning partial
results when individual dependencies fail. The admin frontend owns the status
detail page, the dashboard status overview card, and all status data fetching;
the public app exposes no status routes or internal diagnostics. Internal
status surfaces redact secrets, connection strings, and raw stack traces and
present only operator-facing summaries.
## Requirements
### Requirement: Internal system status API

The system SHALL provide a root/admin-only status API that aggregates safe
operational status for Rezics services, databases, job-runner queues,
Meilisearch, and Sequin CDC support. The API SHALL return partial results when
one dependency fails and SHALL normalize each dependency into a status item with
status, label, optional URL, optional last checked time, and safe remediation
details.

#### Scenario: Root caller receives aggregate status

- **WHEN** a root/admin caller requests the system status API
- **THEN** the response SHALL include status items for configured Rezics
  services, databases, job-runner queue state, Meilisearch, and Sequin CDC
  support
- **AND** each item SHALL include a machine-readable status value

#### Scenario: Dependency failure does not block all status

- **WHEN** one configured dependency is unreachable during status aggregation
- **THEN** the response SHALL still include available status for other
  dependencies
- **AND** the failed dependency SHALL be reported as `unavailable` or `unknown`
  with a safe reason

#### Scenario: Non-admin caller is denied

- **WHEN** a caller without root/admin authorization requests internal system
  status
- **THEN** the system SHALL reject the request with an authorization failure
- **AND** it SHALL NOT probe internal services on behalf of that caller

### Requirement: Service status inventory

The status API SHALL report configured Rezics service status for the frontend
app URL, main server, auth service, job-runner HTTP role, job-runner worker or
queue health, Meilisearch, and Sequin when configured. Service URL output SHALL
include only non-secret URLs intended for operator navigation.

#### Scenario: Configured URLs are returned

- **WHEN** service status URLs are configured
- **THEN** the status API SHALL return URL entries for app, server, auth,
  job-runner, Meilisearch, and Sequin as applicable
- **AND** it SHALL NOT include database URLs, API keys, passwords, internal
  secrets, or raw environment dumps

#### Scenario: Missing optional URL is represented

- **WHEN** an optional service URL such as Sequin UI is not configured
- **THEN** the status API SHALL report that URL as not configured or unknown
- **AND** the overall status SHALL NOT fail solely because the optional URL is
  absent

### Requirement: Database support status

The status API SHALL report database support status for the source database
features required by Sequin CDC. At minimum, it SHALL check logical replication
support, publication existence, routed publication table coverage, replication
slot existence, slot active state, and slot lag or flush position when available.

#### Scenario: Source database supports CDC

- **WHEN** the source database has `wal_level = logical`, the configured
  publication exists, all routed tables are included, and the configured
  replication slot exists
- **THEN** the status API SHALL report source database CDC support as
  `available`
- **AND** it SHALL include safe publication and slot names

#### Scenario: Publication table drift is reported

- **WHEN** a table routed by the checked-in Sequin configuration is missing from
  the live publication
- **THEN** the status API SHALL report CDC support as `degraded`
- **AND** it SHALL identify the missing table name without exposing database
  credentials

#### Scenario: Replication slot lag warning

- **WHEN** the configured replication slot exists but shows lag or an advancing
  risk condition above the configured threshold
- **THEN** the status API SHALL report the CDC support item as `degraded`
- **AND** it SHALL include safe lag or flush-position information when
  available

### Requirement: Job-runner and queue status

The status API SHALL include job-runner health/readiness and queue state. Queue
state SHALL include lane counts by state and a summary of failed jobs sufficient
to navigate to deeper job-runner admin details. Failed jobs SHALL not expose
secret payload values.

#### Scenario: Queue counts are available

- **WHEN** job-runner admin queue counts can be read
- **THEN** the status API SHALL include counts for each configured lane and job
  state
- **AND** the status page SHALL be able to render failed, active, retry, and
  created counts

#### Scenario: Failed jobs degrade queue status

- **WHEN** one or more failed jobs are reported by job-runner admin endpoints
- **THEN** the status API SHALL report queue status as `degraded`
- **AND** it SHALL include a safe failed-job summary with lane, id, command
  kind, attempt count, timestamps, and source metadata when available

### Requirement: Sequin status and UI links

The status API and status page SHALL expose configured Sequin status and
navigation information, including Sequin UI URL, Sequin health URL, configured
sink or webhook target name when available, and the job-runner webhook route.
The system SHALL distinguish Sequin service reachability from source database
CDC support.

#### Scenario: Sequin health is reachable

- **WHEN** the configured Sequin health URL returns a successful response
- **THEN** the status API SHALL report Sequin service status as `available`
- **AND** the status page SHALL provide the configured Sequin UI URL when
  available

#### Scenario: Sequin reachable but database unsupported

- **WHEN** Sequin health is available but the source database CDC support check
  fails
- **THEN** the status API SHALL report Sequin service status separately from
  database CDC support
- **AND** the database CDC support item SHALL carry the degraded or unavailable
  state

### Requirement: Admin status frontend boundary

The admin frontend SHALL provide status UI that owns the status detail page or
section, status overview card, status-specific hooks, status models, and status
UI composition. The public app SHALL NOT expose status routes, footer links,
home widgets, status data fetching, or status business logic for internal
diagnostics.

#### Scenario: Admin home renders overview card

- **WHEN** an admin opens the admin dashboard
- **THEN** the dashboard SHALL render a compact `StatusOverviewCard`
- **AND** it SHALL replace the previous simple health strip rather than adding a
  second status summary

#### Scenario: Public app has no status entry

- **WHEN** a public app user opens the public home page or footer
- **THEN** the app SHALL NOT render a system status card or public status link
- **AND** it SHALL NOT trigger internal status API calls from public app pages

### Requirement: Status page user interface

The admin status page or detail section SHALL render a compact root/admin
diagnostics interface with an overview summary, service links, service health
grid, Meili status panel or navigation target, Sequin/CDC/database panel, and
queue status panel. The UI SHALL use design system tokens, accessible status
text, non-color-only indicators, and Traditional Chinese user-facing copy unless
the surrounding admin area uses a different established locale.

#### Scenario: Status page shows sections

- **WHEN** an admin user opens the admin status detail surface
- **THEN** the page SHALL show overview, service links, service health,
  Meili, Sequin/CDC/database, and queue status sections when data is available
- **AND** unavailable sections SHALL render actionable empty/error states rather
  than disappearing silently

#### Scenario: Status is not communicated by color alone

- **WHEN** a status item is rendered
- **THEN** the UI SHALL include text or icon semantics that distinguish
  available, degraded, unavailable, and unknown states
- **AND** color alone SHALL NOT be the only status indicator

### Requirement: Status overview card navigation

The status overview card SHALL summarize overall system status and selected
dependency counts in a compact card suitable for the admin dashboard.
Activating the card SHALL navigate to the full admin status detail surface.

#### Scenario: Card navigates to status page

- **WHEN** an admin activates the status overview card
- **THEN** the admin app SHALL navigate to the configured admin status route or
  detail surface
- **AND** the route SHALL render the full status page subject to authorization

#### Scenario: Card shows degraded dependencies

- **WHEN** one or more dependencies are degraded or unavailable
- **THEN** the overview card SHALL show a compact summary of the affected
  dependency count
- **AND** it SHALL not require the embedding feature to know individual status
  calculation rules

### Requirement: Internal status security

Internal status APIs and pages SHALL avoid exposing secrets, raw environment
values, connection strings, private API keys, passwords, or raw stack traces.
Errors SHALL be logged server-side when useful and returned to the UI as safe
operator-facing summaries.

#### Scenario: Secret values are redacted

- **WHEN** a status check fails due to a dependency configuration issue
- **THEN** the API response SHALL include a safe error summary
- **AND** it SHALL NOT include secret environment values or connection strings

#### Scenario: Browser does not call private services directly

- **WHEN** the status page loads
- **THEN** the admin browser app SHALL call Rezics typed status APIs
- **AND** it SHALL NOT directly call private Meili, Sequin, database, or
  job-runner internal admin endpoints

### Requirement: System status is integrated into operations dashboard

The system status feature SHALL remain its own safe API/page, and the admin dashboard SHALL embed its summary as one operational signal alongside queues, search drift, governance, and audit summaries.

#### Scenario: Status degraded on dashboard

- **WHEN** system status reports degraded CDC support
- **THEN** the admin dashboard SHALL show the degraded status and link to the full status panel

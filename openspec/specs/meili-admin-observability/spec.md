# meili-admin-observability Specification

## Purpose

Defines root/admin-only Meilisearch observability for Rezics. A structured
expected schema registry is the single source of truth for all Rezics-owned
indexes, shared by runtime index initialization and observability. A Meili
status summary API reports availability, live index statistics, content/index
counts, recent task summaries, and drift between expected and live settings,
normalizing failures into safe status items. Existing init, sync, key, and
delete operations remain protected by root/admin authorization, and the admin
Meili frontend separates read-only observability from mutation and destructive
operation surfaces.

## Requirements

### Requirement: Expected Meili schema registry

The system SHALL expose a structured expected Meilisearch schema registry for
all Rezics-owned indexes. Each registry entry SHALL include the index uid,
primary key, searchable attributes, filterable attributes, sortable attributes,
and a domain description suitable for admin display. Runtime index
initialization and Meili observability SHALL read from this registry rather than
maintaining separate expected-settings definitions.

#### Scenario: All known indexes are represented

- **WHEN** the expected Meili schema registry is requested
- **THEN** it SHALL include entries for `content`, `feedbacks`, `users`,
  `posts`, `realms`, `entities`, and `user_unit_progress`
- **AND** each entry SHALL include the expected primary key and configured
  searchable, filterable, and sortable attributes

#### Scenario: Initialization uses registry settings

- **WHEN** the system initializes a known Meili index
- **THEN** it SHALL apply settings derived from the schema registry entry for
  that index
- **AND** the observability schema output SHALL report the same expected
  settings for that index

### Requirement: Meili status summary API

The system SHALL provide a root/admin-only Meili status summary API that reports
Meilisearch availability, version when available, known expected schemas, live
index summaries, recent task summaries, and drift between expected and live
settings. The API SHALL normalize Meilisearch failures into structured status
items rather than leaking raw exceptions.

#### Scenario: Healthy Meili summary

- **WHEN** a root/admin caller requests the Meili status summary and
  Meilisearch is reachable
- **THEN** the response SHALL include an overall Meili status of `available` or
  `degraded`
- **AND** it SHALL include expected schema entries and live summaries for known
  indexes

#### Scenario: Meili unavailable

- **WHEN** a root/admin caller requests the Meili status summary and
  Meilisearch cannot be reached within the configured timeout
- **THEN** the response SHALL include an overall Meili status of `unavailable`
- **AND** it SHALL include a safe reason string without exposing the master key
  or connection secrets

#### Scenario: Non-admin caller is denied

- **WHEN** a caller without root/admin authorization requests the Meili status
  summary
- **THEN** the system SHALL reject the request with an authorization failure
- **AND** it SHALL NOT query Meilisearch on behalf of that caller

### Requirement: Live index statistics

For each known Meili index, the status summary SHALL report whether the index
exists, its live primary key when available, document count, indexing state,
last update time, raw document database size when available, average document
size when available, and field distribution when available.

#### Scenario: Existing index reports statistics

- **WHEN** the `content` index exists in Meilisearch and stats are available
- **THEN** the status summary SHALL report the `content` index as existing
- **AND** it SHALL include `numberOfDocuments`, `isIndexing`, `lastUpdate`, and
  `fieldDistribution` from Meilisearch stats when present

#### Scenario: Missing expected index is reported

- **WHEN** a known expected index is absent from Meilisearch
- **THEN** the status summary SHALL include that index with `exists = false`
- **AND** the index SHALL contribute to an overall `degraded` Meili status

### Requirement: Meili settings drift detection

The system SHALL compare live Meili settings for each known index against the
expected schema registry. Drift detection SHALL cover primary key, searchable
attributes, filterable attributes, and sortable attributes. The status response
SHALL report missing, extra, and mismatched values per setting family.

#### Scenario: Matching settings have no drift

- **WHEN** a live index has the same primary key and configured attributes as
  the expected schema registry
- **THEN** the index status SHALL report no settings drift
- **AND** the index SHALL NOT be degraded by settings comparison

#### Scenario: Missing filterable attribute is reported

- **WHEN** the expected schema includes a filterable attribute that is absent
  from the live Meili index settings
- **THEN** the index status SHALL report that attribute as missing drift
- **AND** the index SHALL contribute to an overall `degraded` Meili status

#### Scenario: Extra live attribute is reported as warning

- **WHEN** a live Meili index includes an attribute that is not present in the
  expected schema registry
- **THEN** the index status SHALL report the extra attribute
- **AND** the response SHALL classify it as drift information rather than a
  destructive repair instruction

### Requirement: Meili content and index statistics

The Meili observability API SHALL report content/index statistics for known
indexes. At minimum, the response SHALL include total document counts from
Meilisearch stats and type/status-style breakdowns for indexes where the
expected schema declares facetable summary fields. When source-database
comparison is implemented, source counts SHALL be presented as separate
expected counts rather than replacing Meili's live counts.

#### Scenario: Content index reports type distribution

- **WHEN** the `content` index has documents and supports a `type` summary
  field
- **THEN** the Meili status response SHALL include count information grouped by
  content type when available
- **AND** it SHALL also include the total Meili document count for the index

#### Scenario: Source and Meili counts are distinguished

- **WHEN** the system can compute both source database counts and Meili counts
  for an index
- **THEN** the status response SHALL label source counts and Meili counts as
  separate values
- **AND** it SHALL NOT present approximate Meili counts as canonical database
  truth

### Requirement: Recent Meili task visibility

The Meili observability API SHALL include recent Meili task summaries for known
indexes, including task uid, index uid, task status, task type, duration,
timestamps, and safe error details when available. Failed or processing tasks
SHALL be visible without requiring an operator to open the Meilisearch
dashboard.

#### Scenario: Failed task appears in status

- **WHEN** Meilisearch reports a recent failed task for a known index
- **THEN** the Meili status response SHALL include the task uid, index uid,
  status, type, and safe error code or message
- **AND** the relevant index or overall Meili status SHALL be `degraded`

#### Scenario: No recent task failures

- **WHEN** Meilisearch reports recent tasks and none are failed or stuck
- **THEN** the Meili status response SHALL include the task summaries
- **AND** task state alone SHALL NOT degrade the overall status

### Requirement: Safe Meili admin actions remain explicit

Existing Meili init, sync, key, and delete operations SHALL remain protected by
root/admin authorization. The status surface MAY link to safe init/sync actions
or show operation results, but destructive operations such as delete-all and
reset-all SHALL require explicit root authorization and confirmation before
execution.

#### Scenario: Init action is authorized

- **WHEN** a root/admin caller invokes an index initialization action from the
  Meili admin surface
- **THEN** the system SHALL verify root/admin authorization before applying
  settings
- **AND** the action result SHALL be reported without exposing secrets

#### Scenario: Destructive action requires confirmation

- **WHEN** a caller attempts a destructive Meili action through a UI surface
- **THEN** the UI SHALL require an explicit confirmation step
- **AND** the server SHALL still enforce root/admin authorization for the
  request

### Requirement: Admin Meili UI is split by operator task

The admin Meili frontend SHALL separate read-only observability from mutation
and destructive operation surfaces. The existing admin Meili page MAY remain as
the route shell, but schema/index/task observability SHALL NOT be added to a
single monolithic page that also owns init, sync, delete/reset, and key
management logic.

#### Scenario: Observability is read-only and scannable

- **WHEN** an admin opens the Meili observability surface
- **THEN** the UI SHALL emphasize schema drift, live index statistics, content
  counts, and recent task state
- **AND** it SHALL NOT colocate destructive delete/reset controls in the same
  immediate panel

#### Scenario: Existing operations remain available

- **WHEN** an admin needs index initialization, full sync, key management, or
  destructive maintenance
- **THEN** those actions SHALL remain available from clearly labeled admin
  operation surfaces
- **AND** destructive controls SHALL remain visually and structurally separated
  from read-only observability

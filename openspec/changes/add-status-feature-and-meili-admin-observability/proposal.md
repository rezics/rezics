## Why

Rezics has Meilisearch, Sequin CDC, job-runner queues, multiple HTTP services,
and separate databases, but operators currently need to inspect scattered
endpoints, docs, and container logs to know whether search and sync are healthy.
We need a compact internal status surface that explains service readiness,
Meili index trust, and CDC/database support state without moving or renaming the
public home feature.

## What Changes

- Add a `status` frontend feature that owns a root/admin-only status page and a
  reusable status overview card component.
- Keep the existing home route and `home` feature unchanged; home or future
  dashboards may render the status overview card as a consumer only.
- Add system status APIs that aggregate health for Rezics services, databases,
  job-runner queue state, Meilisearch, and Sequin CDC support.
- Complete the Meili admin/observability surface with expected schema output,
  live index statistics, settings drift, content/index counts, and recent task
  status.
- Surface service and UI URLs, including app, server, auth, job-runner,
  Meilisearch, and Sequin links, without exposing secrets.
- Add root/admin authorization around internal diagnostics and mutation-like
  admin operations.
- Preserve existing public search behavior and existing Meili init/sync/delete
  endpoints unless a task explicitly routes them through the new admin surface.

## Capabilities

### New Capabilities

- `meili-admin-observability`: Expected Meili schema, live index health,
  settings drift, index/content statistics, task visibility, and safe admin
  operation reporting.
- `system-status-feature`: Internal status APIs and frontend status feature for
  Rezics services, databases, queues, Meili, Sequin, URLs, and overview-card
  navigation.

### Modified Capabilities

- None.

## Impact

- Affected packages:
  - `package/search`: centralize expected Meili index schema metadata and expose
    helpers for status/stat collection.
  - `package/server`: add root/admin diagnostics APIs that aggregate Meili,
    service, database, and CDC support state.
  - `package/api`: add typed API clients and TanStack Query hooks for Meili
    observability and system status.
  - `package/app`: add `status` feature, status route, and reusable overview
    card; consume it without renaming or moving `home`.
  - `package/job-runner`: expose or reuse minimal admin/readiness endpoints for
    queue and CDC-facing status where needed.
  - `@rezics/contract` if shared response schemas are required for typed status
    responses.
- External systems:
  - Meilisearch `/health`, `/stats`, `/indexes`, `/indexes/{uid}/settings`, and
    `/tasks`.
  - Source PostgreSQL replication metadata such as `wal_level`, publications,
    replication slots, and slot lag.
  - Sequin health/UI endpoints as configured by environment.
- Backward compatibility:
  - No route rename for `/` or `package/app/src/home`.
  - Existing search APIs remain compatible.
  - Existing Meili admin endpoints may be supplemented, but existing callers
    should keep working during this change.
- Migration needs:
  - Operators may need to configure non-secret status URL environment values for
    local/dev/prod services.
  - No data migration is expected.

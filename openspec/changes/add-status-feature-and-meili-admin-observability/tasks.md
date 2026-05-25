## 1. Meili Schema Registry

- [ ] 1.1 Add a structured expected-index schema registry in `package/search` for `content`, `feedbacks`, `users`, `posts`, `realms`, `entities`, and `user_unit_progress`.
- [ ] 1.2 Refactor `SearchClient` index initialization to consume the registry for primary key and searchable/filterable/sortable settings.
- [ ] 1.3 Export registry types and safe helpers from `@rezics/search` without introducing server/runtime dependencies.
- [ ] 1.4 Add unit tests proving registry entries match the settings applied by each init method.

## 2. Meili Observability API

- [ ] 2.1 Add server-side Meili status service functions for health, version, stats, indexes, settings, and recent tasks with bounded timeouts.
- [ ] 2.2 Implement settings drift comparison for primary key, searchable attributes, filterable attributes, and sortable attributes.
- [ ] 2.3 Add content/index statistics aggregation, including Meili document totals and declared summary-field breakdowns where supported.
- [ ] 2.4 Expose a root/admin-only Meili status summary endpoint in `package/server`.
- [ ] 2.5 Normalize Meili failures into safe status responses without leaking API keys or raw connection details.
- [ ] 2.6 Add targeted server tests for healthy summary, unavailable Meili, missing index, settings drift, failed task, and authorization denial.

## 3. System Status Backend

- [ ] 3.1 Define typed system status response models and schemas in the appropriate shared package or server-local module.
- [ ] 3.2 Add service URL/status configuration for app, server, auth, job-runner, Meili, and Sequin without exposing secret env values.
- [ ] 3.3 Implement server-side service health aggregation with partial-result behavior and per-check timeouts.
- [ ] 3.4 Implement source database CDC support checks for `wal_level`, publication existence, routed table coverage, replication slot existence, active state, and lag/flush-position information.
- [ ] 3.5 Integrate job-runner health/readiness, queue counts, and failed job summaries into the status aggregation path.
- [ ] 3.6 Integrate Sequin health/UI URL and webhook target metadata while keeping Sequin reachability separate from database CDC support.
- [ ] 3.7 Expose a root/admin-only system status endpoint from `package/server`.
- [ ] 3.8 Add backend tests for partial dependency failure, secret redaction, non-admin denial, database CDC degradation, and queue failure degradation.

## 4. API Client Layer

- [ ] 4.1 Add typed `@rezics/api` HTTP wrappers for Meili observability and system status endpoints.
- [ ] 4.2 Add TanStack Query options/hooks with short stale times suitable for status polling.
- [ ] 4.3 Ensure browser clients only call Rezics server APIs and never call private Meili, Sequin, database, or job-runner internals directly.
- [ ] 4.4 Add type or unit tests for response normalization and query key stability.

## 5. Status Frontend Feature

- [ ] 5.1 Create `package/app/src/status` with public `index.ts`, `models`, `hooks`, `components`, and `pages` boundaries following the app feature standard.
- [ ] 5.2 Add `StatusPage` with overview, service links, service health, Meili, Sequin/CDC/database, and queue sections.
- [ ] 5.3 Add `StatusOverviewCard` that summarizes overall state and navigates to the full status route when activated.
- [ ] 5.4 Ensure status indicators include non-color-only text or icon semantics for available, degraded, unavailable, and unknown states.
- [ ] 5.5 Use rezics design tokens and compact admin density; avoid bordered page-section chrome and raw colors.
- [ ] 5.6 Add Traditional Chinese UI copy for user-visible status labels and remediation summaries.
- [ ] 5.7 Add loading, empty, unavailable, and partial-error states for all major status page sections.

## 6. Routing and Integration

- [ ] 6.1 Add a guarded status route in `package/app/src/routes` using the chosen path (`/status` or `/admin/status`).
- [ ] 6.2 Wire route-level authorization so non-root/non-admin users cannot access internal diagnostics.
- [ ] 6.3 Optionally embed `StatusOverviewCard` in an existing surface as a consumer without renaming or moving `home`.
- [ ] 6.4 Verify `package/app/src/home` does not define status hooks, status models, or diagnostic logic.
- [ ] 6.5 Update route generation and imports according to the repo's TanStack Router conventions.

## 7. Documentation and Operations

- [ ] 7.1 Document required non-secret status URL environment variables and local defaults.
- [ ] 7.2 Update job-runner operations docs to point operators from manual Sequin/CDC checks to the new status page where applicable.
- [ ] 7.3 Document which status checks are read-only and which existing Meili operations remain destructive.
- [ ] 7.4 Add rollout notes for environments without Sequin or job-runner enabled.

## 8. Validation

- [ ] 8.1 Run targeted `bun test` suites for `package/search`, `package/server`, `package/api`, and status feature modules.
- [ ] 8.2 Run `bun run check:convention` and fix any feature-boundary or import convention issues.
- [ ] 8.3 Run `bun run format:check` or format changed files with Biome.
- [ ] 8.4 Verify TypeScript builds for affected packages.
- [ ] 8.5 Manually verify the status page route after starting the relevant dev services, including a degraded dependency case.

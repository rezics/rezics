## 1. Meili Schema Registry

- [x] 1.1 Add a structured expected-index schema registry in `package/search` for `content`, `feedbacks`, `users`, `posts`, `realms`, `entities`, and `user_unit_progress`.
- [x] 1.2 Refactor `SearchClient` index initialization to consume the registry for primary key and searchable/filterable/sortable settings.
- [x] 1.3 Export registry types and safe helpers from `@rezics/search` without introducing server/runtime dependencies.
- [x] 1.4 Add unit tests proving registry entries match the settings applied by each init method.

## 2. Meili Observability API

- [x] 2.1 Add server-side Meili status service functions for health, version, stats, indexes, settings, and recent tasks with bounded timeouts.
- [x] 2.2 Implement settings drift comparison for primary key, searchable attributes, filterable attributes, and sortable attributes.
- [x] 2.3 Add content/index statistics aggregation, including Meili document totals and declared summary-field breakdowns where supported.
- [x] 2.4 Expose a root/admin-only Meili status summary endpoint in `package/server`.
- [x] 2.5 Normalize Meili failures into safe status responses without leaking API keys or raw connection details.
- [x] 2.6 Add targeted server tests for healthy summary, unavailable Meili, missing index, settings drift, failed task, and authorization denial.

## 3. System Status Backend

- [x] 3.1 Define typed system status response models and schemas in the appropriate shared package or server-local module.
- [x] 3.2 Add service URL/status configuration for app, server, auth, job-runner, Meili, and Sequin without exposing secret env values.
- [x] 3.3 Implement server-side service health aggregation with partial-result behavior and per-check timeouts.
- [x] 3.4 Implement source database CDC support checks for `wal_level`, publication existence, routed publication table coverage, replication slot existence, active state, and lag/flush-position information.
- [x] 3.5 Integrate job-runner health/readiness, queue counts, and failed job summaries into the status aggregation path.
- [x] 3.6 Integrate Sequin health/UI URL and webhook target metadata while keeping Sequin reachability separate from database CDC support.
- [x] 3.7 Expose a root/admin-only system status endpoint from `package/server`.
- [x] 3.8 Add backend tests for partial dependency failure, secret redaction, non-admin denial, database CDC degradation, and queue failure degradation.

## 4. API Client Layer

- [x] 4.1 Add typed `@rezics/api` HTTP wrappers for Meili observability and system status endpoints.
- [x] 4.2 Add TanStack Query options/hooks with short stale times suitable for status polling.
- [x] 4.3 Ensure browser clients only call Rezics server APIs and never call private Meili, Sequin, database, or job-runner internals directly.
- [x] 4.4 Add type or unit tests for response normalization and query key stability.

## 5. Correct Erroneous Public App Integration

- [ ] 5.1 Remove `package/app/src/diagnostic` and any public app status feature exports introduced by this change.
- [ ] 5.2 Remove the public app status route under `package/app/src/routes` and regenerate the app route tree.
- [ ] 5.3 Remove `StatusOverviewCard` from `package/app/src/home/pages/Home.tsx`; public app home must not import or render internal diagnostics.
- [ ] 5.4 Remove the public app footer/navigation `/status` links introduced by this change.
- [ ] 5.5 Verify public app pages do not call `useSystemStatusQuery`, `useMeiliStatusQuery`, or status API wrappers for internal diagnostics.

## 6. Admin System Status Frontend

- [ ] 6.1 Add a `package/admin` status feature or module with public boundaries for models, hooks, components, and pages/sections.
- [ ] 6.2 Add admin status query hooks that consume `@rezics/api` status clients and do not call Meili, Sequin, databases, or job-runner internals directly.
- [ ] 6.3 Replace `package/admin/src/home/components/HealthStrip.tsx` usage with `StatusOverviewCard` on the admin dashboard.
- [ ] 6.4 Add a full admin status detail route or detail section for service links, service health, Meili summary/navigation, Sequin/CDC/database, and queue status.
- [ ] 6.5 Ensure admin status indicators include non-color-only text or icon semantics for available, degraded, unavailable, and unknown states.
- [ ] 6.6 Use rezics/admin design tokens and compact admin density; avoid raw colors and duplicated page-section chrome.
- [ ] 6.7 Add Traditional Chinese UI copy for user-visible status labels and remediation summaries.
- [ ] 6.8 Add loading, empty, unavailable, and partial-error states for all major admin status sections.
- [ ] 6.9 Update `package/admin` TanStack route generation and admin navigation according to the chosen route.

## 7. Admin Meili Observability Split

- [ ] 7.1 Refactor the existing `package/admin/src/meili/pages/MeiliPage.tsx` so it is no longer one monolithic page for health, operations, dangerous actions, and key management.
- [ ] 7.2 Extract clearly named Meili operation sections/components for index initialization and full sync.
- [ ] 7.3 Extract a separate Meili danger-zone section/component for delete/reset actions and confirmations.
- [ ] 7.4 Extract a separate Meili key-management section/component.
- [ ] 7.5 Add a read-only Meili observability surface backed by `/meili/status` for expected schema, live index statistics, settings drift, content/index counts, and recent tasks.
- [ ] 7.6 Wire admin navigation/route structure so operators can reach Meili observability without mixing it into destructive controls.
- [ ] 7.7 Preserve existing Meili admin mutation behavior and confirmations while moving UI code.

## 8. Documentation and Operations

- [ ] 8.1 Update docs to point operators to the admin status surface, not a public app `/status` route.
- [x] 8.2 Document required non-secret status URL environment variables and local defaults.
- [ ] 8.3 Update job-runner operations docs to point operators from manual Sequin/CDC checks to the admin status surface where applicable.
- [ ] 8.4 Document which status checks are read-only and which existing Meili operations remain destructive in the admin UI.
- [x] 8.5 Add rollout notes for environments without Sequin or job-runner enabled.

## 9. Validation

- [ ] 9.1 Run targeted `bun test` suites for `package/search`, `package/server`, `package/api`, and affected `package/admin` modules.
- [ ] 9.2 Run `bun run check:convention` and fix any feature-boundary or import convention issues.
- [ ] 9.3 Run `bun run format:check` or format changed files with Biome.
- [ ] 9.4 Verify TypeScript builds for affected packages, including `@rezics/admin`.
- [ ] 9.5 Manually verify the admin status surface after starting the relevant dev services, including a degraded dependency case.
- [ ] 9.6 Verify the public app no longer exposes or queries internal diagnostics.

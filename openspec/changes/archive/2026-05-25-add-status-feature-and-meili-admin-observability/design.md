## Context

Rezics currently has several operational surfaces:

- `@rezics/server` exposes public Meili search endpoints and root-only Meili
  init/sync/delete/key operations under `/meili`.
- `@rezics/search` owns the concrete Meilisearch index initialization logic in
  `SearchClient`, but expected index metadata is not exported as a status
  contract.
- `@rezics/job-runner` exposes `/health`, `/ready`, Sequin webhook handling,
  and minimal queue admin APIs for queue counts and failed job operations.
- `@rezics/admin` is the dedicated admin SPA. It already owns the admin
  dashboard, admin navigation, auth status pages, and a large Meili operations
  page under `package/admin/src/meili/pages/MeiliPage.tsx`.
- `package/job-runner/docs/operations.md` documents Sequin, source database
  replication prerequisites, publication/slot checks, and rollback steps, but
  these checks are not available as a product status surface.
- `package/app/src/home` owns the public home page and must not be renamed or
  made responsible for operational diagnostics. A prior implementation placed a
  status route and overview card in `package/app`; that placement is incorrect
  for this change and must be removed.

External references reinforce the intended scope:

- Meilisearch exposes first-class health, stats, index, settings, version, and
  task APIs that can support read-only observability without direct database
  inference.
- Sequin's Postgres CDC model depends on database support checks such as
  logical replication, publications, replication slots, sink health, and
  delivery lag.
- Mature admin/status surfaces keep service health, database health, queue
  state, version/update notices, and maintenance actions visible but separate
  from public user-facing pages.

## Goals / Non-Goals

**Goals:**

- Introduce admin status/observability UI in `package/admin`.
- Replace the current admin dashboard `HealthStrip` with a richer
  `StatusOverviewCard` that summarizes the system status API.
- Preserve the public app home route and feature as-is; public app home must
  not consume status components or trigger status API calls.
- Split the existing admin Meili page so Meili operations, Meili
  observability, and any index/search utilities have clear page/component
  boundaries instead of living in a single oversized `MeiliPage`.
- Centralize Meili expected schema metadata so runtime initialization and
  observability compare against the same definitions.
- Provide read-only status aggregation for Rezics services, databases, queues,
  Meili, and Sequin CDC support.
- Expose safe typed API clients and query hooks in `@rezics/api`.
- Keep admin/status UI compact, token-driven, and aligned with rezics admin
  density rules.

**Non-Goals:**

- Building a new general-purpose admin console separate from `@rezics/admin`.
- Replacing Meilisearch's own dashboard or Sequin's console.
- Renaming `home`, moving the `/` route, or changing public home composition.
- Adding a public app `/status` route, public footer status link, or public app
  home status widget.
- Changing public search result contracts.
- Automating destructive CDC repair such as dropping publications or
  replication slots.
- Making status data public unless a later spec introduces a public status page.

## Decisions

### Decision: Split Meili observability from system status

`meili-admin-observability` owns Meili-specific schema, index, stats, drift, and
task behavior. `system-status-feature` owns cross-service status aggregation,
URLs, admin dashboard composition, and status-detail navigation.

This keeps Meili details usable outside the status page, for example in future
admin tooling or CLI diagnostics, while the status feature remains a consumer of
multiple status sources.

Alternative considered: put all behavior under a single `status` capability.
That would make the status page easier to describe but would bury reusable Meili
contracts inside a UI-oriented feature.

### Decision: Expected Meili schema lives in `package/search`

The expected schema should be exported from `@rezics/search` as structured
metadata for each known index:

- `uid`
- `primaryKey`
- `searchableAttributes`
- `filterableAttributes`
- `sortableAttributes`
- optional `facetableSummaryFields`
- optional `supportsFullSync`
- optional `description` or `domain`

Index initialization should consume this metadata instead of maintaining a
separate hand-written settings list. Status APIs should compare live Meili
settings against the same metadata.

Alternative considered: define expected schema only in `@rezics/contract`.
That would make the data shareable, but it would separate operational truth from
the package that actually initializes and syncs indexes.

### Decision: Status aggregation runs server-side

`@rezics/server` should expose root/admin-only status endpoints that aggregate
safe diagnostics:

- own `/health`-style service state
- auth service reachability if configured
- job-runner `/health`, `/ready`, queue counts, and failed job summaries
- source/auth database checks
- Meili health/schema/index/task summaries
- Sequin UI/health URL status and source database CDC support checks

The frontend should not call Meili, Sequin, databases, or job-runner internal
admin endpoints directly. The server shields secrets, normalizes failures, and
keeps response shapes typed.

Alternative considered: let `package/app` call every service independently.
That would leak topology details into the browser and make authorization and
failure normalization harder.

### Decision: Status responses distinguish availability, support, and drift

Each status item should carry a machine status and human-readable reason:

- `available`: reachable and healthy
- `degraded`: reachable but has warnings such as failed tasks or drift
- `unavailable`: unreachable or failing health checks
- `unknown`: not configured or not enough data

Database/CDC checks should distinguish "service is running" from "database
supports the required shape". For example, Sequin can be reachable while
`wal_level` or the publication table list is wrong.

Alternative considered: boolean health only. Boolean checks are easy to render
but cannot guide remediation.

### Decision: Sequin URL output is configuration, not discovery

The status page should show configured URLs for Sequin UI, Sequin health,
Meilisearch, job-runner, server, auth, and app. These values should be explicit
environment/config values and should not include tokens, passwords, or internal
database URLs.

Alternative considered: infer URLs from private connection strings or Docker
compose files. That would be fragile and risks exposing sensitive values.

### Decision: Admin owns the status UI, not the public app

The status UI should live in `package/admin`, because Rezics already has a
dedicated admin SPA for operational management and system monitoring. The public
app must not expose a `/status` route, footer link, home widget, or
`package/app/src/diagnostic` status feature for this change.

The admin implementation should provide:

- a compact `StatusOverviewCard` rendered from the admin home/dashboard
- a system status detail page or section for service links, service health,
  Sequin/CDC/database checks, queue state, and cross-service summaries
- Meili observability components that can be composed inside the admin Meili
  area without being coupled to destructive Meili operations

Alternative considered: keep the current `package/app/src/diagnostic`
implementation and hide it behind route guards. That still creates a public-app
route/entry surface, causes public app pages to carry admin diagnostics code,
and can trigger status API calls from the wrong application.

### Decision: Split the admin Meili area before adding observability

The existing `package/admin/src/meili/pages/MeiliPage.tsx` combines health,
index initialization, full sync, destructive delete/reset actions, and key
management. Adding schema drift, live stats, counts, and recent task visibility
to that same page would make it harder to scan and harder to guard risky
actions.

The admin Meili area should be split before observability is added. A practical
target shape is:

- `MeiliOverviewPage` or `MeiliPage` as a thin route/page shell
- `MeiliOperationsSection` for init/sync actions
- `MeiliDangerZoneSection` for delete/reset actions and confirmations
- `MeiliKeyManagementSection` for key creation/list/delete
- `MeiliObservabilityPage` or `MeiliObservabilitySection` for schema/index/task
  status backed by `/meili/status`

The exact file names may follow the admin package's local conventions, but the
result should avoid one monolithic page that mixes read-only observability with
destructive operations.

### Decision: Dangerous operations stay out of the first status page

The initial status page may link to existing safe operations and show action
state, but destructive operations such as reset-all indexes, delete-all indexes,
or publication/slot recreation should remain outside the first status surface or
behind explicit root-only confirmations in a later change.

Alternative considered: make the status page a full repair console. That raises
blast radius before the observability model is proven.

## Risks / Trade-offs

- [Status checks become slow] → Use bounded timeouts, parallel aggregation, and
  partial results so one failing dependency does not block the page.
- [Meili expected/live drift comparison is noisy] → Compare normalized sets for
  known settings first and report unknown extra settings as warnings, not hard
  failures.
- [Database diagnostics expose sensitive information] → Return only safe names,
  statuses, counts, and links; never return connection strings, passwords, API
  keys, or raw env dumps.
- [Local environments lack Sequin or job-runner] → Represent missing optional
  URLs as `unknown` or `not_configured` with remediation text rather than
  failing the whole page.
- [Status page encourages manual repair too early] → Start with read-only
  diagnostics and route existing risky operations through existing guarded
  admin endpoints.
- [Admin dashboard becomes visually cluttered] → Replace the existing simple
  `HealthStrip` with a compact status overview instead of adding another
  dashboard strip beside it.
- [Meili page becomes unmaintainable] → Split the current Meili page into
  focused components/pages before adding observability details.
- [Public app accidentally exposes internal diagnostics] → Remove the app
  route, footer link, home card, and diagnostic feature from this change.

## Rollout Plan

1. Add shared Meili expected index metadata and refactor index initialization to
   consume it without changing public search behavior.
2. Add server-side Meili observability APIs and typed `@rezics/api` clients.
3. Add system status aggregation APIs for services, URLs, queues, databases,
   and CDC support checks.
4. Remove the erroneous public-app status route, footer link, home card, and
   `package/app/src/diagnostic` implementation.
5. Add admin status UI in `package/admin`: replace the dashboard health strip
   with `StatusOverviewCard` and add a detail route/section for the system
   status summary.
6. Split the admin Meili page into focused operation/key/danger/observability
   sections or routes, then render Meili schema/index/task observability from
   `/meili/status`.
7. Verify with unit tests for schema/drift aggregation and focused admin
   component tests for overview/status/Meili rendering.

Rollback is low-risk because the change is additive. If a status check causes
runtime issues, disable the affected query path or mark the dependency
`unknown` while preserving existing search, home, and job-runner behavior.

## Resolved Questions

- The status frontend belongs in `package/admin`, not `package/app`.
- The public app must not expose a `/status` route or render a status overview
  card from home/footer.
- The first admin dashboard integration should replace the existing
  `HealthStrip` instead of adding a second summary widget.

## Open Questions

- Which admin route should host the system detail page: `/status`, `/system`,
  or a nested dashboard route?
- Should Meili observability be a child route such as `/meili/observability` or
  a tab/section inside `/meili` after the page is split?
- Which auth service health endpoint should be considered canonical for the
  status page?

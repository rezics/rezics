## Context

Rezics currently has several operational surfaces:

- `@rezics/server` exposes public Meili search endpoints and root-only Meili
  init/sync/delete/key operations under `/meili`.
- `@rezics/search` owns the concrete Meilisearch index initialization logic in
  `SearchClient`, but expected index metadata is not exported as a status
  contract.
- `@rezics/job-runner` exposes `/health`, `/ready`, Sequin webhook handling,
  and minimal queue admin APIs for queue counts and failed job operations.
- `package/job-runner/docs/operations.md` documents Sequin, source database
  replication prerequisites, publication/slot checks, and rollback steps, but
  these checks are not available as a product status surface.
- `package/app/src/home` owns the public home page and must not be renamed or
  made responsible for operational diagnostics.

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

- Introduce a `status` frontend feature that owns the status page and reusable
  overview card.
- Preserve the current home route and feature as-is; home may consume a status
  overview component but does not own status logic.
- Centralize Meili expected schema metadata so runtime initialization and
  observability compare against the same definitions.
- Provide read-only status aggregation for Rezics services, databases, queues,
  Meili, and Sequin CDC support.
- Expose safe typed API clients and query hooks in `@rezics/api`.
- Keep admin/status UI compact, token-driven, and aligned with rezics admin
  density rules.

**Non-Goals:**

- Building a general-purpose admin console.
- Replacing Meilisearch's own dashboard or Sequin's console.
- Renaming `home`, moving the `/` route, or changing public home composition.
- Changing public search result contracts.
- Automating destructive CDC repair such as dropping publications or
  replication slots.
- Making status data public unless a later spec introduces a public status page.

## Decisions

### Decision: Split Meili observability from system status

`meili-admin-observability` owns Meili-specific schema, index, stats, drift, and
task behavior. `system-status-feature` owns cross-service status aggregation,
URLs, page composition, and overview-card navigation.

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

### Decision: The `status` feature exports an overview card

The status UI should live in the singular `package/app/src/diagnostic` feature
folder to satisfy the repo folder convention while keeping the public route and
component names status-oriented. It should export:

- `StatusPage`
- `StatusOverviewCard`

The overview card summarizes top-level state and navigates to the status route
when clicked. `home` can import the card from `@/diagnostic` without owning
status logic or status-specific API calls.

Alternative considered: place the card inside `home`. That would couple an
operational widget to the public home feature and make later dashboard reuse
harder.

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
- [Home becomes visually cluttered] → Keep `StatusOverviewCard` compact and
  optional; do not turn the home page into an admin dashboard.

## Rollout Plan

1. Add shared Meili expected index metadata and refactor index initialization to
   consume it without changing public search behavior.
2. Add server-side Meili observability APIs and typed `@rezics/api` clients.
3. Add system status aggregation APIs for services, URLs, queues, databases,
   and CDC support checks.
4. Add the `status` frontend feature, route, and overview card.
5. Optionally place the overview card in a suitable existing surface without
   renaming or moving `home`.
6. Verify with unit tests for schema/drift aggregation and focused component
   tests for overview/status rendering.

Rollback is low-risk because the change is additive. If a status check causes
runtime issues, disable the affected query path or mark the dependency
`unknown` while preserving existing search, home, and job-runner behavior.

## Open Questions

- Should the first status route be `/status` guarded by root/admin, or
  `/admin/status` to make the internal nature explicit in the path?
- Which auth service health endpoint should be considered canonical for the
  status page?
- Should the first home integration render the overview card by default, or
  should it be limited to root/admin users only?

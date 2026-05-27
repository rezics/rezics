## Why

`package/admin` already contains auth, JWT service, Meili, status, unit, entity, realm, shelf, source-site, and user routes, but it is still a collection of admin pages rather than a mature operations panel. Rezics needs a complete operator console for data integrity, observability, auth/user operations, search/index repair, content administration, and governance oversight while leaving product-side community moderation in `package/app`.

## What Changes

- Define `package/admin` as the root/admin operations panel for platform operators, not a duplicate of the public app and not the realm moderator console.
- Add a coherent admin shell, dashboard, navigation, permissions, audit-aware destructive actions, compact density, and consistent tables/forms/state handling.
- Complete content and data administration for Units, books, media/games, entities, shelves, tags, realms, source-site attribution, work/release domains, history, and search projection repair.
- Complete auth/account operations across auth-server users, main-server users, sessions, bans, roles, JWT services, tokens, impersonation controls, and audit links.
- Add observability and repair surfaces for Meilisearch, job-runner queues, Sequin/CDC, history outbox, sync drift, seed/dev fixtures, and system status.
- Integrate governance oversight from `complete-platform-authorization` as operator-level visibility and override tools, not day-to-day realm moderation.
- Do not depend on `introduce-api-unit-store`; use existing admin API clients, `@rezics/contract`, `@rezics/api`, and package-specific admin domains.

## Capabilities

### New Capabilities

- `admin-operations-shell`: Complete admin layout, dashboard, navigation, access model, density, and state patterns.
- `admin-content-operations`: Cross-domain content/unit/entity/tag/shelf/realm/work/release management and repair.
- `admin-account-operations`: Auth and main-user account operations, roles, sessions, bans, tokens, and impersonation controls.
- `admin-data-integrity-operations`: Search, history, work-domain, attribution, slug, and projection drift detection/repair.
- `admin-observability-operations`: System status, jobs, queues, CDC, Meili, sync, and operator diagnostics.
- `admin-governance-oversight`: Operator oversight of moderation cases, enforcement, audit, and policy exceptions.

### Modified Capabilities

- `admin-auth-pages`: Auth pages become part of the account operations area.
- `system-status-feature`: Status becomes one panel in a broader operations dashboard.
- `meili-admin-observability`: Meili observability links to repair and drift workflows.
- `entity-admin-page`: Entity admin participates in generic content operations.
- `admin-auth-jwt-service-ui`: JWT service management participates in account/platform security operations.
- `auth-jwt-service-admin-api`: JWT service APIs expose operator-safe summaries for the admin panel.

## Impact

- Affected packages: `package/admin`, `package/api`, `package/contract`, `package/server`, `package/auth`, `package/search`, `package/job-runner`, and seed/story fixtures.
- UI impact: admin uses compact operations density per `rezics-design`, `@rezics/ui/shadcn` primitives, consistent table/filter/bulk-action patterns, and safe destructive confirmations.
- API impact: add typed admin endpoints/clients for operations summaries, repair jobs, audit summaries, drift checks, bulk content actions, and cross-service diagnostics.
- Migration/backward compatibility: existing admin routes remain but are grouped/renamed as needed in a development-stage cutover; public app and realm moderator routes do not move into admin.

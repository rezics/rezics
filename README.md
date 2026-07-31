# REZICS

_inherited · create · spread_

REZICS is a community-driven, cross-language knowledge network for works. Communities form
around shared interests, classify and discuss the works they care about, and
keep a work's index, discussion, and collective knowledge together.

Everything — books, games, media, posts, shelves, tags, and realms — is modeled
as a unified `Unit`, allowing the same identity, classification, attribution, and
social layers to work across content types and languages.

## Repository structure

```text
apps/
├─ web/                              # Main Vinext/React application
└─ about/                            # Static multilingual Astro site

services/
└─ main/                             # Elysia/srvx API and background worker

libraries/
├─ email/                            # Internal email templates and rendering
├─ i18n/                             # Internal localization library
├─ portable-text/                    # Internal Portable Text contracts
├─ ui/                               # Internal shared UI
└─ services/main/
   ├─ openapi/                       # Main-service API contract
   ├─ openapi-fetch/                 # Generated Fetch client
   └─ openapi-tanstack-query/        # Generated TanStack Query client

packages/
└─ brand/                            # Public @rezics/brand package
```

`apps/` and `services/` contain deployable units. `libraries/` contains private
workspace libraries. `packages/` contains externally consumable packages and
must not depend on private libraries, applications, or services.

## Development

The root workspace uses Node.js 26, Yarn 4, Bun, Go Task 3, Docker Compose, and
Aspire 13.4.6. Compose owns persistent vanilla PostgreSQL 18, RustFS, Meilisearch,
and Sequin PostgreSQL/Valkey resources. Aspire owns the API, recommendation worker,
web development server, and Dashboard. Use the repository's pinned
devenv/direnv environment or provide Aspire 13.4.6, Yarn 4.17.1, Go Task 3, and
Bun 1.3.11 or newer locally.

```sh
yarn install --immutable
task local:setup
task dev
```

`local:setup` is the explicit first-run/configuration workflow. It starts the
persistent Compose infrastructure, initializes RustFS, applies migrations,
prepares the current index generation, reapplies the reviewed Sequin
configuration, verifies its backfill, promotes the generation, and fills
missing bootstrap records. It is safe to rerun for a healthy unchanged
generation after pulling migrations or bootstrap-manifest changes. Named
volumes preserve PostgreSQL, RustFS, Meilisearch, Sequin PostgreSQL, and Valkey
data independently from the Aspire AppHost.

`dev` ensures Compose infrastructure is healthy, prepares the database, starts
the existing Sequin container without forcing recreation, and performs a
bounded read-only check of the active search generation. It does not rebuild or
promote search data. It then starts the Bun API and recommendation worker,
Vinext web app, and Aspire Dashboard in the foreground. The stable development endpoints are web
`http://localhost:3000`, API `http://localhost:3001`, PostgreSQL
`localhost:5432`, RustFS `http://localhost:9000`, Meilisearch
`http://localhost:7700`, and Sequin `http://localhost:7376`. Aspire still injects
endpoint references between application processes. Stop only the application
processes with Ctrl+C or `task dev:stop`; use `task infra:stop` when the shared
infrastructure should also stop. Aspire remains a local-development control
plane and does not generate or replace the production Nomad deployment.

`task dev:search` remains an alias for the default search-capable topology. Use
`task infra:status` for persistent infrastructure,
`task aspire:doctor` for prerequisite diagnostics, and `task aspire:describe`
for machine-readable application state. The static `apps/about` site remains
independent from the AppHost.

The API exposes startup at `GET /api/startup`, dependency-free liveness at
`GET/HEAD /api/health`, and traffic readiness at `GET /api/ready`. PostgreSQL is
readiness-required; storage and recommendation freshness are reported as
degraded without taking the core API out of service. The recommendation worker
owns a scheduler-only health listener with `/startup`, `/health`, and `/ready`;
it is not a public service endpoint. Aspire and CI consume the paths and timing policy from
`services/main/src/health-contract.ts`. Production Nomad jobs consume that
machine-checkable contract when Plan 6 introduces the deployment artifacts.

Local email defaults to non-delivering `log` mode. Account verification and
password recovery are the only enabled outbound email purposes; activity and
notification email remains product-gated off. See
[Email delivery and local testing](./docs/email-delivery.md) before enabling
real Cloudflare delivery from a development machine.

Infrastructure lifecycle commands are `task infra:start`, `task infra:up`,
`task infra:stop`, `task infra:down`, and `task infra:logs`. `infra:start` only
starts persistent services; `infra:up` additionally performs the idempotent
RustFS bucket initialization. `task infra:reset` intentionally deletes all
local PostgreSQL, RustFS, Meilisearch, and Sequin state before rebuilding a
consistent default database and search generation; it requires confirmation.
Use `task --yes local:reset` to reset and seed only the application database
while coordinating Sequin and rebuilding search. Use
`task --yes local:search:rebuild` to repair a stale local current index without
resetting PostgreSQL. Both rebuild workflows are destructive, explicit, and
restricted to loopback service endpoints.

The main checks are:

```sh
task format:check
task openapi:check
task typecheck
task test
task apps-web:build
task apps-about:build
task apps-about:test:dist
```

OpenAPI documents and generated clients are updated through
`task openapi:generate` and should not be edited by hand.
`libraries/ui` contains both local components and the tracked SharkUI mirror;
preserve that upstream boundary.

### Database migrations

The Drizzle TypeScript schema is the desired state. Atlas owns the versioned
SQL migration directory, per-file transactions, checksums, and application
history. The Atlas CLI is pinned through `@ariga/atlas`; its installer is the
only dependency build script explicitly enabled by the root `dependenciesMeta`
configuration. A small exporter uses Drizzle Kit's programmatic API so Atlas
always receives the complete schema instead of the CLI's size-limited output.

```sh
# Change the Drizzle schema first, then generate and review SQL.
task services-main:db:generate -- add_example

# Recompute atlas.sum after an intentional manual SQL edit.
task services-main:db:hash

# Replay the v1 baseline plus later migrations and verify the result.
task db:check

# Inspect or apply pending migrations with the owner connection.
task services-main:db:migrate:dry-run
task services-main:db:migrate
task services-main:db:status

# Fill missing required records without changing existing credentials.
task services-main:db:bootstrap

# Explicitly replace all bootstrap Profile passwords and print the replacements.
task services-main:db:bootstrap:credentials:overwrite
```

The machine-generated v1 baseline is the first migration. Its durable
functions and triggers live in that same file after their table dependencies,
with triggers created after their functions. Later functions, triggers,
extensions, and data backfills remain explicit SQL migrations. Atlas excludes
functions, triggers, and extensions from automatic Drizzle diff ownership so
it does not delete those manually managed objects.
The isolated migration database is vanilla PostgreSQL 18 with logical replication enabled.
Every manual migration edit must be followed by `db:hash`.

`task db:check` owns the correctness workflow: it validates the migration
checksum, replays the v1 baseline and every later migration in an isolated vanilla PostgreSQL 18
database, and verifies that the result matches the Drizzle schema. CI runs this
check for every pull request and main-branch push. It is intentionally separate
from `dev` and from the target-database `db:migrate` operation.

`db:prepare` is the reusable one-off administration workflow for a target
database. It applies pending migrations, reconciles application-role
privileges, and fills missing bootstrap records. Normal bootstrap never changes
an existing bootstrap Profile password. Credential replacement is available
only through the separately confirmed
`db:bootstrap:credentials:overwrite` task.

Bootstrap and Seed are separate database services with different safety
contracts. Bootstrap owns production-safe, idempotent system invariants:
fixed identities and namespaces, official Realms and Zones, official Zone
search documents, default API-token policies, navigation, and required media.
It may run repeatedly against an existing database. Seed owns disposable
development scenarios and refuses to run when non-Bootstrap data already
exists.

```sh
# Reproducible demo data without communication or governance cases.
task services-main:db:seed -- --profile demo

# Complete CI/development contract, including communication and governance.
task services-main:db:seed -- --profile coverage

# Read-only postcondition checks; accepts the same profile and clock flags.
task services-main:db:seed:check -- --profile coverage
```

Both profiles use the fixed reference time `2026-07-15T12:00:00.000Z` unless
`--reference-time` is supplied. The Seed task creates authoritative facts,
then rebuilds localization metrics, recommendation snapshots, and aggregate
projections before running its verifier. Use the confirmed root
`task --yes local:reset` workflow when replacing existing disposable data; it
also coordinates the external search projection. CI runs `task seed:contract`
against fresh infrastructure, including a full external-index rebuild and
zone-scoped lookup of each official workspace fixture.

Production deployments must run the same validation and migration commands as
a single pre-deploy job before rolling out API or worker replicas. Only that job
receives `DATABASE_ADMIN_URL`; runtime services receive the narrower
`DATABASE_URL`. Do not run migrations independently in every application
replica.

Atlas workflow references: [versioned migration diff][atlas-diff],
[migration apply and transaction behavior][atlas-apply], and
[adopting an existing database with a baseline][atlas-import].

[atlas-diff]: https://atlasgo.io/versioned/diff
[atlas-apply]: https://atlasgo.io/versioned/apply
[atlas-import]: https://atlasgo.io/versioned/import

The about site is deployed independently to Cloudflare Pages from the
`v*` release tag or a manual workflow dispatch.

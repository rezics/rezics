# REZICS

_inherited · create · spread_

REZICS is a community-driven, cross-language knowledge network for works. Communities form
around shared interests, classify and discuss the works they care about, and
keep a work's index, discussion, and collective knowledge together.

REZICS uses Romantic Versioning (RomVer), `PROJECT.MAJOR.MINOR`; see
[Contributing](./CONTRIBUTING.md#versioning) for the release policy.

Everything — books, games, media, posts, shelves, tags, and realms — is modeled
as a unified `Unit`, allowing the same identity, classification, attribution, and
social layers to work across content types and languages.

## Repository structure

```text
apps/
├─ web/                              # Main Vinext/React application
├─ about/                            # Static multilingual Astro site
└─ markdown/                         # Local-first Tauri/Web Markdown editor

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
├─ api/                              # Public @rezics/api client
├─ brand/                            # Public @rezics/brand package
└─ editor/                           # Public editor and REZICS Markdown capabilities
```

`apps/` and `services/` contain deployable units. `libraries/` contains private
workspace libraries. `packages/` contains externally consumable packages and
must not depend on private libraries, applications, or services.

## Development

The root workspace uses Node.js 26, Yarn 4, Bun, Go Task 3, Docker Compose, and
Aspire 13.4.6. Compose owns persistent PostgreSQL 18.4 with PGroonga and RustFS.
Aspire owns the API, recommendation worker,
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
installs the factory platform bundle when no installation exists, and verifies the
authoritative PGroonga indexes. On an installed database it verifies
only permanent platform identities and never reconciles product-owned content.
It is safe to rerun for a healthy unchanged database. Named volumes preserve PostgreSQL and
RustFS data independently from the Aspire AppHost.

`dev` ensures Compose infrastructure is healthy, prepares the database, and performs a
bounded read-only check of the required database extensions and PGroonga indexes. It then starts the Bun API and recommendation worker,
Vinext web app, and Aspire Dashboard in the foreground. The stable development endpoints are web
`http://localhost:3000`, API `http://localhost:3001`, PostgreSQL
`localhost:5432` and RustFS `http://localhost:9000`. Aspire still injects
endpoint references between application processes. Stop only the application
processes with Ctrl+C or `task dev:stop`; use `task infra:stop` when the shared
infrastructure should also stop. Aspire remains a local-development control
plane and does not generate or replace the production Nomad deployment.

Use `task infra:status` for persistent infrastructure,
`task aspire:doctor` for prerequisite diagnostics, and `task aspire:describe`
for machine-readable application state. The static `apps/about` site and the
local-first `apps/markdown` desktop/Web editor remain independent from the
AppHost; run the latter explicitly with `task apps-markdown:dev` or
`task apps-markdown:dev:web`.

The API exposes startup at `GET /api/v1/startup`, dependency-free liveness at
`GET/HEAD /api/v1/health`, and traffic readiness at `GET /api/v1/ready`. PostgreSQL is
readiness-required; storage and recommendation freshness are reported as
degraded without taking the core API out of service. The recommendation worker
owns a scheduler-only health listener with `/startup`, `/health`, and `/ready`;
it is not a public service endpoint. Aspire and CI consume the paths and timing policy from
`services/main/src/health-contract.ts`. The production Nomad jobs mirror that
contract for rollout gating and process restarts.

Local email defaults to non-delivering `log` mode. Account verification and
password recovery are the only enabled outbound email purposes; activity and
notification email remains product-gated off. See
[Email delivery and local testing](./docs/email-delivery.md) before enabling
real Cloudflare delivery from a development machine.

Infrastructure lifecycle commands are `task infra:start`, `task infra:up`,
`task infra:stop`, `task infra:down`, and `task infra:logs`. `infra:start` only
starts persistent services; `infra:up` additionally performs the idempotent
RustFS bucket initialization. `task infra:reset` intentionally deletes all
local PostgreSQL and RustFS state before rebuilding a consistent default database; it requires
confirmation. Use `task --yes local:reset` to reset and seed only the application database. Use
`task --yes local:search:rebuild` to rebuild the authoritative PGroonga indexes without resetting
PostgreSQL.

The main checks are:

```sh
task format:check
task openapi:check
task typecheck
task test
task apps-web:build
task apps-about:build
task apps-about:test:dist
task packages-editor:build
task apps-markdown:check
task apps-markdown:build:web
task apps-markdown:build
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

# Explicit one-time installation for an empty target database.
task services-main:db:install -- --yes

# Read-only verification used by recurring deployments.
task services-main:platform:verify

# Explicitly rotate all platform Profile passwords and print the replacements.
task services-main:platform:credentials:rotate
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

`db:install` is the explicit first-installation workflow for an empty target
database. It applies pending migrations, reconciles application-role
privileges, installs the Git-versioned Bootstrap bundle, and issues the initial
platform Profile credentials. It never creates mutable Platform Infrastructure
such as Rule revisions. Production creates and evolves that data exclusively
through authenticated administration APIs. Installation refuses an already
installed or occupied database unless local setup deliberately supplies
`--if-needed`.

`db:prepare` is the recurring pre-deploy administration workflow. It applies
pending migrations, reconciles application-role privileges, and then performs
a read-only verification of permanent platform Unit, Auth User, and Account
identities. It never compares or rewrites live localization, theme, Search,
navigation, Dock, access-policy, or other product-owned state. Core verification
failure stops deployment for explicit operator repair. Credential rotation is
available only through the separately confirmed
`platform:credentials:rotate` task.

Bootstrap Installation, Platform Infrastructure Seed, and Fixture Seed have
separate safety contracts. Installation copies the fixed Profiles, Realms,
Zones, content, policies, navigation, and required media exactly once. The
local/CI-only Platform Infrastructure Seed then supplies official Rules needed
by disposable scenarios; production never runs it. Fixture Seed first proves
that no non-Bootstrap data exists, then runs every infrastructure provider and
Fixture scenario in one transaction. Each infrastructure provider inspects
only its own domain and ignores unrelated Units.

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
also rebuilds the authoritative PostgreSQL schema and its PGroonga indexes. CI runs
`task seed:contract` against fresh infrastructure, including PGroonga health and
zone-scoped lookup of each official workspace fixture.

Production environments require one private, operator-confirmed `db:install`
before their first application rollout. A stable application tag runs the
database release job only when database inputs changed; that job completes
preflight, migration, privilege reconciliation, and verification before API or
worker rollout. Only database and maintenance jobs receive
`DATABASE_ADMIN_URL`; runtime services receive the narrower `DATABASE_URL`.
Do not run migrations independently in every application replica.

Atlas workflow references: [versioned migration diff][atlas-diff],
[migration apply and transaction behavior][atlas-apply], and
[adopting an existing database with a baseline][atlas-import].

[atlas-diff]: https://atlasgo.io/versioned/diff
[atlas-apply]: https://atlasgo.io/versioned/apply
[atlas-import]: https://atlasgo.io/versioned/import

The about site is deployed independently to Cloudflare Pages from the
`about/v*` release tag or a manual workflow dispatch. Its deployment uses the
shared `production` GitHub environment, while its workflow and release trigger
remain separate; platform `v*` tags never deploy About.
The main Vinext site deploys to Cloudflare Workers from its separate `web/v*`
or manual GitHub workflow; the API, background worker, and PostgreSQL run on
Nomad; production object storage and dedicated PostgreSQL logical backups use
separate private Cloudflare R2 buckets. See [Production deployment](./docs/operations/production-deployment.md)
for first installation, release, secret, and rollback procedures.

## License

Except where otherwise noted, REZICS is licensed under the
[GNU Affero General Public License v3.0 only](./LICENSE) (`AGPL-3.0-only`).
Copyright © 2026 Rezics Inc.

Third-party components remain under their respective terms; see
[Third-party notices](./THIRD_PARTY_NOTICES.md). The AGPL grants copyright
permissions only and does not grant trademark rights in the REZICS name,
logos, or other brand identifiers.

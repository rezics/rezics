# REZICS

_inherited · create · spread_

REZICS is a community-driven, cross-language catalog of works. Communities form
around shared interests, classify and discuss the works they care about, and
keep a work's index, discussion, and collective knowledge together.

Everything — books, games, media, posts, shelves, tags, and realms — is modeled
as a unified `Unit`, allowing the same catalog, classification, attribution, and
social layers to work across content types and languages.

## Repository structure

```text
apps/
├─ web/                              # Main Vinext/React application
└─ about/                            # Static multilingual Astro site

services/
└─ main/                             # Elysia/srvx API and recommendation worker

libraries/
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

The root workspace uses Node.js 26, Yarn 4, Bun, Go Task, and Aspire 13.4.6.
Aspire owns the local PostgreSQL 18 + PGroonga and S3-compatible object-storage
resources. Use the repository's pinned devenv/direnv environment or provide
Aspire 13.4.6, Yarn 4.17.1, and Bun 1.3.11 or newer locally.

```sh
yarn install --immutable
yarn task local:setup
yarn task dev
```

`local:setup` owns local infrastructure and one-off database preparation. It is
safe to rerun after pulling migrations or bootstrap-manifest changes. It starts
an Aspire setup-only topology, applies pending migrations, initializes the
RustFS bucket, fills missing bootstrap records, prints the database preparation
logs, and then stops every session resource. Named container volumes preserve
the PostgreSQL and RustFS data.

`dev` starts the complete Aspire topology in the foreground: PostgreSQL,
RustFS, database/bucket preparation, the Bun API and recommendation worker, the
Vinext web app, and the Aspire Dashboard. Aspire allocates service ports and
injects endpoint configuration, so application code does not depend on fixed
localhost ports. Stop it with Ctrl+C or `yarn task dev:stop` for a detached
or separately controlled instance. Aspire is a local-development control plane;
it does not generate or replace the production Nomad deployment.

Use `yarn task dev:search` to add the opt-in Meilisearch resource. It is not
part of the default graph until the versioned indexing lifecycle is
implemented. Use `yarn task aspire:doctor` for prerequisite diagnostics and
`yarn task aspire:describe` for machine-readable resource state. The static
`apps/about` site remains independent from the AppHost.

The main checks are:

```sh
yarn task format:check
yarn task openapi:check
yarn task typecheck
yarn task test
yarn task apps-web:build
yarn task apps-about:build
yarn task apps-about:test:dist
```

OpenAPI documents and generated clients are updated through
`yarn task openapi:generate` and should not be edited by hand.
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
yarn task services-main:db:generate -- add_example

# Recompute atlas.sum after an intentional manual SQL edit.
yarn task services-main:db:hash

# Replay the full history and verify it matches the Drizzle schema.
yarn task db:check

# Inspect or apply pending migrations with the owner connection.
yarn task services-main:db:migrate:dry-run
yarn task services-main:db:migrate
yarn task services-main:db:status

# Fill missing required records without changing existing credentials.
yarn task services-main:db:bootstrap

# Explicitly replace all official Profile passwords and print the replacements.
yarn task services-main:db:bootstrap:credentials:overwrite
```

Functions, triggers, extensions, and data backfills remain explicit SQL
migrations. Atlas excludes functions, triggers, and extensions from automatic
Drizzle diff ownership so it does not delete those manually managed objects.
The isolated dev database installs PGroonga as an infrastructure prerequisite.
Every manual migration edit must be followed by `db:hash`.

`yarn task db:check` owns the correctness workflow: it validates the migration
checksum, replays the full history in an isolated PostgreSQL 18 + PGroonga
database, and verifies that the result matches the Drizzle schema. CI runs this
check for every pull request and main-branch push. It is intentionally separate
from `dev` and from the target-database `db:migrate` operation.

`db:prepare` is the reusable one-off administration workflow for a target
database. It applies pending migrations, reconciles application-role
privileges, and fills missing bootstrap records. Normal bootstrap never changes
an existing official Profile password. Credential replacement is available
only through the separately confirmed
`db:bootstrap:credentials:overwrite` task.

Existing databases created by the previous Drizzle migrator need a one-time
baseline before their first Atlas-managed deployment. After taking a backup,
run
`ATLAS_BASELINE_VERSION=20260718154924 yarn task services-main:db:adopt-atlas`;
it records the last migration known to have committed under Drizzle and then
applies the remaining migrations. Requiring the exact version makes this
one-time path safe to automate without silently baselining the wrong state.
Fresh databases must use the normal `db:migrate` task and must not be baselined.

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
`about-v*` tag or a manual workflow dispatch.

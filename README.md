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

The root workspace uses Node.js 26, Yarn 4, Go Task, PostgreSQL 18 with
PGroonga, and S3-compatible object storage. Use the repository's devenv/direnv
environment or provide compatible tools locally.

```sh
yarn install --immutable
yarn task services:up
yarn task dev
```

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
```

Functions, triggers, extensions, and data backfills remain explicit SQL
migrations. Atlas excludes functions, triggers, and extensions from automatic
Drizzle diff ownership so it does not delete those manually managed objects.
The isolated dev database installs PGroonga as an infrastructure prerequisite.
Every manual migration edit must be followed by `db:hash`.

`yarn task dev` starts PostgreSQL, replays and validates the full migration
history in an isolated PostgreSQL 18 + PGroonga database, applies pending
migrations to the local database, reconciles application-role privileges, and
only then starts applications.

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

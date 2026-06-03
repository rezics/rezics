---
title: Migrate backend databases to Drizzle v1 rc
status: active
created: 2026-06-04
completed:
supersededBy:
tags: [database, drizzle, postgres, migration, server, auth, notify, reaction, history, ranking, tooling, deployment]
---

## Why

Rezics currently uses Prisma 7 for every schema-owning backend package:
`server`, `auth`, `notify`, `reaction`, `history`, and `ranking`. The main
server schema is already too large for a single ORM schema file, the migration
history has become noisy during pre-production iteration, and the codebase is
standardizing on PostgreSQL 18. This plan performs a clean development-stage
cutover to Drizzle v1 rc for **schema, migration management, and runtime query
access**.

The intended outcome after applying this proposal is complete: backend services,
seed/factory/search/history/ranking/job-runner integration points, deployment
migration jobs, docs, and repo tooling no longer depend on Prisma generated
clients or Prisma migrations. Old migrations are replaced by one Drizzle
baseline per schema-owning package, plus explicit custom SQL migrations where
Drizzle schema diff cannot own a database capability or special index.

Forward compatibility and data preservation are deliberately not constraints for
this plan. This is a development-stage hard cutover: local and pre-production
databases may be reset and reseeded.

## Durable constraints & decisions

- **Use the Drizzle v1 rc line, not `latest` 0.x.** At apply time verify npm
  dist-tags and pin exact `drizzle-orm` / `drizzle-kit` `1.0.0-rc.*` versions
  with no broad `^` range. Current registry state seen during proposal:
  `latest` is still 0.x; the v1 channel is exposed through rc/beta tags. `(type)`
- **Use current v1 relation/query syntax.** Do not write legacy Drizzle
  `relations(table, ...)` RQB v1 definitions. Use RQB v2
  `defineRelations` / `defineRelationsPart` and `db.query.<table>` shapes from
  the official v1 docs:
  https://orm.drizzle.team/docs/relations-v1-v2 and
  https://orm.drizzle.team/docs/rqb-v2. `(comment)` `(test)`
- **Schema can be multi-file and must export every model.** Drizzle Kit only sees
  exported tables/enums/sequences from the configured schema file/folder. Server
  must use a schema folder, not one giant file. Official reference:
  https://orm.drizzle.team/docs/sql-schema-declaration. `(comment)` `(test)`
- **Use Drizzle's current table callback style for new schema files.** Prefer
  imports from `drizzle-orm/pg-core` as `p` and the callback-style
  `pgTable` form shown in the official docs. Do not copy stale blog examples if
  they conflict with the official docs. `(comment)`
- **PostgreSQL 18 is required.** Migration preflight must reject databases where
  `server_version_num < 180000` or `uuidv7()` is unavailable. PostgreSQL 18
  documents `uuidv7()` as a built-in UUID generation function:
  https://www.postgresql.org/docs/18/functions-uuid.html. `(test)`
- **UUID primary keys default to native `uuidv7()`.** Do not use `uuid-ossp`,
  `pgcrypto`, `gen_random_uuid()`, Drizzle `defaultRandom()`, or application-side
  UUID generation for table IDs that are meant to be database-generated.
  PostgreSQL documents `uuid-ossp` as only needed beyond built-in UUID support:
  https://www.postgresql.org/docs/18/uuid-ossp.html. `(comment)` `(test)`
- **`ltree` remains an extension and is package-local to server.** Server must
  keep `CREATE EXTENSION IF NOT EXISTS ltree;` as an explicit pre/baseline
  migration before any `ltree` column or operator/index is created. PostgreSQL
  documents `ltree` as an extension module:
  https://www.postgresql.org/docs/18/ltree.html. `(comment)` `(test)`
- **Prefer Drizzle custom SQL migrations for pre SQL.** Drizzle Kit supports
  custom migrations via `drizzle-kit generate --custom`, and those migrations are
  applied by `drizzle-kit migrate`:
  https://orm.drizzle.team/docs/kit-custom-migrations. Use this for
  `ltree`, helper functions, partial indexes, special GiST/GIN indexes, and any
  baseline SQL Drizzle cannot model. `(comment)` `(test)`
- **Do not assume a Drizzle migration plugin hook.** Official Drizzle docs expose
  CLI migration, custom SQL migrations, config, and programmatic `migrate(db)`,
  but no plugin/hook API. If a hook is needed later, Rezics tooling owns the
  wrapper; do not invent undocumented Drizzle plugin behavior. `(comment)`
- **Preflight is separate from pre SQL.** Rezics `tool db migrate` should run
  read-only checks first: database reachable, PostgreSQL 18+, `uuidv7()`
  available, required extensions absent/present as expected, and package env URL
  sanity. Schema-mutating pre SQL should be Drizzle-tracked custom migrations
  unless a spike proves Drizzle's ordering is insufficient. `(test)`
- **No second migration ledger unless necessary.** Start with Drizzle's own
  migrations table and ordered custom SQL files. Add a Rezics-owned
  `__rezics_pre_migrations` ledger only if Drizzle custom migrations cannot
  safely express required pre-SQL ordering. `(comment)`
- **Squash old migrations into one baseline per schema owner.** Remove Prisma
  migration histories for `server`, `auth`, `notify`, `reaction`, `history`, and
  `ranking`; create Drizzle baseline migrations from the new schemas. Do not
  preserve `_prisma_migrations` or compatibility migration paths. `(test)`
- **`job-runner` does not become a Drizzle schema owner.** Its `pg-boss` database
  remains pg-boss-owned. Keep an ensure step for the queue database, but do not
  model pg-boss internal tables in Drizzle. `(comment)`
- **Prisma must be fully removed from backend runtime.** No `@prisma/client`,
  `@prisma/adapter-pg`, `prisma`, `prisma-json-types-generator`,
  `schema.prisma`, generated Prisma client imports, `Prisma.*` helper types, or
  Prisma error-code handling may remain in migrated backend packages. `(test)`
- **Type homes move to Drizzle schema and local model types.** Replace Prisma
  generated enums and payload types with exported Drizzle enums, table
  `$inferSelect` / `$inferInsert`, focused query result types, and contract
  mappers. Do not rebuild a generated-client facade that preserves Prisma-shaped
  APIs. `(type)`
- **Raw SQL is allowed but centralized.** `ltree` operations, aggregate-heavy
  queries, bulk CTEs, partial indexes, and array containment can use Drizzle
  `sql` helpers. Avoid ad hoc string concatenation; identifiers and values must
  go through typed helpers or parameterized SQL. `(comment)` `(test)`
- **Better Auth moves to the Drizzle adapter.** Replace
  `@better-auth/prisma-adapter` with `@better-auth/drizzle-adapter`, pass the
  auth Drizzle db and schema mapping, and keep `generateId: false` semantics so
  database `uuidv7()` remains authoritative. Official reference:
  https://better-auth.com/docs/adapters/drizzle. `(test)`
- **Search/history/ranking read the main DB through Drizzle, not generated
  server Prisma clients.** Cross-package consumers must import explicit db/schema
  surfaces from `@rezics/server`, not `@rezics/server/prisma/generated/client`.
  `(type)` `(test)`
- **Seeds and factory move with runtime.** The existing production-required seed
  and factory flows remain idempotent where they are currently idempotent, but
  their storage access moves from Prisma to Drizzle. Keep the seed/factory
  boundary documented in CONTRIBUTING. `(test)`
- **Deployment migration jobs use Drizzle commands.** `bin/deploy`, Docker
  migrate images, production docs, and troubleshooting docs must refer to
  Drizzle migration tables and `db:deploy`/`db:migrate`, not
  `prisma:deploy` or `_prisma_migrations`. `(comment)` `(test)`
- **CONTRIBUTING is authoritative for human workflow.** Add a database workflow
  section covering Drizzle v1 rc, custom pre SQL migrations, package order,
  reset behavior, and the rule that new DB capabilities/extensions must be
  documented as pre/custom migrations. `(comment)`
- **Clean cutover is allowed.** Internal renames and folder moves should update
  all internal callsites in the same change; no compatibility adapter layer is
  required unless it materially reduces apply risk and is removed before the plan
  is marked done. `(comment)`

## 0. Version spike and dependency decision

- [ ] 0.1 Re-check npm dist-tags for `drizzle-orm` and `drizzle-kit`; select the
  newest compatible `1.0.0-rc.*` pair and pin exact versions in the root/package
  manifests. Record the chosen versions in the commit message or code comments
  near the dependency declaration if the tag situation is non-obvious.
- [ ] 0.2 Add Drizzle dependencies where they are actually used:
  `drizzle-orm`, `drizzle-kit`, `pg`, and `@types/pg`; avoid duplicated
  dependency declarations in packages that only consume exported db surfaces.
- [ ] 0.3 Remove Prisma dependencies from `server`, `auth`, `notify`,
  `reaction`, `history`, `ranking`, `job-runner`, `utils`, `search`, and `tool`
  once their runtime/tooling imports are gone.
- [ ] 0.4 Update root scripts from `prisma:*` to `db:*`, keeping command names
  short and Bun-native: `db:generate`, `db:migrate`, `db:deploy`, `db:reset`,
  and any package-filtered equivalents that are still useful.
- [ ] 0.5 Update `AGENTS.md` command examples and architecture wording from
  Prisma schemas to Drizzle schema ownership.

## 1. Database tooling and migration runner

- [ ] 1.1 Replace `tool/src/commands/prisma/*` with a Drizzle-oriented
  `tool/src/commands/db/*` package registry covering schema owners:
  `auth`, `server`, `notify`, `reaction`, `history`, `ranking`; keep
  `job-runner` as `ensureOnly`.
- [ ] 1.2 Add `tool db generate` to run `bunx drizzle-kit generate --config ...`
  per selected package. It must support all packages, one package, and
  non-interactive mode.
- [ ] 1.3 Add `tool db migrate` for local development. Order should be
  `auth -> server -> notify -> reaction -> history -> ranking`, with ranking
  remaining conceptually parallel-safe but serialized for simpler local output.
- [ ] 1.4 Add `tool db deploy` for production-style one-shot migrations. It must
  run Drizzle migrations without dev prompts and must be the command used by
  `bin/deploy`.
- [ ] 1.5 Add `tool db reset` for destructive local resets. It should drop/recreate
  selected schema-owner databases, run Drizzle migrations from scratch, then
  optionally invoke existing seed/factory workflows. Keep headless confirmation
  strict.
- [ ] 1.6 Add preflight checks used by `migrate` and `deploy`: connection URL
  sanity, PostgreSQL 18+, `SELECT uuidv7()`, and package-specific checks such as
  `ltree` expected only for server after custom migration.
- [ ] 1.7 Decide the Drizzle migration table config in every `drizzle.config.ts`.
  Prefer the default or a uniform `drizzle.__drizzle_migrations`, but document
  the choice in CONTRIBUTING and deployment troubleshooting.
- [ ] 1.8 Add tests for package selection, ordering, failure handling, preflight
  rejection on non-PG18, and no accidental use of the removed Prisma command
  path.

## 2. Drizzle schema layout

- [ ] 2.1 Create a shared schema helper module for PostgreSQL columns:
  `uuidv7PrimaryKey`, `uuidv7`, `timestamps`, JSON column helpers, text array
  helpers, enum naming helpers, and nullable timestamp conventions.
- [ ] 2.2 Create a custom `ltree` Drizzle type for server query typing, while
  keeping extension creation in custom SQL migration rather than TS schema.
- [ ] 2.3 Split `package/server` schema under `package/server/src/db/schema/`:
  `enums.ts`, `custom-types.ts`, `columns.ts`, `identity.ts`,
  `translation.ts`, `alias.ts`, `content-structure.ts`, `catalog.ts`,
  `discussion.ts`, `shelf.ts`, `collection.ts`, `series.ts`, `realm.ts`,
  `tagging.ts`, `poll.ts`, `attribution.ts`, `user.ts`, `engagement.ts`,
  `score.ts`, `governance.ts`, `jwt.ts`, `misc.ts`, and `index.ts`.
- [ ] 2.4 Keep the `Unit` / server-side `User` FK cycle in one low-level schema
  area or break it with callback references so import cycles do not leak across
  the whole schema.
- [ ] 2.5 Put Drizzle RQB v2 relation definitions under
  `package/server/src/db/relations/`, using `defineRelations` and
  `defineRelationsPart` where files become too large.
- [ ] 2.6 Add focused schema folders for smaller packages:
  `package/auth/src/db/schema/`, `package/notify/src/db/schema/`,
  `package/reaction/src/db/schema/`, `package/history/src/db/schema/`, and
  `package/ranking/src/db/schema/`.
- [ ] 2.7 Each schema package exports `schema`, `relations`, db type aliases,
  enum values, and row insert/select types from a single stable public module.
- [ ] 2.8 Add a convention check or targeted test that every configured schema
  folder exports all table/enums required by Drizzle Kit.

## 3. Baseline migrations and custom SQL

- [ ] 3.1 Delete old Prisma migration folders for all six schema owners after
  the corresponding Drizzle baseline exists.
- [ ] 3.2 Create Drizzle config files for every schema owner with `dialect:
  "postgresql"`, schema folder/file, package-specific DB URL, and migration
  output folder.
- [ ] 3.3 For `server`, create an ordered custom SQL migration before the baseline
  init that runs `CREATE EXTENSION IF NOT EXISTS ltree;`.
- [ ] 3.4 Preserve required server helper SQL in custom migrations, including
  `rezics_to_base36`, `post_path_label_seq` if still needed, `ltree` path
  operations, partial unique indexes for single-choice poll votes, and special
  GiST/GIN indexes.
- [ ] 3.5 Decide which indexes can be expressed in Drizzle v1 `index()` /
  `uniqueIndex()` builders and which must stay as custom SQL. Use official
  index docs as the reference:
  https://orm.drizzle.team/docs/indexes-constraints.
- [ ] 3.6 Generate a single baseline init migration per package from the Drizzle
  schema. Inspect generated SQL manually for table names, enum names, FK
  actions, default values, indexes, and casing.
- [ ] 3.7 Ensure `reaction` and `ranking` switch from `gen_random_uuid()` to
  native `uuidv7()` in the baseline.
- [ ] 3.8 Add migration smoke tests or scripts that run on fresh databases and
  assert representative tables, enum values, extension availability, UUID
  version 7 extraction, partial indexes, and `ltree` path indexes.

## 4. Runtime database clients

- [ ] 4.1 Replace each `package/*/prisma/client.ts` with a Drizzle db client
  module under `src/db/client.ts` or `src/db/index.ts`, preserving existing pool
  limits, timeouts, graceful shutdown, and development query logging where
  useful.
- [ ] 4.2 Expose stable package exports for db clients and schema types, for
  example `@rezics/server/db`, `@rezics/server/db/schema`, and
  `@rezics/server/db/relations`.
- [ ] 4.3 Convert runtime code in `package/server/src` from Prisma method calls
  to Drizzle queries. Use domain-by-domain passes so tests stay meaningful:
  unit/catalog, content structure, comments/posts, realm/tagging, poll,
  attribution, user/profile, subscriptions/notify boundary, governance,
  feedback, JWT, EchoKV, scripts.
- [ ] 4.4 Convert `package/auth/src` to Drizzle db access, including internal
  APIs, JWT service persistence, admin user/session operations, and tests.
- [ ] 4.5 Convert `notify`, `reaction`, `history`, and `ranking` services to
  Drizzle clients and query helpers.
- [ ] 4.6 Replace Prisma transaction usage with Drizzle transaction helpers.
  Preserve atomicity around multi-table domain writes, especially moderation,
  seed, factory, reaction summary updates, history outbox, and ranking flushes.
- [ ] 4.7 Replace Prisma raw SQL helpers (`Prisma.sql`, `Prisma.join`,
  `$queryRaw`) with Drizzle `sql` and parameterized helpers. Add local helpers
  for UUID array interpolation and `ltree` casts.
- [ ] 4.8 Replace Prisma-specific duplicate/error handling with database error
  mapping based on PostgreSQL SQLSTATE codes.
- [ ] 4.9 Replace Prisma mock helpers in server tests with either focused
  repository mocks or a Drizzle test db abstraction. Do not keep a
  Prisma-shaped mock just to minimize test edits.

## 5. Auth and Better Auth

- [ ] 5.1 Replace `@better-auth/prisma-adapter` usage in
  `package/auth/src/auth/instance.ts` with `@better-auth/drizzle-adapter`.
- [ ] 5.2 Model Better Auth tables in the auth Drizzle schema with existing table
  names and field names, including plugin tables for OAuth provider and JWT
  support.
- [ ] 5.3 Pass the schema mapping required by the Better Auth Drizzle adapter
  when model/table names differ from Better Auth defaults.
- [ ] 5.4 Preserve database-generated IDs: keep Better Auth configured so it does
  not generate application IDs for rows where the DB default should call
  `uuidv7()`.
- [ ] 5.5 Convert auth seed helpers and reset helpers from Prisma to Drizzle.
- [ ] 5.6 Re-run auth route/session/JWT tests and add coverage for Drizzle
  adapter wiring if existing tests only mock Prisma.

## 6. Cross-package consumers and data workflows

- [ ] 6.1 Convert `package/search` from `setSearchPrismaClient` to an explicit
  Drizzle-backed main DB dependency. Update sync functions, row mappers, raw
  path queries, and tests.
- [ ] 6.2 Convert `package/ranking/src/ranking/main-state.ts` from importing the
  server Prisma generated client to importing server Drizzle schema/db helpers.
- [ ] 6.3 Convert `package/job-runner` runtime factories for search, history, and
  maintenance from Prisma clients to Drizzle db clients. Keep pg-boss DB ensure
  separate.
- [ ] 6.4 Move `package/server/prisma/seed` to a Drizzle-appropriate path such as
  `package/server/src/db/seed` or `package/server/db/seed`, then update package
  exports and seed CLI imports.
- [ ] 6.5 Move `package/server/prisma/factory` to a Drizzle-appropriate path such
  as `package/server/src/db/factory` or `package/server/db/factory`, then update
  `@rezics/utils` factory imports.
- [ ] 6.6 Move `package/auth/prisma/seed` to an auth db seed path and update
  `@rezics/auth` exports.
- [ ] 6.7 Update `package/utils/src/lib/prisma-factory.ts` into a Drizzle db
  factory module, then convert seed/factory orchestration and tests.
- [ ] 6.8 Update comments and package READMEs that refer to "Prisma-backed"
  behavior, especially search, job, shared, server, auth, ranking, and tool docs.

## 7. Tooling, deployment, and docs

- [ ] 7.1 Update `CONTRIBUTING.md` with a new database workflow section:
  Drizzle v1 rc dependency rule, package ownership, `db:*` commands, custom SQL
  pre migration policy, PostgreSQL 18 requirement, reset/reseed expectations,
  and the pg-boss exception.
- [ ] 7.2 Update `tool/README.md` and `tool/service/README.md` so fresh managed
  Postgres setup says Drizzle migrations run through repo db tooling.
- [ ] 7.3 Update `bin/deploy` to run `bun run --cwd package/<unit> db:deploy`
  or the repo `tool db deploy --package=<unit>` equivalent.
- [ ] 7.4 Update Docker build comments and migrate images from "carry Prisma CLI
  + schema" to "carry Bun + Drizzle Kit + migrations".
- [ ] 7.5 Update production release, rollback, troubleshooting, runtime
  inventory, deployment guide, and env/secrets docs to reference Drizzle
  migration flow and Drizzle migration tables instead of Prisma.
- [ ] 7.6 Update `config/README.md` migration wording and any Kamal/deploy docs
  that mention `prisma:deploy`.
- [ ] 7.7 Update `.github` instructions only where they carry repo-specific
  Prisma guidance; avoid changing third-party copied docs unless they are
  actively misleading.
- [ ] 7.8 Add or update `knip`/convention expectations so removed Prisma exports
  and generated folders are not treated as package public surfaces.

## 8. Cleanup and verification

- [ ] 8.1 Remove `package/*/prisma.config.ts`, `schema.prisma`, generated Prisma
  directories, Prisma migration directories, and Prisma client wrappers after
  all callsites are migrated.
- [ ] 8.2 Remove or rewrite docs that explain Prisma development commands,
  including `package/server/DEVELOPMENT.md` if it remains relevant.
- [ ] 8.3 Run `bun install` and verify the lockfile has no Prisma packages unless
  an unrelated third-party dependency still pulls one transitively.
- [ ] 8.4 Run database reset/migrate from a fresh managed Postgres volume:
  `bun run service up`, `bun run db:reset` or equivalent, then `bun run seed`
  and `bun run seed:factory:fast`.
- [ ] 8.5 Run package tests most likely to catch query regressions:
  `server`, `auth`, `notify`, `reaction`, `history`, `ranking`, `search`,
  `job-runner`, and `utils`.
- [ ] 8.6 Run repo checks: `bun run check:convention`, `bun run check:tokens`,
  `bun run format:check`, and `bun run knip`.
- [ ] 8.7 Grep verification must find no surviving runtime references to
  `#/prisma/client`, `@rezics/*/prisma`, `@prisma`, `schema.prisma`,
  `prisma migrate`, `PrismaClient`, or `_prisma_migrations`, except historical
  references explicitly left in old reports/graveyard material.
- [ ] 8.8 Smoke-run backend dev processes that touch the databases:
  `server`, `auth`, `notify`, `reaction`, `history`, `ranking`, and
  `job-runner` in the roles used by local development.

## Out of scope

- Preserving existing development or pre-production data.
- Designing forward-compatible expand/contract production releases for this
  specific cutover.
- Modeling or migrating pg-boss internal tables in Drizzle.
- Changing public API contracts except where Prisma-generated types leaked into
  implementation-only code and need replacement.
- Frontend UI changes beyond any type fallout from backend contract updates.
- Keeping a Prisma compatibility layer after the Drizzle runtime is live.

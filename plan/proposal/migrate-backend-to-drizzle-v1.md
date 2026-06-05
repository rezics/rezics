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
- **Add an explicit rc go/no-go gate before broad migration work.** The first
  spike must prove Drizzle v1 rc, RQB v2, schema generation, migrations, and the
  Better Auth adapter are stable enough for Rezics. If docs/API churn or RQB v2
  gaps block representative queries, fall back to pinned 0.x stable plus legacy
  relation/query syntax, or re-scope this proposal before touching every
  service. `(comment)` `(test)`
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
- **Composite and cyclic foreign keys are first-class schema work.** Multi-column
  FKs must use Drizzle's table-callback `foreignKey({ columns,
  foreignColumns })` builder, not inline `.references()`. This applies to known
  composite FK tables such as `ShelfUnitRelation`, `RealmCapabilityGrant`,
  `CreditAttributionEvidence`, `PollVote`, and
  `RealmTagApplicationVote`, and to any self/cycle FK that needs callback
  typing. `(type)` `(test)`
- **PostgreSQL 18 is required.** Migration preflight must reject databases where
  `server_version_num < 180000` or `uuidv7()` is unavailable. PostgreSQL 18
  documents `uuidv7()` as a built-in UUID generation function:
  https://www.postgresql.org/docs/18/functions-uuid.html. `(test)`
- **UUID primary keys default to native `uuidv7()`.** Do not use `uuid-ossp`,
  `pgcrypto`, `gen_random_uuid()`, Drizzle `defaultRandom()`, or application-side
  UUID generation for table IDs that are meant to be database-generated.
  PostgreSQL documents `uuid-ossp` as only needed beyond built-in UUID support:
  https://www.postgresql.org/docs/18/uuid-ossp.html. `(comment)` `(test)`
- **Normalize existing UUID default exceptions unless they are semantic IDs.**
  `EmailVerificationContract.id` is a normal UUID primary key and must move from
  Prisma `@default(uuid())` to database `uuidv7()`. `reaction` and `ranking`
  IDs currently using `gen_random_uuid()` also move to `uuidv7()`. The explicit
  exception is JWKS key storage: `Jwks.id` is the JWT `kid`, not a
  database-generated UUID. `(type)` `(test)`
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
- **Managed Postgres extension privileges must be surfaced.** `ltree` creation
  may require an elevated role on managed Postgres. Preflight/deploy
  troubleshooting must clearly distinguish "extension missing" from "connected
  role cannot create extension" and tell operators to create it with a DBA or
  elevated role before rerunning migrations. `(comment)` `(test)`
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
- **JSON column shapes are contract-owned unless storage owns the shape.** Do
  not hand-author arbitrary `json/jsonb().$type<T>()` shapes in Drizzle schema
  just to replace `prisma-json-types-generator`. Most JSON columns stay opaque
  transport and are typed/validated at contract or domain boundaries. If a JSON
  column needs a Drizzle `$type<T>()`, import or infer `T` from
  `@rezics/contract` schemas or from a storage-owned domain type such as JWK;
  changing that TypeScript type alone must not be treated as a migration-worthy
  database schema change. `(type)` `(test)`
- **Public enum values must not become ORM-coupled.** Where Prisma enum values
  leaked into contracts or shared packages, move the canonical value set to
  `@rezics/contract` or a domain-neutral constants module. Drizzle schema should
  consume those values, not become the public enum source. `(type)` `(test)`
- **Prisma dynamic query shapes must be rewritten, not translated mechanically.**
  `Prisma.*WhereInput`, `Include`, `Select`, and payload helper types do not
  have generated Drizzle equivalents. Conditional filters become local
  `and(...)` / `or(...)` / `sql` composition helpers; include/select behavior
  becomes explicit RQB v2 `with`, joins, projections, and mappers. `(type)`
  `(test)`
- **Transaction threading must use repo-local db/tx types.** Helpers that
  currently accept `Prisma.TransactionClient` should accept a minimal Rezics
  Drizzle `DbLike`/`TxLike` interface or package-local equivalent so callers can
  pass either the root db or a transaction handle without preserving
  Prisma-shaped signatures. `(type)` `(test)`
- **Raw SQL is allowed but centralized.** `ltree` operations, aggregate-heavy
  queries, bulk CTEs, partial indexes, and array containment can use Drizzle
  `sql` helpers. Avoid ad hoc string concatenation; identifiers and values must
  go through typed helpers or parameterized SQL. `(comment)` `(test)`
- **Existing raw SQL must be triaged, not blindly carried forward.** Some
  `$queryRaw` sites exist only because Prisma could not express partial
  indexes, array containment, `ltree`, or bulk CTE patterns. During migration,
  classify each raw query as "keep raw SQL", "wrap in typed Drizzle sql helper",
  or "replace with Drizzle builder/RQB". `(comment)` `(test)`
- **Better Auth moves to the Drizzle adapter.** Replace
  `@better-auth/prisma-adapter` with `@better-auth/drizzle-adapter`, pass the
  auth Drizzle db and schema mapping, and keep `generateId: false` semantics so
  database `uuidv7()` remains authoritative. Official reference:
  https://better-auth.com/docs/adapters/drizzle. `(test)`
- **Custom JWT/JWKS persistence is separate from the standard Better Auth
  adapter swap.** `package/auth/src/session/jwt/prisma-adapter.ts` is a
  hand-written persistence layer for `JwtService`/`Jwks`, key encryption, `kid`
  identity, rotation, and grace periods. It must be migrated and tested as its
  own auth task, not treated as covered by `@better-auth/drizzle-adapter`.
  `(comment)` `(test)`
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
- **Task sections are grouped by concern, not a strict linear timeline.** Apply
  should respect dependencies: the §0 spike gate comes first; schema, migrations,
  runtime, auth, and cross-package work iterate together by package/domain; §8
  cleanup can only complete after runtime, tests, and deployment/docs are
  migrated. `(comment)`

## 0. Version spike and dependency decision

- [x] 0.1 Re-check npm dist-tags for `drizzle-orm` and `drizzle-kit`; select the
  newest compatible `1.0.0-rc.*` pair and pin exact versions in the root/package
  manifests. Record the chosen versions in the commit message or code comments
  near the dependency declaration if the tag situation is non-obvious.
- [ ] 0.2 Run a representative spike before broad edits: one schema with a
  composite FK, one cyclic FK, one RQB v2 relation query with nested `with`, one
  dynamic filter helper, one transaction helper, one custom SQL migration, and
  one Better Auth Drizzle adapter insert using `generateId: false`. Record the
  go/no-go decision in this proposal or in the commit message before continuing.
- [ ] 0.3 If the spike fails because Drizzle v1 rc or RQB v2 is not stable enough,
  stop and revise this proposal for pinned 0.x stable / legacy relations before
  changing the full runtime surface.
- [x] 0.4 Add Drizzle dependencies where they are actually used:
  `drizzle-orm`, `drizzle-kit`, `pg`, and `@types/pg`; avoid duplicated
  dependency declarations in packages that only consume exported db surfaces.
- [ ] 0.5 Remove Prisma dependencies from `server`, `auth`, `notify`,
  `reaction`, `history`, `ranking`, `job-runner`, `utils`, `search`, and `tool`
  once their runtime/tooling imports are gone.
- [x] 0.6 Update root scripts from `prisma:*` to `db:*`, keeping command names
  short and Bun-native: `db:generate`, `db:migrate`, `db:deploy`, `db:reset`,
  and any package-filtered equivalents that are still useful.
- [x] 0.7 Update `AGENTS.md` command examples and architecture wording from
  Prisma schemas to Drizzle schema ownership.

## 1. Database tooling and migration runner

- [x] 1.1 Replace `tool/src/commands/prisma/*` with a Drizzle-oriented
  `tool/src/commands/db/*` package registry covering schema owners:
  `auth`, `server`, `notify`, `reaction`, `history`, `ranking`; keep
  `job-runner` as `ensureOnly`.
- [x] 1.2 Add `tool db generate` to run `bunx drizzle-kit generate --config ...`
  per selected package. It must support all packages, one package, and
  non-interactive mode.
- [x] 1.3 Add `tool db migrate` for local development. Order should be
  `auth -> server -> notify -> reaction -> history -> ranking`, with ranking
  remaining conceptually parallel-safe but serialized for simpler local output.
- [x] 1.4 Add `tool db deploy` for production-style one-shot migrations. It must
  run Drizzle migrations without dev prompts and must be the command used by
  `bin/deploy`.
- [x] 1.5 Add `tool db reset` for destructive local resets. It should drop/recreate
  selected schema-owner databases, run Drizzle migrations from scratch, then
  optionally invoke existing seed/factory workflows. Keep headless confirmation
  strict.
- [x] 1.6 Add preflight checks used by `migrate` and `deploy`: connection URL
  sanity, PostgreSQL 18+, `SELECT uuidv7()`, and package-specific checks such as
  `ltree` expected only for server after custom migration.
- [x] 1.7 Decide the Drizzle migration table config in every `drizzle.config.ts`.
  Prefer the default or a uniform `drizzle.__drizzle_migrations`, but document
  the choice in CONTRIBUTING and deployment troubleshooting.
- [x] 1.8 Surface managed Postgres `ltree` privilege failures separately from
  missing-extension failures, with deploy troubleshooting text for creating the
  extension through a DBA/elevated role.
- [x] 1.9 Add tests for package selection, ordering, failure handling, preflight
  rejection on non-PG18, and no accidental use of the removed Prisma command
  path.

## 2. Drizzle schema layout

- [x] 2.1 Create a shared schema helper module for PostgreSQL columns:
  `uuidv7PrimaryKey`, `uuidv7`, `timestamps`, JSON column helpers, text array
  helpers, enum naming helpers, and nullable timestamp conventions.
- [x] 2.2 Create a custom `ltree` Drizzle type for server query typing, while
  keeping extension creation in custom SQL migration rather than TS schema.
- [x] 2.3 Split `package/server` schema under `package/server/src/db/schema/`:
  `enums.ts`, `custom-types.ts`, `columns.ts`, `identity.ts`,
  `translation.ts`, `alias.ts`, `content-structure.ts`, `catalog.ts`,
  `discussion.ts`, `shelf.ts`, `collection.ts`, `series.ts`, `realm.ts`,
  `tagging.ts`, `poll.ts`, `attribution.ts`, `user.ts`, `engagement.ts`,
  `score.ts`, `governance.ts`, `jwt.ts`, `misc.ts`, and `index.ts`.
- [x] 2.4 Keep the `Unit` / server-side `User` FK cycle in one low-level schema
  area or break it with callback references so import cycles do not leak across
  the whole schema.
- [x] 2.5 Put Drizzle RQB v2 relation definitions under
  `package/server/src/db/relations/`, using `defineRelations` and
  `defineRelationsPart` where files become too large.
- [x] 2.6 Inventory and model all composite/multi-column FKs with table-callback
  `foreignKey({ columns, foreignColumns })`, including
  `ShelfUnitRelation`, `RealmCapabilityGrant`, `CreditAttributionEvidence`,
  `PollVote`, `RealmTagApplicationVote`, and any additional composite FK found
  during schema conversion.
- [x] 2.7 Establish JSON column typing rules in schema helpers: default to
  opaque JSON transport; allow `.$type<T>()` only when `T` is imported/inferred
  from `@rezics/contract` or a storage-owned domain type such as JWK.
- [x] 2.8 Move public enum value ownership out of ORM-generated types. For every
  enum used outside backend implementation, decide whether the canonical values
  live in `@rezics/contract` or a domain-neutral constants module, then make
  Drizzle schema consume that source.
- [x] 2.9 Add focused schema folders for smaller packages:
  `package/auth/src/db/schema/`, `package/notify/src/db/schema/`,
  `package/reaction/src/db/schema/`, `package/history/src/db/schema/`, and
  `package/ranking/src/db/schema/`.
- [x] 2.10 Each schema package exports `schema`, `relations`, db type aliases,
  enum values, and row insert/select types from a single stable public module.
- [x] 2.11 Add a convention check or targeted test that every configured schema
  folder exports all table/enums required by Drizzle Kit.

## 3. Baseline migrations and custom SQL

- [x] 3.1 Delete old Prisma migration folders for all six schema owners after
  the corresponding Drizzle baseline exists.
- [x] 3.2 Create Drizzle config files for every schema owner with `dialect:
  "postgresql"`, schema folder/file, package-specific DB URL, and migration
  output folder.
- [x] 3.3 For `server`, create an ordered custom SQL migration before the baseline
  init that runs `CREATE EXTENSION IF NOT EXISTS ltree;`.
- [x] 3.4 Preserve required server helper SQL in custom migrations, including
  `rezics_to_base36`, `post_path_label_seq` if still needed, `ltree` path
  operations, partial unique indexes for single-choice poll votes, and special
  GiST/GIN indexes.
- [x] 3.5 Decide which indexes can be expressed in Drizzle v1 `index()` /
  `uniqueIndex()` builders and which must stay as custom SQL. Use official
  index docs as the reference:
  https://orm.drizzle.team/docs/indexes-constraints.
- [x] 3.6 Generate a single baseline init migration per package from the Drizzle
  schema. Inspect generated SQL manually for table names, enum names, FK
  actions, default values, indexes, and casing.
- [x] 3.7 Ensure `reaction` and `ranking` switch from `gen_random_uuid()` to
  native `uuidv7()` in the baseline.
- [x] 3.8 Ensure `server.EmailVerificationContract.id` switches from Prisma
  `uuid()` / application-generated UUID default to database `uuidv7()` in the
  Drizzle baseline.
- [x] 3.9 Keep `auth.Jwks.id` as the JWT `kid` string primary key with no
  `uuidv7()` default, and add baseline review coverage so the global UUID rule
  does not rewrite it.
- [x] 3.10 Add migration smoke tests or scripts that run on fresh databases and
  assert representative tables, enum values, extension availability, UUID
  version 7 extraction, partial indexes, and `ltree` path indexes.

## 4. Runtime database clients

- [ ] 4.1 Replace each `package/*/prisma/client.ts` with a Drizzle db client
  module under `src/db/client.ts` or `src/db/index.ts`, preserving existing pool
  limits, timeouts, graceful shutdown, and development query logging where
  useful.
- [x] 4.2 Expose stable package exports for db clients and schema types, for
  example `@rezics/server/db`, `@rezics/server/db/schema`, and
  `@rezics/server/db/relations`.
- [ ] 4.3 Convert runtime code in `package/server/src` from Prisma method calls
  to Drizzle queries. Use domain-by-domain passes so tests stay meaningful:
  unit/catalog, content structure, comments/posts, realm/tagging, poll,
  attribution, user/profile, subscriptions/notify boundary, governance,
  feedback, JWT, EchoKV, scripts.
  - Applied progress: converted bounded server runtime domains including
    user tag applications, account export/deletion, game/media library,
    governance audit/capability/moderation-action/enforcement,
    unit language resolution/authority/translation, system shelves, user unit
    collection metadata, unit aliases, subject/credit/entity attribution,
    score, realm tag context, tag service, poll voting service, progress
    service, realm extra metadata, zone service, user service, dispatch service,
    comment service, shelf collection service, entity service, unit service,
    chapter service, series service, content-structure service, book service,
    governance moderation service, realm service, shelf service, post service,
    and server Meili client bootstrap.
  - Verification on 2026-06-04: server runtime grep for `#/prisma/client`,
    `@prisma`, `@prisma/`, `Prisma.`, and `prisma.` is clean under
    `package/server/src` excluding tests; scoped server TypeScript filtering for
    migrated governance, realm, shelf, post, and `meili/search-client.ts` has no
    output. Focused governance/realm/shelf tests pass. `post.service.test.ts`
    still needs assertion/harness cleanup because many cases assert old
    Prisma-shaped query arguments rather than Drizzle query behavior.
  - Applied progress: converted `package/server/src/db/seed/database.ts` reset
    deletes from Prisma delegates to Drizzle table deletes; the reset test now
    derives coverage from Drizzle `pgTable` exports instead of
    `schema.prisma`.
- [ ] 4.4 Replace dynamic `Prisma.*WhereInput`, `Include`, `Select`, and payload
  type composition with domain-local Drizzle query builders, explicit
  projections, RQB v2 `with`, joins, and mappers. Prioritize heavily dynamic
  search/catalog/unit/book/realm/post/listing queries before small CRUD paths.
- [x] 4.5 Convert `package/auth/src` to Drizzle db access, including internal
  APIs, JWT service persistence, admin user/session operations, and tests.
- [x] 4.6 Convert `notify`, `reaction`, `history`, and `ranking` services to
  Drizzle clients and query helpers.
- [ ] 4.7 Replace Prisma transaction usage with Drizzle transaction helpers.
  Preserve atomicity around multi-table domain writes, especially moderation,
  seed, factory, reaction summary updates, history outbox, and ranking flushes.
- [ ] 4.8 Introduce package-local `DbLike`/`TxLike` or equivalent minimal
  interfaces, then update helpers that currently thread
  `Prisma.TransactionClient` so each can run against either root db or a Drizzle
  transaction handle.
- [ ] 4.9 Replace Prisma raw SQL helpers (`Prisma.sql`, `Prisma.join`,
  `$queryRaw`) with Drizzle `sql` and parameterized helpers. Add local helpers
  for UUID array interpolation and `ltree` casts.
- [ ] 4.10 Triage every `$queryRaw` site before rewriting: keep true special SQL
  raw, wrap reusable SQL in typed Drizzle helpers, and replace Prisma-workaround
  raw queries with Drizzle builders/RQB where practical.
- [ ] 4.11 Replace Prisma-specific duplicate/error handling with database error
  mapping based on PostgreSQL SQLSTATE codes.
- [ ] 4.12 Replace Prisma mock helpers in server tests with either focused
  repository mocks or a Drizzle test db abstraction. Do not keep a
  Prisma-shaped mock just to minimize test edits.

## 5. Auth and Better Auth

- [x] 5.1 Replace `@better-auth/prisma-adapter` usage in
  `package/auth/src/auth/instance.ts` with `@better-auth/drizzle-adapter`.
- [x] 5.2 Model Better Auth tables in the auth Drizzle schema with existing table
  names and field names, including plugin tables for OAuth provider and JWT
  support.
- [x] 5.3 Pass the schema mapping required by the Better Auth Drizzle adapter
  when model/table names differ from Better Auth defaults.
- [x] 5.4 Preserve database-generated IDs: keep Better Auth configured so it does
  not generate application IDs for rows where the DB default should call
  `uuidv7()`.
- [x] 5.5 Add a focused Better Auth adapter test/spike proving inserts for core
  auth tables omit IDs when `generateId: false` is active and the database
  supplies UUIDv7 IDs.
- [x] 5.6 Convert the custom JWT/JWKS persistence layer in
  `package/auth/src/session/jwt/prisma-adapter.ts` to Drizzle. Preserve `kid` as
  `Jwks.id`, key encryption/decryption, rotation, grace period calculation, and
  local issuer service upsert behavior.
- [x] 5.7 Convert auth seed helpers and reset helpers from Prisma to Drizzle.
- [x] 5.8 Re-run auth route/session/JWT tests and add coverage for Drizzle
  adapter wiring if existing tests only mock Prisma.
- [x] 5.9 Add or update JWT/JWKS tests that cover list/save/get/retire behavior
  through the migrated persistence layer, including non-uuid `kid` IDs and
  private key encryption when enabled.

## 6. Cross-package consumers and data workflows

- [ ] 6.1 Convert `package/search` from `setSearchPrismaClient` to an explicit
  Drizzle-backed main DB dependency. Update sync functions, row mappers, raw
  path queries, and tests.
  - Applied progress: added an explicit `setSearchDb(db)` dependency and moved
    user search sync (`syncSingleUser`, `syncAllUsers`, `syncUserSegment`) to
    Drizzle reads against server `User` + `Unit.slug`; the remaining content,
    post, realm, entity, feedback, poll, collection/progress, and raw path sync
    paths still use the legacy Prisma client injection.
  - Applied progress: moved feedback search sync (`syncSingleFeedback`,
    `syncAllFeedbacks`, `syncFeedbackSegment`, and
    `patchFeedbackResolutionFromDb`) to Drizzle reads against server
    `Feedback`.
  - Applied progress: moved user collection search sync
    (`syncSingleUserUnitCollection`, `syncUserUnitCollectionSegment`, and
    `syncAllUserUnitCollections`) to Drizzle reads against server
    `UserUnitCollection`.
  - Applied progress: moved user progress search sync (`syncSingleProgress`,
    `syncProgressSegment`, and `syncAllProgress`) to Drizzle reads against
    server `UserUnitProgress`, preserving the `isDeleted = false` segment
    filter and removing stale/deleted single-row documents.
  - Applied progress: moved entity search sync (`syncSingleEntity`,
    `syncEntitySegment`, `syncAllEntities`, and `patchEntityAliases`) to
    Drizzle reads against server `Entity`, `Unit`, `UnitTranslation`, and
    `UnitAlias`.
  - Applied progress: moved poll search sync (`syncSinglePoll` and
    `syncAllPolls`) to Drizzle reads against server `Poll`, `PollOption`,
    `Unit`, `UnitTranslation`, and `UnitSupportLanguage`, preserving published
    Unit filtering and stale/unpublished single-row deletion.
  - Applied progress: moved content patch eligibility and realm id patching to
    Drizzle reads against server `Unit`, `UnitRealm`, and `Realm`, preserving
    public/indexable Unit checks and private realm exclusion.
- [x] 6.2 Convert `package/ranking/src/ranking/main-state.ts` from importing the
  server Prisma generated client to importing server Drizzle schema/db helpers.
- [ ] 6.3 Convert `package/job-runner` runtime factories for search, history, and
  maintenance from Prisma clients to Drizzle db clients. Keep pg-boss DB ensure
  separate.
  - Applied progress: search runtime now creates and injects a server Drizzle db
    for the migrated user search sync path while temporarily retaining the
    server Prisma client for the remaining search sync paths.
- [x] 6.4 Move `package/server/prisma/seed` to a Drizzle-appropriate path such as
  `package/server/src/db/seed` or `package/server/db/seed`, then update package
  exports and seed CLI imports.
- [x] 6.5 Move `package/server/prisma/factory` to a Drizzle-appropriate path such
  as `package/server/src/db/factory` or `package/server/db/factory`, then update
  `@rezics/utils` factory imports.
- [x] 6.6 Move `package/auth/prisma/seed` to an auth db seed path and update
  `@rezics/auth` exports.
- [ ] 6.7 Update `package/utils/src/lib/prisma-factory.ts` into a Drizzle db
  factory module, then convert seed/factory orchestration and tests.
  - Applied progress: `package/utils/src/db/command.ts` `runDbReset()` now
    creates a server Drizzle db via `@rezics/server/db` and no longer needs the
    server Prisma client. `seedBaseline({ resetDatabases })` now requires an
    explicit Drizzle reset db while the broader seed/factory orchestration
    remains blocked on migrating `@rezics/server/db/seed-factory` and
    `@rezics/search` sync.
  - Applied progress: `factory --only echokv` now uses
    `seedEchoKVWithDb(serverDb.db)` through `createServerDb`; full factory
    scenarios still use the legacy Prisma-shaped seed context.
  - Applied progress: `seedSlugScopes()` now uses Drizzle `select`,
    transaction, `sql`, and schema tables; `seedBaseline()` returns the
    Drizzle-seeded scope map so factory no longer re-queries `SlugScope` through
    Prisma before creating the factory seed context.
  - Applied progress: baseline server user seed, infra user seed, and
    `reset-root` now upsert server `Unit`/`User` rows through Drizzle and use
    the Drizzle system-shelf adapter.
  - Applied progress: `seedContentTypeTags()` and `seedSearchTagIds()` now use
    Drizzle schema tables for `Unit`, translations, support languages,
    self-tagging, and `EchoKV`.
  - Applied progress: `seedDefaultRealm()` now uses Drizzle for slug lookup,
    official realm fallback, `Unit`/translation/support-language/`Realm`/
    `RealmMember` creation, and contract slug backfill.
  - Applied progress: `seedRealmTaxonomy()` and `seedGameMediaTaxonomy()` now use
    Drizzle for shared tags, POST Units/content translations, realm context,
    feed membership, realm/global tag applications, platform entities, and
    rating tags. `seedInfra()` and `seedBaseline()` no longer accept or create a
    server Prisma client; full factory scenarios and search sync still use the
    legacy Prisma-shaped runtime path.
- [x] 6.8 Update comments and package READMEs that refer to "Prisma-backed"
  behavior, especially search, job, shared, server, auth, ranking, and tool docs.

## 7. Tooling, deployment, and docs

- [x] 7.1 Update `CONTRIBUTING.md` with a new database workflow section:
  Drizzle v1 rc dependency rule, package ownership, `db:*` commands, custom SQL
  pre migration policy, PostgreSQL 18 requirement, reset/reseed expectations,
  and the pg-boss exception.
- [x] 7.2 Update `tool/README.md` and `tool/service/README.md` so fresh managed
  Postgres setup says Drizzle migrations run through repo db tooling.
- [x] 7.3 Update `bin/deploy` to run `bun run --cwd package/<unit> db:deploy`
  or the repo `tool db deploy --package=<unit>` equivalent.
- [ ] 7.4 Update Docker build comments and migrate images from "carry Prisma CLI
  + schema" to "carry Bun + Drizzle Kit + migrations".
  - Applied progress: removed `bunx prisma generate` and Prisma-era Docker
    comments from auth, notify, history, and ranking images; job-runner now only
    documents the temporary server Prisma generation needed by search sync.
    `server` and job-runner remain blocked by server/search runtime cutover.
- [x] 7.5 Update production release, rollback, troubleshooting, runtime
  inventory, deployment guide, and env/secrets docs to reference Drizzle
  migration flow and Drizzle migration tables instead of Prisma.
- [x] 7.6 Update `config/README.md` migration wording and any Kamal/deploy docs
  that mention `prisma:deploy`.
- [x] 7.7 Update `.github` instructions only where they carry repo-specific
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

---
title: 1Panel-first Postgres deployment
status: active
created: 2026-06-04
completed:
supersededBy:
tags: [deployment, postgres, 1panel, cdc, backup, tooling]
---

## Why

Rezics is moving toward a Docker deployment where 1Panel owns the operator-facing
server panel, database application lifecycle, file access, and database backups.
That changes the production boundary: PostgreSQL should no longer be created as
a Kamal/Rezics accessory or by each service, but should be provisioned through
1Panel App Store and exposed to Rezics services only through database connection
URLs.

The goal is to make this safe and repeatable before launch: keep Rezics schema
migrations in the repo, keep 1Panel responsible for the PostgreSQL instance and
backups, and add production-safe verification so logical replication, Sequin
publications, replication slots, and required database extensions are proven
before services and workers start.

## Durable constraints & decisions

- 1Panel is the owner of production PostgreSQL instance lifecycle, backup, and
  restore. Rezics deploy code must treat PostgreSQL as externally provisioned
  infrastructure and consume only secret connection URLs. `(comment)` `(test)`
- Rezics remains the owner of schema migrations. 1Panel may create databases and
  users, but Drizzle migration commands remain the only source of schema shape.
  `(comment)` `(test)`
- The 1Panel PostgreSQL app must be validated for the production major version
  before rollout. Rezics currently targets PostgreSQL 18 behavior; if the
  selected 1Panel app cannot run the required major version, the implementation
  must either use a supported custom/local 1Panel app or stop before changing
  production docs. `(test)`
- PostgreSQL CDC settings are required production invariants:
  `wal_level = logical`, `max_replication_slots >= 10`, and
  `max_wal_senders >= 10`. Verification must also fail when any changed setting
  is still `pending_restart`. `(test)`
- The repo should provide a Rezics PostgreSQL config asset under `config/` or
  `tool/`, but apply-time work must choose between a complete `postgresql.cnf`
  override and a smaller managed config fragment only after checking 1Panel's
  generated config for required app-specific defaults. `(comment)`
- Production verification commands must be safe by default: no dropping
  replication slots, no `ALTER SYSTEM`, no publication recreation, no database
  creation, and no destructive restore operations unless an explicitly named
  apply/repair mode is added later. `(test)`
- Sequin CDC validation must cover both sources: `rezics_server` with the table
  list from `package/job-runner/sequin/sequin.yml`, and `rezics_reaction` with
  `ReactionSummary`. Slot names must be environment-scoped the same way as the
  Sequin config. `(test)` `(type)`
- Database URL values remain secrets. Docs and examples may show variable names
  and placeholder shapes, but must not introduce committed concrete credentials.
  `(test)`
- 1Panel is an operator panel, not the source of application schema truth.
  Runtime services may be managed by 1Panel Compose later, but service env,
  migration commands, CDC config, and backup verification remain represented in
  repo-owned files. `(comment)`

## Tasks

## 1. Postgres config asset

- [ ] 1.1 Add a repo-owned PostgreSQL config asset for Rezics production under
  `config/infra/postgres/` or `tool/infra/postgres/`, containing the minimum
  required CDC settings and comments explaining the 1Panel override/merge rule.
- [ ] 1.2 Decide, in the asset and runbook, whether the launch path uses a full
  `postgresql.cnf` replacement or a config fragment copied into the 1Panel
  generated config. The decision must be grounded in the actual 1Panel
  PostgreSQL app config layout.
- [ ] 1.3 Keep local development compose settings in sync where appropriate
  (`tool/service/compose.yml`) without making the local Docker workflow depend
  on 1Panel.

## 2. Production-safe verification tooling

- [ ] 2.1 Extract reusable CDC metadata from
  `tool/src/commands/service/source.ts` so production verification and local
  service verification do not duplicate publication table lists, publication
  naming, or slot naming.
- [ ] 2.2 Add a production-safe Postgres verification command to the repo tool
  CLI, for example `bun run tool/bin/tool.ts postgres verify`, with URL inputs
  for main, reaction, and optional Sequin state databases.
- [ ] 2.3 Verify PostgreSQL server settings: version, `wal_level`,
  `max_replication_slots`, `max_wal_senders`, and `pending_restart`.
- [ ] 2.4 Verify required databases are reachable through their production
  connection URLs: server, auth, notify, reaction, history, ranking, and job.
- [ ] 2.5 Verify required extensions and schema preconditions after migrations,
  including `ltree` in the server database.
- [ ] 2.6 Verify Sequin publications and table membership for both main and
  reaction databases without creating or dropping publications.
- [ ] 2.7 Verify replication slots exist and report active/retained WAL state
  after Sequin starts, without dropping or recreating slots.
- [ ] 2.8 Add focused tests for command behavior and SQL planning so the default
  production verification mode cannot run destructive SQL.

## 3. 1Panel deployment docs

- [ ] 3.1 Add an operation runbook for 1Panel-first PostgreSQL bootstrap:
  install PostgreSQL through App Store, confirm supported version, apply Rezics
  config, restart Postgres, create databases/users, configure backups, run
  migrations, start Sequin, then run verification.
- [ ] 3.2 Update `docs/guide/deployment.md` and `config/README.md` to describe
  the new boundary: 1Panel owns PostgreSQL lifecycle and backups; Rezics owns
  images, env contracts, migrations, and CDC verification.
- [ ] 3.3 Update `docs/reference/production-env-and-secrets.md` so database URL
  ownership no longer points to the Kamal `infra-db` accessory, while preserving
  secret classification.
- [ ] 3.4 Update rollback/troubleshooting docs for the 1Panel-first model,
  especially backup restore, migration rollback limits, Sequin slot lag, and
  the order for stopping workers before DB restore.

## 4. Remove or demote Kamal DB ownership

- [ ] 4.1 Remove or demote the production `postgres` and `sequin-postgres`
  Kamal accessories from `config/deploy.yml` after the 1Panel runbook and
  verification command exist.
- [ ] 4.2 Keep Meilisearch, Sequin, Redis, OTel, and application units aligned
  with the chosen production orchestration boundary; do not remove non-DB
  accessories unless the 1Panel service-management plan explicitly replaces
  them.
- [ ] 4.3 Retire or reframe `tool/infra/postgres/init/10-databases.sh` as local
  development bootstrap only, since production database creation is done in
  1Panel.
- [ ] 4.4 Ensure `bin/deploy` migrations consume externally supplied database
  URLs and do not attempt to create production databases.

## 5. Launch validation

- [ ] 5.1 Run the full 1Panel PostgreSQL bootstrap on a disposable VPS or VM
  using the same PostgreSQL major version intended for production.
- [ ] 5.2 Prove backup and restore with a non-production dataset before
  treating 1Panel backup as the launch backup mechanism.
- [ ] 5.3 Prove Sequin startup creates/uses the expected publications and slots,
  then prove `postgres verify` passes after Sequin is active.
- [ ] 5.4 Document the exact commands and 1Panel UI paths used in the successful
  dry run so the final launch runbook does not rely on memory.

## Out of scope

- Replacing Drizzle migrations with 1Panel-managed schema changes.
- Building a custom Rezics admin panel for Docker or database operations.
- Choosing final production reverse-proxy, domain, or TLS management for all
  services beyond the database boundary described here.
- Implementing database high availability, PITR, or cross-region disaster
  recovery beyond validating 1Panel backup/restore for launch.
- Migrating local development services to 1Panel.

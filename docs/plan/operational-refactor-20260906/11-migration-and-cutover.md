# P11 — Destructive migration, legacy preservation and deployment cutover

Status: inventory tooling implemented; production conversion pending. Date: 2026-09-06. Parent: [program and gates](README.md).

## Decision

Use a fresh isolated target deployment/database plus a controlled final write freeze as the default for this broad contract change. Reuse existing deployment/backup tooling and choose an in-place destructive forward migration only if rehearsals show equivalent data correctness and lower operational cost within the freeze/recovery budget.

This selects a workable default now. Actual inventory and timings determine execution parameters later; they are not unresolved architectural blockers.
The maintainer estimates roughly 400k+ books, around 300k with a source and more than 100k without one. These are approximate, overlapping/rounded input estimates, not a verified row total or source-completeness guarantee.

## Required preservation categories

- Auth IDs, provider associations, credentials and recovery settings; explicit decisions on revoking/recreating sessions and API credentials.
- Stable public Unit IDs, supported v1+ addresses/redirects and Profile-to-Entity mapping.
- Books with and without source information; original values, uncertain grain, actual provenance and ownership.
- Reviews, current score semantics, list membership/notes, tags, realms, discussions, reading journal, visibility and private user state.
- Assets with checksums/access metadata, historical revisions, moderation and authority evidence, permanent merge redirects.
- Source snapshots and maps introduced by P04; old import provenance is not fabricated when missing.
- Rebuildable projections are regenerated and compared, not treated as the only backup of authoritative data.

## Conversion contract

Every source row receives a deterministic disposition: preserved, transformed, merged by an approved preexisting identity operation, archived with a reason, or quarantined for mapping repair. No silently skipped user data. Counts alone are insufficient: compare identities, references, representative normalized values, visibility and checksums.

Source-less books remain useful records. Do not make them wait for rediscovery in an external source. Do not infer a Work/edition classification from old table name alone. Migration cleanup and later editorial deduplication are separate operations.

## Rehearsal and execution sequence

### Required global Unit parent retirement

The 2026-09-07 [identity contract](../../report/REZICS-source-complete-catalog-schema-20260906.md#41-logical-unit-and-owner-local-physical-identity)
requires owner-local physical identity and lifecycle in this stage. This is a
conversion of existing identity dependencies, not just a metadata-table split.

- Inventory every `unit` FK, lookup, writer, trigger/function, projection, history
  payload, worker, generated contract and supported ID/slug entry point. Include
  Entity/Auth bindings, community, moderation, reviews, lists, tags, progress and
  private state alongside publishing/music/program/software/grouping.
- Assign each old identity exactly one physical owner, preserving its UUID,
  lifecycle, permissions, addresses, redirects and history. Record uncertain
  object grain separately; do not infer a new Work or duplicate identity from the
  destination table. Same-object extensions reference the selected owner key.
- For each reference family, record old and new keys, concrete FK/checked target
  alternatives, writer, target deletion/restore behavior and conversion evidence.
  A replacement polymorphic UUID column without enforced target validity fails.
- Populate and reconcile owner records through bounded, restartable conversion;
  rebuild the owner locator from authoritative identity/migration records. Test
  ownership conflicts, stale generations, locator loss and interrupted rebuild.
  Preserve ID-only lookup without scans across all owner tables. The address
  registry and permanent merge records retain their distinct authorities.
- Maintain one authoritative writer at each cutover point. Temporary migration
  reads or staging copies have an explicit generation and removal step. They are
  not permanent dual identity systems or restoration of pre-v1 compatibility.
- Fence all old writers and update affected service/API/SDK consumers together.
  Retire live global `unit` reads/FKs/writes and drop the old table via new forward
  SQL only after reconciled conversion. Released migration history and a restricted
  recovery archive may retain the old representation; the running target may not
  depend on it. A renamed universal parent or common partitioned parent fails the
  target as well.

Owner-local identity, fixed/dynamic relation mappings and native grouping fixtures
must pass in the same restored target as the four-source catalog fixtures. This
requirement does not assert that the current inventory command already enumerates
all application-level consumers or that this conversion has been implemented.

### Deployment sequence

1. Inventory production versions and table families with approved read-only access at implementation time; classify privacy, source and existing user-write activity. Never print credentials.
2. Take and restore a complete recoverable backup; record artifact hashes, schema/extension/runtime versions and the recovery target.
3. Build the target schema through the supported release/migration process. Generate new migration files with `task services-main:db:generate -- <name>`; retain released SQL and checksums.
4. Run bounded deterministic export/transform/import jobs with per-table/bucket checkpoints, mapping manifests, error samples and restartable batches. Use reviewed service/migration commands that enforce invariants.
5. Complete at least two repeatable rehearsals, including an interruption and retry. Reconcile IDs, FK relations, language collisions, private state, current values and source mappings.
6. Prefer final authoritative re-export/reconciliation under a measured write freeze at this starting volume. If the measured freeze is too long, install a durable complete change journal/CDC before the baseline snapshot, covering inserts/updates/deletes and graph/permission changes. Do not use `updated_at` as a substitute.
7. Before cutover, stop/fence all old writers: API, background jobs, scheduled work, external integration credentials and old clients where necessary. Verify no write path remains.
8. Drain/apply final state, validate invariants and build current projection generations. Keep the target write-gated until acceptance.
9. Coordinate independently released Web, API, worker and generated client contract versions. Use maintenance/version responses for incompatible old clients; do not accidentally expose new Web to old API.
   Add deployment-generation/schema compatibility fencing. Existing Nomad `auto_revert` must not restart an incompatible previous API/worker against a destructively migrated target. A failed promotion remains behind maintenance or selects an explicitly compatible generation.
10. Switch routing and allow writes only after technical gates pass. Monitor named acceptance metrics; record the exact point of no simple rollback.
11. Retain a restricted, immutable old-data archive for the documented recovery period. Revoke old writer credentials; delete retired infrastructure only through a separate verified cleanup step.

## Rollback and forward recovery

Before target user writes: return routing to the still-consistent old deployment if its writers were merely frozen.
After target user writes: prefer fixing forward; otherwise freeze the target, export/reconcile its new authoritative changes into a validated reverse conversion, or restore/replay to an agreed target. Never redirect to the stale old database and discard new work.
Any intentionally non-convertible new contract needs a documented export/forward-recovery path before opening writes.

## Acceptance

- The target has no mandatory global Unit parent or runtime dependencies on it;
  schema/catalog inspection and actual consumer-path tests agree. All preserved
  IDs, references, merge redirects, scoped slugs and private visibility resolve to
  their correct owner after interruption, restore and locator rebuild.
- Universe/franchise/series memberships, continuity, order profiles and evidence
  survive conversion; user activity remains attached to its original logical ID.
- Every authoritative row family and object-store asset has an accounted disposition; unexplained losses = 0.
- Historical source-less records survive; ISBN/name collisions do not trigger automatic destructive merging.
- Auth login/claim, private journals, reviews, live scores, lists, language selection, source adoption and source redirects function on restored target data.
- Interrupted batches resume without duplicates or half-visible structural versions.
- Schema replay/Atlas validation, backend/SDK/frontend deterministic checks, aggregate comparison and index health pass.
- P10 recovery targets are met; P12 human acceptance is complete for the promoted portfolio.
- Restore a backup predating completed erasure/revocation, then reapply the protected ledger before traffic; private data, revoked sessions and withdrawn source derivatives do not reappear.
- A failed Web/API/worker promotion leaves a controlled maintenance/previous-state path, not mixed incompatible writes.

Existing references: [deployment](../../operations/production-deployment.md), [backup and recovery](../../operations/postgresql-backup-recovery.md), [Unit addresses](../../architecture/unit-slug-addressing.md).

## Inventory command

`DATABASE_INVENTORY_URL=... task services-main:db:inventory -- local` (or
`production`) captures a repeatable-read, read-only inventory of public tables,
columns, foreign keys, indexes, extension versions, an allowlisted set of runtime
settings and the Atlas ledger. The URL is never included in output. Application
rows, credentials and `archive_command` are excluded; row counts are explicitly
stale-capable estimates. Profile/Auth foreign keys have a separate inventory.
Use a read-only credential and store the JSON in restricted operator evidence.

The reference-contract checksum covers columns, foreign keys and index definitions;
it is not a complete schema export or a backup checksum. `pg_dump`/restore,
constraint/function/trigger coverage and actual production release identification
remain separate requirements. Table/index sizes can change during capture despite
the catalog snapshot. The command caps catalog object counts (20,000 relations,
2M columns, 400,000 FKs/indexes) and fails rather than silently truncating; it does
not scan a 500M/3B business-row corpus. Existing partition families count toward
those catalog bounds and require reviewing the cap before further growth.

Local verification on the current schema: 213 tables, 1,614 columns, 468 foreign
keys, 718 indexes and 37 migrations; 115 FKs reference Profile and 11 Auth users.
Those relationships are inventoried, not automatically assigned migration
semantics. Live production inventory, preservation dispositions and both migration
rehearsals remain required before activation.

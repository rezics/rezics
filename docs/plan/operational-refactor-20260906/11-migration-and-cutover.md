# P11 — Destructive migration, legacy preservation and deployment cutover

Status: planned, not implemented. Date: 2026-09-06. Parent: [program and gates](README.md).

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

- Every authoritative row family and object-store asset has an accounted disposition; unexplained losses = 0.
- Historical source-less records survive; ISBN/name collisions do not trigger automatic destructive merging.
- Auth login/claim, private journals, reviews, live scores, lists, language selection, source adoption and source redirects function on restored target data.
- Interrupted batches resume without duplicates or half-visible structural versions.
- Schema replay/Atlas validation, backend/SDK/frontend deterministic checks, aggregate comparison and index health pass.
- P10 recovery targets are met; P12 human acceptance is complete for the promoted portfolio.
- Restore a backup predating completed erasure/revocation, then reapply the protected ledger before traffic; private data, revoked sessions and withdrawn source derivatives do not reappear.
- A failed Web/API/worker promotion leaves a controlled maintenance/previous-state path, not mixed incompatible writes.

Existing references: [deployment](../../operations/production-deployment.md), [backup and recovery](../../operations/postgresql-backup-recovery.md), [Unit addresses](../../architecture/unit-slug-addressing.md).

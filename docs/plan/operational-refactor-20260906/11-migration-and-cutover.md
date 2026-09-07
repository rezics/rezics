# P11 — Breaking replacement, separate offline migration and reopening

Status: baseline corrected; new-system replacement, offline conversion and reopening have separate acceptance. Updated: 2026-09-07. Parent: [program and gates](README.md).

## Binding premise

Follow the [breaking replacement baseline](00-source-complete-schema.md#breaking-replacement-baseline).
The maintainer reports that the website is already stopped and the entire old
dataset is approximately **400,000 records**. This supersedes the earlier rounded
400k/300k/100k category estimates and the assumed online migration window. It is
a planning input, not an independently measured production inventory.

The new application may completely break old API/SDK/route contracts, table
layouts and persisted formats, including v1+ contracts. It must not depend on a
legacy compatibility layer. Existing code can be rewritten or removed and old
tables dropped without waiting for old data to be transformed. New referential
integrity, authorization and data correctness remain requirements.

Legacy conversion belongs to **separate offline migration software**, not normal
application requests, startup hooks or schema migrations. New-system acceptance
must not require that software, the old database, old API availability, production
credentials or successful transfer of the 400k records. Reopening the site is a
later operational action. This document update performs none of those actions.

## Track A — Implement and accept the new system

1. Enumerate dependencies on the old global `unit` parent and replaced metadata
   contracts: catalog, Entity/Auth, community, reviews/lists, tags, progress,
   addresses, history/merge, search, workers and generated interfaces.
2. Implement the final owner-local schema and reference alternatives. Rewrite
   each retained consumer directly for that contract; remove obsolete consumers,
   routes, adapters, views, aliases and temporary old/new collision guards.
   No global `unit` or renamed universal parent may remain in the target runtime.
3. Generate destructive replacement DDL through the repository tooling, including
   `task services-main:db:generate -- <name>`. Keep released migration files and
   hashes as historical artifacts. They do not require old tables, old rows or
   old API payloads to remain supported. Establish a reproducible empty-database
   installation whose final schema contains only the intended current contract.
4. Regenerate new API/SDK contracts and update affected internal clients, workers,
   filters, history/restore, search projections and tests together. There is no
   mixed-version or old-client support gate.
5. Qualify native/manual and four-source fixtures on the fresh target, including
   grouping/world-setting, fixed versus dynamic relations, privacy, revision and
   recovery behavior, target reference rejection and bounded locator rebuild.
   Run required schema replay, type checks, focused tests and capacity evidence.

**Track A acceptance:** the new integrated application installs and works without
any old data, old API or old schema dependency; all current-stage gates in `00`
pass. Old ID/address preservation and legacy migration rehearsals are not gates.
The approximately 400k transfer workload does not lower the 500M/3B design baseline.

## Track B — Separate offline conversion software

This track consumes the finalized target contract. Its implementation and
execution are separate work from the current schema milestone.

- Input: a frozen legacy export or read-only restored copy, schema/version
  metadata and any referenced asset manifest. Before capturing the final input,
  verify that background jobs and other writers are also stopped; the reported
  website shutdown is not independent proof that every writer has stopped.
- Output: new-contract records plus an explicit conversion manifest, never old
  tables or compatibility APIs installed in the target application. The tool
  may run near both databases, but it is not deployed as an application service.
- Every input record has a disposition: transformed/imported, deduplicated with
  recorded evidence, archived, or unresolved with a reason. Unknown/source-less
  catalog entries need no fabricated upstream provenance or Work/edition grain.
- IDs may be retained when useful or remapped. The conversion manifest maps old
  keys to the new owner/ID and rewrites selected relationships consistently.
  Old URLs, serialized payloads and old Auth/session formats impose no target
  compatibility obligation. Record which user/account/history categories are
  imported, archived or require a new session; do not silently invent values.
- Preserve the meaning and privacy of records selected for import under the new
  contract. Missing semantics remain explicit conversion issues; they must not
  cause fallback columns, old validators or old storage authorities in the app.
- Use deterministic batches/checkpoints and bounded transactions. Choose batch
  sizes from actual row widths/fan-out and measurements of the 400k input; no CDC,
  dual writing, zero-downtime catch-up or continuous replication is required.
- Validate target constraints, mappings, representative values, private state,
  source evidence and assets. Test an interruption/retry and repeat run without
  duplicates. These are offline-tool checks, not prerequisites for Track A.

A logical dump captures the old database representation; it does not transform
it into a different domain schema. PostgreSQL documents snapshot consistency,
restore formats and failure behavior in its [SQL dump guidance](https://www.postgresql.org/docs/18/backup-dump.html).
Keep the old dump as converter input/recovery evidence and let the separate tool
perform semantic transformation. Do not restore old DDL as the target model.

**Track B acceptance:** the selected frozen input is reconciled with the target
and conversion manifest; discrepancies have explicit dispositions. This proves
legacy transfer only, not four-source completeness or new-system capacity.

## Track C — Reopen the site

- Keep the site stopped while offline transfer and the chosen launch checks run.
  There is no final online write-freeze/catch-up phase to engineer by default.
- Install the matching new API, worker, Web and generated-client generation,
  rebuild new projections and verify target contracts. Old clients need not work.
  A failed deployment must not automatically restart old binaries against the
  new database; stay stopped or restore the matching new generation.
- Reopening is a distinct deployment decision after Track A and the selected
  Track B import, P10 operational recovery and relevant P12 acceptance. It is
  not performed merely because the schema implementation is complete.
- Recovery before reopening can rebuild the target and rerun the offline tool.
  After new writes begin, use new-contract backup/restore or forward repair;
  old database rollback or reverse compatibility is not a requirement. Preserve
  target-era data and reapply erasure/revocation decisions during recovery.

**Track C acceptance:** the intended new deployment and imported dataset pass
launch checks. It does not reintroduce legacy backward compatibility as a gate.

## Existing inventory tooling and evidence

`DATABASE_INVENTORY_URL=... task services-main:db:inventory -- local` (or
`production`) captures a repeatable-read, read-only inventory of public tables,
columns, foreign keys, indexes, extensions, allowlisted runtime settings and the
Atlas ledger. It excludes application rows and credentials; row estimates are
not exact record counts. Use a read-only credential and restricted output.

The earlier local inventory recorded 213 tables, 1,614 columns, 468 FKs, 718
indexes and 37 migrations, including 115 Profile and 11 Auth-user FKs. This is a
historical pre-refactor snapshot, not current production or a conversion proof.
Use inventory to find code dependencies in Track A and to describe converter
inputs in Track B. Neither usage imposes old-contract compatibility on the target.
The existing catalog-object caps (20k relations, 2M columns, 400k FKs/indexes)
are tooling bounds, not data capacity claims.

References: [deployment](../../operations/production-deployment.md),
[backup/recovery](../../operations/postgresql-backup-recovery.md),
[new-contract address semantics](../../architecture/unit-slug-addressing.md).
Legacy address-preservation clauses do not override this refactor's baseline.

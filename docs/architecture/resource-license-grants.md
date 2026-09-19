# Resource license grants

Status: Accepted

Owner: Resources

## Decision

Every registered license, dedication, or rights statement is an independent
declaration. The Resource grant ledger records that someone selected a legal or
rights instrument for a Resource at a point in time. That fact is not a finding
that the declarant had authority, is not itself proof of legal effect, and is
not a structural role such as publication or platform.

Creative Commons licenses, CC0, the Public Domain Mark, All rights reserved,
and the `REZICS Unit Content License` may exist together. The Public Domain Mark
records a claim that the work is already in the public domain; it is not a
license or a dedication. All rights reserved is a residual-rights
statement: when it sits next to a Creative Commons license, the Creative
Commons terms still grant the rights they name, and All rights reserved covers
only what those other instruments did not grant. Each REZICS License version
is likewise independent; the recommended ID is only the first-party default
for a new grant.

The ledger has three layers:

- Grant facts: grant identity, exact Resource reference, instrument ID/version, declared
  grantor Agent, recorded time and source/provenance. The private authorizing
  principal is retained in access-controlled audit.
  These never change.
- Current offering: an end time and responsible Agent. Null
  means the Resource still currently offers those terms. Ending an offering does
  not revoke rights already obtained under the instrument.
- Platform recognition: `recognitionStatus` is `recognized` or `invalidated`.
  Governance may move recognition on an open offering. It cannot revive an
  offering that the owner already ended.

Write APIs send `licenses` as the desired open offering set. Public `licenses`
return only open, recognized grants. Management reads must also return every
open offering and its recognition so an editor cannot silently end or
duplicate an invalidated row.

## Invariants

- At most one open offering exists per `(unitId, licenseId)`, including
  invalidated rows.
- Different license IDs never exclude one another.
- Grant facts are immutable. Offering end is write-once. Recognition moves
  only between `recognized` and `invalidated` on an open row.
- Instruments that require affirmative acknowledgement need the admitted grantor
  and authority evidence. Imported unknown grantor or selection time remains
  unknown; import/record time must not be relabeled as historical consent.
- `applicableUnitKinds` is a service check read directly from
  `LicenseRegistry` while the Resource row is locked. Every current instrument
  applies to every Resource kind, regardless of Resource ownership mode. Registry IDs
  and policy are validated by the API/service layer and are not mirrored in
  database `CHECK` constraints.
- Every grant, offering-end, invalidation, and restore path locks the Resource
  row first.

## Capacity

Workload assumptions for the grant ledger:

- Baseline: 500,000,000 Resources. Forward estimate: 3,000,000,000 Resources.
- Illustrative working set: most Resources carry 0–2 open offerings and a p99
  lifetime of 8 rows. This distribution is an assumption to measure, not a safety cap. Owners may re-grant after ending
  an offering, so historical rows grow with churn rather than with current
  offering count.
- At 2 open rows and 4 historical rows on 10% of Resources, the 500M baseline is
  about 1.2B rows. At the 3B estimate with the same mix, about 7.2B rows. This
  is a growth scenario, not a claim that one PostgreSQL node should hold it.
- A planning estimate of 100–150 bytes per heap row puts 3B grant rows at
  roughly 300–450 GB before table and page overhead, dead tuples, replicas,
  and backups. The primary key plus the three justified B-trees can add
  several hundred GB more. Measure actual `pg_relation_size` and index tuple
  width before selecting partition layouts; do not size from this estimate alone.
- Request paths are point lookups by `unitId` or an exists probe on
  `offering_ended_at IS NULL AND recognition_status = 'recognized'`. They must
  use those partial indexes. Facets group by `licenseId` on the same predicate
  and may return several IDs for one Resource.
- Write rate is owner-driven and bounded by Resource updates, not by corpus scan.
  Governance writes are rarer and also lock the Resource row. Hot Resources serialize
  on that row lock.
- The retained indexes are the primary key, open `(unitId, licenseId)`
  uniqueness, per-Resource `(unitId, grantedAt)`, and the effective
  `(licenseId, unitId)` search index. The previous grantor and open-recognition
  indexes had no distinct query to justify their write and storage cost.
- Place owner-local grant history and its Resource-forward index in appropriate
  same-database partitions. License discovery uses a selective effective inverse
  index/projection with explicit freshness. Measure heap/index growth, WAL, hot
  grant churn, replica lag and maintenance before selecting partition counts.
  Separate databases and live rebalancing are not selected by this target.

## Installation and evidence

The [1.8.0 license cutover](../releases/1.8.0.md) records the earlier 400,000-resource
migration, including unknown imported grantors and cutover timestamps. It is not
an instruction to recreate the retired global parent or rerun the conversion.
Current installation and recovery follow the recorded baseline and forward
migrations. Target acceptance covers immutable grant facts, exact authority,
concurrent offering uniqueness, recognition transitions and bounded historical
queries without treating a registry entry as proof of legal effect.

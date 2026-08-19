# Unit license grants

Status: Accepted

Owner: Units

## Decision

Every registered license or rights statement is an independent prior
authorization. `unit_license_grant` records that someone declared a legal
instrument for a Unit at a point in time. That fact is not a finding that the
declarant had authority, and it is not a structural role such as publication
or platform.

Creative Commons licenses, CC0, All rights reserved, and the REZICS Unit
content license may exist together. All rights reserved is a residual-rights
statement: when it sits next to a Creative Commons license, the Creative
Commons terms still grant the rights they name, and All rights reserved covers
only what those other instruments did not grant. Each REZICS License version
is likewise independent; the recommended ID is only the first-party default
for a new grant.

The ledger has three layers:

- Grant facts: `id`, `unitId`, `licenseId`, `grantedByProfileId`, `grantedAt`.
  These never change.
- Current offering: `offeringEndedAt` and `offeringEndedByProfileId`. Null
  means the Unit still currently offers those terms. Ending an offering does
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
- Instruments that require affirmative acknowledgement must have a grantor.
  A single declaration imported from the retired `unit.license` column
  has a null grantor and uses the cutover time because the old column retained
  neither the original actor nor the original selection time.
- `profileOwnedOnly` and `applicableUnitKinds` are service checks read
  directly from `LicenseRegistry` while the Unit row is locked. Every current
  License applies to every Unit kind. Registry IDs and policy are validated by
  the API/service layer and are not mirrored in database `CHECK` constraints.
- Every grant, offering-end, invalidation, and restore path locks the Unit
  row first.

## Capacity

Workload assumptions for the grant ledger:

- Baseline: 500,000,000 Units. Forward estimate: 3,000,000,000 Units.
- Observed working set: most Units carry 0–2 open offerings. A p99 lifetime of
  8 rows is an observation, not a safety cap. Owners may re-grant after ending
  an offering, so historical rows grow with churn rather than with current
  offering count.
- At 2 open rows and 4 historical rows on 10% of Units, the 500M baseline is
  about 1.2B rows. At the 3B estimate with the same mix, about 7.2B rows. This
  is a growth scenario, not a claim that one PostgreSQL node should hold it.
- A planning estimate of 100–150 bytes per heap row puts 3B grant rows at
  roughly 300–450 GB before table and page overhead, dead tuples, replicas,
  and backups. The primary key plus the three justified B-trees can add
  several hundred GB more. Measure actual `pg_relation_size` and index tuple
  width before selecting shard counts; do not size from this estimate alone.
- Request paths are point lookups by `unitId` or an exists probe on
  `offering_ended_at IS NULL AND recognition_status = 'recognized'`. They must
  use those partial indexes. Facets group by `licenseId` on the same predicate
  and may return several IDs for one Unit.
- Write rate is owner-driven and bounded by Unit updates, not by corpus scan.
  Governance writes are rarer and also lock the Unit row. Hot Units serialize
  on that row lock.
- The retained indexes are the primary key, open `(unitId, licenseId)`
  uniqueness, per-Unit `(unitId, grantedAt)`, and the effective
  `(licenseId, unitId)` search index. The previous grantor and open-recognition
  indexes had no distinct query to justify their write and storage cost.
- When measured heap, index, WAL, replica-lag, or maintenance thresholds show
  that one node will not carry the next growth interval, shard by `unitId`
  before reaching that interval. Per-Unit reads and writes then route to one
  shard; global license discovery and facets query the effective index on each
  shard or a derived search index. Rebalancing is a keyset copy by UUIDv7 with
  bounded batches and backpressure.

## Cutover

This release uses a maintenance-window cutover because production has about
400,000 Units, the retired `unit_content_license` table is expected to be empty, and no
old/new application compatibility window is required. One file transaction:

1. Asserts that the retired `unit_content_license` table is empty, then reshapes it
   into the unified ledger.
2. Imports every non-null `unit.license` with an unknown grantor and the common
   cutover timestamp.
3. Builds the three justified indexes, validates constraints, and drops the
   retired column.

The application remains stopped for writes until the transaction commits. Any
failure rolls the entire schema and data change back. Before release, replay
the file on a production-shaped snapshot, record duration and peak WAL, and
confirm the effective and per-Unit queries with `EXPLAIN (ANALYZE, BUFFERS)`.

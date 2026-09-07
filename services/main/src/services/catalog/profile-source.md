# Source-owned fixed profiles

Entity and Reference keep their existing native profile histories. A profile
revision records either validated fixed values or explicit removal; source
receipts never stand in for native values. Concrete source-occurrence foreign
keys identify the exact profile revision, including after root source rebinding.
The first occurrence for an identical snapshot/owner remains immutable. Repeated
apply/withdraw cycles resolve that occurrence to the latest compensated native
revision through one indexed baseline lookup.

`writeCatalogSourceProfile` uses the owning initializer/removal command and
checks the exact current profile revision. A mapper must merge the fields it
actually owns with independent current fields before calling it. Whole-profile
conflicts require review. Removal retains identity/history and does not cascade
through dependent area codes, places or other objects; those concrete foreign
keys require separately reviewed native graph operations first.

The application journal references both native revisions through owner-specific
foreign keys. Baseline publication verifies the original immutable source
occurrence, the current profile head and the exact application. A typed source
withdrawal may preserve intervening changes to other object components because
its owning inverse checks its own child revisions. Commands without a typed
component journal retain the aggregate revision fence.

## Workload and capacity

Assume 100 source-profile changes/s, a read-heavy 1,000 profile reads/s, a 1 KiB
mean history value, and 100-row history pages. Entity snapshots are capped at
32 KiB and Reference snapshots at 128 KiB; the means require representative
source-distribution measurement. One current point read, one ordered native
history seek, and one source/baseline lookup remain bounded independently of
profile lifetime. History and baseline primary keys include their owning native
or source key. Source families have 64 hash partitions and are routed by source
record; native histories need owner-routed placement for a future shard cutover.

| Growing family | Planning bytes per row with indexes | 500M rows | 3B rows |
| --- | ---: | ---: | ---: |
| Native profile history | 1,120 | 560 GB | 3.36 TB |
| Source occurrence | 256 | 128 GB | 768 GB |
| Current source baseline | 480 | 240 GB | 1.44 TB |
| Native application change | 192 | 96 GB | 576 GB |

These are per-family estimates, not a claim of one row of every family per
profile. Replication plus 30% reserve multiplies live storage by 3.9 for three
copies; payload skew, WAL, vacuum and index bloat are additional measured costs.
A change appends native history, source/application evidence and outbox records,
then updates its baseline. Reusing immutable source evidence does not append it
again. Source and native owner locks serialize a hot key; a 10 ms transaction
permits at most roughly 100 serial changes/s for that key. Pause on the existing
queue/byte limits or p95 lock wait above 100 ms. Sharding must preserve validated
source-to-native reference integrity instead of dropping foreign keys.

The ordinary application remains limited to 128 native changes. Staged larger
applications and representative 500M/3B deployment throughput are separate open
qualification gates. This slice does not certify them.

## Evidence

`scripts/check-catalog-profile-source.ts` runs 30 PostgreSQL assertions across
Entity/Reference and three apply/withdraw cycles each. It checks exact source
baselines, source evidence immutability, restoration of prior absence, protection
of independent fixed-value edits, and preservation of independent names. All
fixture rows roll back. The fixture uses the real Auth/Self-Entity admission
and participation policy. Backend and script TypeScript checks are separate
code-integrity checks; this is not rendered frontend acceptance.

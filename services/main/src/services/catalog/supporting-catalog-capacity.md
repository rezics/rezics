# Supporting catalog: semantics, cost and qualification

The native entity profile describes a person, organization, collective, imprint,
fictional character, unresolved catalog entity, or explicit platform service actor.
An entity does not create or grant an Auth account. Labels are not automatically
companies: the imprint and the company controlling it may be different identities.
Character existence dates concern the real-world concept; fictional birthday,
sex, gender, measurements and their spoiler scopes are governed claims.

Reference profiles describe geography, physical places, instruments, events,
named classification concepts and network resources. A URL resource is distinct
from the relationship linking another catalog object to it. A genre or mood is
a named concept classified by governed definitions, not a new provider table.
The same commands accept manual authoring and independently mapped sources.
Source binding owns matching and reviewed promotion of untouched references;
neither a matching name nor an external code silently merges identities.

Primary conformance evidence consulted on 2026-09-07:

- [MusicBrainz Artist](https://musicbrainz.org/doc/Artist): persons, ensembles,
  characters and exact existence-date meaning.
- [MusicBrainz Label](https://musicbrainz.org/doc/Label): imprints versus companies.
- [MusicBrainz schema](https://musicbrainz.org/doc/MusicBrainz_Database/Schema):
  supporting entities, aliases, annotations and relationships.
- [VNDB Kana](https://api.vndb.org/kana): producer types, staff alias IDs,
  character fields and contextual credits.
- [Bangumi API](https://bangumi.github.io/api/): distinct Person/Character sources.

## Bounded workload

Capacity planning applies to each corpus-scale relation, including history:
500,000,000 rows baseline and 3,000,000,000 rows estimate. There is no whole-corpus
closure, whole-owner snapshot, in-memory lifetime collection, or offset paging.

| Relation | Access and growth | Approximate allocation per row | 500M / 3B |
| --- | --- | --- | --- |
| Entity profile | One owner PK read/update; five optional reverse classification/area indexes | 200-byte heap + 6 x 48-byte index entry | 244 GB / 1.464 TB |
| Reference profile | One owner PK; one or two type/area indexes | 160-byte heap + 3 x 48-byte entry, excluding large address/setlist TOAST | 152 GB / 912 GB |
| Fixed profile history | Owner/revision keyset; actual edit count H, never N times an assumed unlimited version count | 1,024-byte typical snapshot + 64-byte heap + 48-byte key | 568 GB / 3.408 TB |
| Group order entry | Owner/profile/position/relation keyset and owner/relation lookup | 128-byte heap + 3 x 64-byte entries | 160 GB / 960 GB |
| Group command history | One command row per class/order edit; fixed payload | 320-byte snapshot/heap + 48-byte key | 184 GB / 1.104 TB |

These are capacity estimates, not measured physical allocation or throughput.
Replication, WAL, fill factor, dead tuples, backup copies and TOAST are additional.
If average retained history is 4 edits per identity, its row/storage demand is
4 times the identity count, not the per-relation totals above. Account separately
for multi-name, relationship participants and source evidence owners.

At 1,000 accepted profile edits/second with 1 KiB snapshots, logical history growth
is approximately 88.5 GB/day before index/WAL/replication amplification. Admission
must be bounded by disk/retention and source-worker concurrency, not an unbounded
memory queue. Interactive calls write one fixed profile; area-code batches accept
at most 128 entries. Readers return at most 100 entries. A 100-row typical history
page is approximately 100 KiB; the hard entity snapshot bound is 32 KiB and
reference snapshot bound is 128 KiB, so worst-case pages are larger and must fit
the API transport budget. Exporters should choose smaller history page sizes.

UUID owner equality or owner-first tuple keyset keeps lookup work O(log N + page).
Names, relations, codes and orders are separate paged streams. Updating one order
entry does not serialize its siblings into a snapshot. Source arrays are ingestion
batch limits, not lifetime catalog limits. Code namespace/value is not globally
unique because historical/reused identifiers are possible.

Owner identity optimistic locking serializes writes for one hot owner. If an
owner transaction holds its lock for 10 ms, that owner cannot exceed approximately
100 writes/second, regardless of server-wide throughput. Workers must retry stale
versions with bounded backoff, avoiding concurrent fan-out into the same owner.
Operational admission should track lock latency, stale-write retries, WAL lag,
disk utilization and request payload bytes. The next step for a consistently hot
grouping is independent order-profile heads and partitioned command histories,
with shared authority locks as already used by software participation contexts.
That redesign requires explicit migration; this implementation does not claim
unlimited throughput for one franchise or automatic production qualification.

For 3B-row operation, cut over the largest owner-scoped history and adjacency
tables to owner-hash partitions or owner-routed shards before index maintenance
or backup windows exceed SLOs. Composite owner keys already retain locality;
do not introduce cross-shard unique source identifiers. Route cross-owner reads
through the established logical owner reference protocol. Track approximately
20% free storage, bloat and vacuum lag rather than assuming static row allocation.

## Verification boundaries

`entity-contracts.test.ts` checks shape distinctions, leap dates, byte bounds,
coordinate pairs, local times and unknown states. `check-catalog-supporting.ts`
is a rollback-only disposable-PostgreSQL harness for concrete foreign keys,
read/write authorization, optimistic conflicts, immutable history, restore,
independent ordering, withdrawn membership visibility and selective indexed reads
with competing area identities. This fixture is planner and behavior evidence;
it does not extrapolate toy-row throughput to 500M/3B production rows.

Grouping history restores a selected local command as a new authorized edit.
It does not present arbitrary historical full-graph state or provide an atomic
multi-page historical graph head switch. Membership support/history remains owned
by governed relations; ordering never revives a withdrawn membership. Name,
identifier and authority histories remain with their own commands.

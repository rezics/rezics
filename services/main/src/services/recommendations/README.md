# Recommendations

## Private exclusions

A private exclusion is keyed by Auth account and immutable `reference_value`.
It stores no duplicate native UUID or per-owner target columns. The restrictive
reference FK preserves the native anchor; reference values are shared with other
consumers and remain after an account removes its choice.

The API accepts native target IDs and validates tracking signatures and event
time. The command rechecks account write eligibility, sign-in state and the
captured Self binding in its transaction. Personal reads use the actual Self
rather than a selected organization grant. Current resource read authority is
checked before allocating a reference or storing an exclusion/event. Removing
an exclusion requires current account authority but no current target visibility;
an absent choice does not create a reference value.

Feed and recommendation predicates use the same account/reference join and the
indexed native-ID expression. An inactive or erased Self binding stops private
filter traversal before asynchronous erasure drains the rows. Cleanup remains
Auth-indexed and bounded by the existing erasure worker. No public API accepts an
arbitrary account whose exclusions should be read.

Merged native targets remain forbidden for new live exclusions. The merge guard
decodes a canonical reference before consulting the reviewed redirect, including
references created in the same data-modifying statement. Its native-ID projection
is not a permission check. Tracking events retain their separate native-ID
storage until their own reference-consumer qualification.

## Workload and scale

Use the 500,000,000-row baseline and 3,000,000,000-row estimate. Plan 100 exclusion
writes/s, 10,000 predicate evaluations/s normally and 500,000/s at peak across
caller candidate sets. These are workload assumptions. Point-lookup and mutation
targets are 5 ms and 200 ms p95 respectively, excluding transport. Caller candidate
budgets and sparse-filter scan behavior still require their Search/feed workload
qualification; a returned-page limit does not bound all predicate evaluations.

The 10,010-row fixture measured a 72-byte mean tuple, 794,624 heap bytes
and 1,032,192 index bytes across its two composite indexes. Budget 80 heap plus
144 index bytes including ordinary page headroom: 112 GB at 500M or 672 GB at 3B,
before WAL, replicas, bloat and maintenance copies. A first target use additionally
allocates one shared reference, budgeted at 112 heap plus 216 index bytes in the
foundation model. If 10% of choices introduce distinct references, the combined
standalone envelope is 128.4 GB/770.4 GB; do not charge those shared references
again to every consumer. Use the full lifetime target union when retention or
sharing differs from that scenario.

An existing choice needs indexed reference and account-key probes. New allocation
uses the qualified lookup/unique-conflict/relookup protocol. The private filter
adds indexed reference and binding joins, not application-level per-item requests.
Monitor buffers, predicate latency, reference allocation rate, erasure backlog and
hot-account contention. Random I/O and relation/index maintenance at these scales
may require account-routed partitions plus a qualified shared-reference lookup
service; preserve concrete target integrity and cursor/recovery behavior before
such a cutover. The local fixture measures a 10,000-row hot set and index plans,
not production throughput or complete recommendation-generation acceptance.

[Foundation verification](../../../../../docs/testing/foundation.md#private-recommendation-exclusion-references)
records executable SQL/API, merge-guard, revocation, erasure and query-plan evidence.

## Snapshot builds

`build-partitions.ts` admits at most one building snapshot and 64 durable partition
jobs. Workers read the matching physical hourly-signal child, process up to 4,096
positive rows, and commit score updates with the complete time/identity/kind
cursor under a current lease generation. An exact full batch remains pending
until a subsequent empty page proves completion. A failed batch changes neither
scores nor progress; failure recording schedules bounded backoff. Ready scores
are immutable. Activation requires all 64 jobs to be done and atomically replaces
the active pointer, preserving the old ready generation while its replacement is
partial or failing. Projection rows never provide canonical identity or read
authority; online readers retain their own current-policy checks.

[Generation qualification](../../../../../docs/testing/recommendations.md) covers
native setup, partial score accumulation, lease reclaim/replay, two-generation
failure recovery, same-lease contention and natural sparse-index selection.
The fixture caps each drain at 128 pages and labels forced plans as diagnostics.

At the 500,000,000-row baseline and 3,000,000,000-row estimate, let R be the
positive rows in the seven-day window. The minimum scan work is ceil(R/4096)
batches, plus partition rounding and empty terminal pages; score writes can
involve up to 4,096 distinct native identities per batch. Each worker's current
one-second schedule admits up to four batches per tick. Ignoring I/O and contention,
500M/3B positive rows need at least 122,071/732,422 batches, or 8.48/50.86 worker-hours.
Meeting the two-hour build deadline therefore needs at least 5/26 ideal workers;
a 10% positive fraction lowers that arithmetic to 1/3 workers. These are optimistic
lower bounds, not a deployment recommendation. Actual claims, distinct-identity
fan-out, skew and database capacity must be measured before accepting the deadline.

Sixty-four control jobs bound coordination, not corpus cost. The local timings
cover three hot-bucket score targets and cannot qualify large distinct-target
batches. Monitor oldest build age, scanned rows/sec, lease/failure counts and active
snapshot age; the current health threshold is three hours. If throughput cannot
meet the two-hour deadline, the old snapshot remains active and the build fails.
Qualify more workers/read-write capacity first; a new physical partition layout
requires corresponding schema, routing and policy qualification. Storage/WAL,
retention, online privacy and recovery at 500M/3B remain explicit acceptance work.

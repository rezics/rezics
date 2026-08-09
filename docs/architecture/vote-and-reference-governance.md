# Vote and reference governance

## Decision

A binary vote is a fact, not a lifecycle state. Its persisted value is `-1` or
`1`; absence of a row means that the Profile has not voted. APIs must not turn a
score threshold into a generic `accepted` boolean.

The canonical presentation for a binary vote target is:

```text
voteSummary = {
  positiveCount,
  negativeCount,
  score,
  voteCount,
  viewerVote,
  asOf
}
```

`score = positiveCount - negativeCount` and
`voteCount = positiveCount + negativeCount`. Every binary aggregate table
enforces `abs(score) <= voteCount`, `voteCount >= 0`, and matching score/count
parity. The presenter rejects corrupt aggregates rather than rounding them.
`viewerVote` is `-1`, `1`, or `null`; `asOf` is the aggregate update time and is
`null` for an empty tally.

This contract is now used by Unit Alias and Unit External Link resources and by
Alias, External Link, and Unit Tag vote mutations. Other binary-vote read
surfaces keep their existing true vote facts while they are migrated at an
explicit public-API boundary; none may add a generic derived `accepted` state.
Domain-specific words such as an accepted invitation remain valid because they
describe a persisted workflow transition, not a score interpretation.

## Policy and ranking are separate

Wilson lower-bound confidence orders unpinned references. The stable tie-break
order is confidence, score, vote count, then UUID. Pinning is explicit Unit
curation and precedes community ranking. It does not change vote totals.

Visibility and eligibility remain domain policy:

- a newly proposed external link is active and visible immediately; the Unit
  detail preview shows the first 16 ranked active links;
- an Alias needs a score of at least `3`, or an explicit pin, to contribute to
  search text; this threshold affects discovery only and is not returned as a
  state;
- Tag and Structure acceptance rules remain their documented domain rules and
  do not become a shared vote status; and
- withdrawn references are excluded from lists, previews, votes, curation,
  requirement sources, and Alias search documents, while their identity, vote
  history, and audit history remain stored.

The complete vote-domain boundary is:

| Target | Authority | Shared binary tally | Policy use |
| --- | --- | --- | --- |
| Unit Alias | global Profiles | yes | rank every active Alias; score `>= 3` or pin admits search text |
| Unit External Link | global Profiles | yes | rank every active link; no visibility threshold |
| direct/effective Unit Tag | global Profiles | yes | rank the bounded Tag landscape; curation is stored separately |
| Structure definition | global Profiles | yes | positive score is the domain validity rule |
| Structure application | global Profiles per Unit | yes | positive definition and application scores are both required for presentation |
| Realm Tag on Unit | Profiles within one Realm | yes | rank only inside that Realm and its enabled voting context |
| Poll option | poll participants | no | option membership/count semantics and result-visibility policy remain Poll-owned |
| Review score | review author | no | bounded numeric rating, not a `-1/+1` vote |

This matrix prevents a shared transport shape from silently sharing policy or
authority. A global vote must never be merged with a Realm-scoped vote, and a
curator pin must never be counted as a positive vote.

Every active Alias or External Link list is capped at 128 references per Unit
and kind, with at most 16 pinned references. PostgreSQL triggers enforce both
limits for direct writers; the API performs the same checks under the same
per-Unit advisory lock so callers receive typed conflict responses. Withdrawal
is the capacity-release operation. Lists use opaque, version-bound cursors with
pages of 20 by default and 50 at most. A vote, proposal, curation change, or
withdrawal can change rank, so the client restarts pagination after such a
mutation. Each cursor also binds a SHA-256 fingerprint of every active ranking
tuple; a concurrent vote that changes ordering invalidates the next page rather
than allowing a duplicate or omission.

## Workload assumptions

The capacity baseline applies independently to every corpus-scale reference,
vote, and aggregate relation. Planning uses 500,000,000 rows per relation and
also estimates 3,000,000,000 rows. The active per-Unit set is strictly bounded;
withdrawn history and vote facts are not.

The planning workload is:

- 90% reads and 10% writes at the reference API boundary;
- ordinary list pages of 20, maximum pages of 50, and an application ranking
  input of at most 128 active rows;
- cluster-wide targets of 20,000 vote writes per second and 100,000 reference
  reads per second after horizontal API scaling;
- a service-side p95 target of 100 ms for a warm reference list and 150 ms for
  a vote mutation, excluding internet latency;
- a typical vote distribution with most targets below 100 votes, a long tail
  above 10,000 votes, and adversarial hot keys; and
- seven supported content languages, so refreshing one Unit Alias search
  document reads a bounded localization set plus no more than 128 active
  Aliases.

These are capacity assumptions, not production measurements. Deployment load
tests must replace them with observed rates and distributions.

## Request and write costs

The active list query uses the partial
`(unit_id, pinned, position, id) WHERE withdrawn_at IS NULL` index, reads no
more than 129 reference rows, and performs indexed joins to one aggregate and
one viewer-vote row per reference. Application work is `O(128 log 128)` with a
small fixed memory ceiling. A page returns at most 50 summaries; the server
does not use offsets or retain a corpus-sized cursor set.

Capacity and pin checks stop after 128 and 16 matching index entries. They do
not execute `count(*)` over an unbounded Unit history. The advisory-lock key is
partitioned by `(Unit, reference kind)`, so unrelated Units and Alias/External
Link collections remain concurrent. One exceptionally active Unit can only
serialize its own reference creation or pinning.

A new vote writes one fact row and one aggregate row. Changing a vote updates
the aggregate once by `newValue - oldValue`; no-op writes are suppressed. Alias
aggregate changes also refresh one Unit search document. This is bounded by the
active-reference and language limits, but votes on the same target still
serialize on its aggregate row. Backpressure comes from the API quota layer and
the database connection-pool bound; callers retry transient conflicts with
jitter rather than opening an unbounded queue.

## Storage and growth math

The following deliberately conservative figures include heap tuple overhead
and primary lookup indexes, but exclude free-space headroom, WAL, replicas,
backups, and variable TOAST effects:

| Relation shape | Planning bytes/row | 500 million | 3 billion |
| --- | ---: | ---: | ---: |
| binary vote fact | 144 B | 72 GB | 432 GB |
| binary aggregate | 104 B | 52 GB | 312 GB |
| Alias plus lookup indexes | 480 B | 240 GB | 1.44 TB |
| External Link plus lookup indexes | 770 B | 385 GB | 2.31 TB |

Provision at least 30% free space beyond heap and indexes, plus separate WAL,
replica, backup, and concurrent-index-build capacity. The External Link estimate
assumes an average normalized URL of 160 bytes; URL distribution must be
remeasured before capacity procurement. Updating a vote produces roughly one
fact-index update, one aggregate-indexed heap update, trigger WAL, and (for an
Alias score change) one bounded search-document replacement.

At 500 million rows, B-tree fan-out keeps equality seeks shallow and the active
partial indexes remain proportional to active references, not withdrawn
history. At 3 billion rows, each corpus relation must be partitioned or sharded
before a single node approaches its storage, vacuum, checkpoint, or index-build
budget. The natural routing keys are:

- hash `(unit_id)` for Alias, External Link, and Unit-scoped Tag votes;
- hash `(target reference id)` for their vote facts and aggregates, colocated
  with the reference owner where possible; and
- hash `(realm_id, unit_id)` for Realm Tag votes.

UUID cursors and immutable IDs survive this cutover. Global uniqueness remains
application-generated; no request requires a cross-shard scan. Withdrawn
history may be moved to a cold partition after its retention window without
changing active API behavior.

## Evidence and operational thresholds

Migration replay and schema reconciliation validate the partial indexes and all
constraints. A disposable PostgreSQL 18.4/PGroonga 4.0.8 fixture used 100,128
Alias rows across 10,001 Units, including one Unit at the exact 128-row limit.
The 129th row was rejected by `unit_reference_active_limit`.

On that fixture, `EXPLAIN (ANALYZE, BUFFERS)` for the 128-row list used one
bitmap scan of `unit_alias_unit_position_idx`, touched six shared buffers, and
completed in 0.131 ms. The bounded capacity read used the same index and six
buffers, completing in 0.040 ms. The 100,128-row Alias relation occupied 33 MB,
of which the active-position index occupied 9,328 KiB. This evidence validates
the access shape, not the 500-million-row latency estimate; pre-production load
tests must use production row widths, cache pressure, concurrency, and skew.

The synchronous aggregate design has a known same-target hot-key ceiling. Begin
the asynchronous cutover when any of these holds for five minutes:

- one target sustains 100 vote writes per second;
- aggregate-row lock wait p95 exceeds 25 ms;
- vote-mutation p95 exceeds 150 ms while connection-pool utilization exceeds
  80%; or
- WAL or replica lag breaches the deployment SLO.

The cutover is a partitioned vote-event outbox keyed by target ID, idempotent
micro-batch reducers, and a versioned aggregate watermark exposed through
`asOf`. Dual-write and reconcile before switching reads; retain the synchronous
trigger until aggregate parity and lag stay within the approved window. At
3 billion rows, partition creation, vacuum budgets, and cold-history archival
must be complete before promotion. Crossing a threshold without that cutover
is an explicit maintainer-approval condition, not an accepted steady state.

## API and migration cutover

This is a breaking public-contract release: product version `1.4.0` and API
client version `1.8.0`.

1. Deploy clients that read `voteSummary` and do not use `accepted`, flat
   reference vote fields, or a `candidate` resource name.
2. Pause writes or drain the old API binary. Apply
   `20260809000000_vote_reference_contract.sql` followed by
   `20260809000001_vote_reference_indexes.sql`; nullable columns are metadata
   only, parity constraints are added `NOT VALID` before transactional online
   validation, and replacement indexes build concurrently in the second step.
3. Deploy the new API and frontend together. Old binaries are incompatible
   with the new response shape, pagination, and withdrawal endpoint.
4. Verify reference-limit conflicts, cursor invalidation, aggregate parity,
   search exclusion after Alias withdrawal, lock waits, and replica lag.
5. Resume writes. Rollback requires the previous binary and a database restore;
   the public contract and withdrawn-reference lifecycle do not have a mixed-
   version compatibility alias.

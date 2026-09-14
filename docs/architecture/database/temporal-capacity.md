# Rating and event-time workload envelope

This is the selected operating design for [ratings](ratings.md) and
[event discovery](event-time.md). All figures below are planning assumptions,
not measured throughput or storage. [Generated capacity](capacity.md) supplies
reproducible row-role arithmetic at **500,000,000** and **3,000,000,000** roots,
plus those same standalone row baselines for every modeled growing relation.
The rating scenario root is an observation; the event-time root is a concrete
event. Neither scenario is added to the existing social/catalog mix without
deduplicating shared identity, reference, revision and projection roles.

## Cardinality and storage

Rating assumptions per observation: 0.001 context/revision equivalents, one identity/slot row, 1.25 immutable
revisions, one effective head, 0.1 per-rater current-summary rows, 0.8 per-rater
day-summary rows and 0.02 target/context/day histogram rows. The latter two
assume some same-day repeated experiences and at least 50 observations per
occupied target/context/day on average. Sparse tails can instead approach one
row of each type per observation; measure that upper sensitivity. Each summary
stores the policy/scale/generation in its key or payload. The estimate includes
one active projection generation; a concurrent full rebuild can double projection
storage, not observation history. Count retained retired generations separately.
The context ratio assumes 1,000 observations per definition/revision equivalent;
independent 500M/3B sizing still applies because user-managed contexts have no
global fixed cardinality guarantee. Admission limits do not remove their storage.

Event assumptions per concrete event: one native identity/profile, two temporal
claim/revision equivalents, 1.5 effective temporal-role projection rows and 0.25
named-topic binding rows. Actual versus planned times and multiple temporal roles
explain projection amplification. These averages are not hard limits. Topic
applications, participant occurrences, repeated event identities and source
evidence add their existing domain costs; no all-posts date copy is assumed.

The generator records heap/index width allowances per role. Replace them with
`pg_column_size`, relation/index sizes and observed revision/rater/day density
before physical acceptance. Include reference bridges, audit/receipts, WAL,
replicas, backup, vacuum, indexes, exact citation registrations and source data
without double-counting the shared workbook roles. Wider `bigint` counts and
fractional per-rater representatives are part of the payload allowance.

At one million new observations/day, a year adds 365 million observations and
456.25 million revisions under the 1.25 assumption. The observation baseline is
reached after 500 days and 3B after 3,000 days. At ten million/day those horizons
are 50 and 300 days. Daily participation is therefore not bounded by the number
of catalog objects. Do not preallocate person/target/day matrices or periodically
copy every standing score. Sparse insertion follows intentional activity only.

## Access paths and bounded work

Observation keys include target/context, private counting identity and slot.
Partition rating facts initially by a stable hash of target, context and counting
identity with all partition columns in uniqueness keys; co-locate a person's
series and its revision/head writes. A bounded context directory routes reads
to the fixed partition set. A single target can span partitions without weakening
per-rater uniqueness. Do not time-partition facts and claim a global uniqueness
constraint that omits the partition time. Retention follows paged indexed history
cleanup or a separately qualified archive design, not unsafe partition drops.

Required rating indexes serve observation/slot uniqueness, exact revisions,
per-rater evaluation-time ordering, submission cohorts, target/context/time
candidate scans and account erasure. Use an indexed latest-head probe after
withdrawal/correction; do not scan a person's complete history on every write.
Summary caches retain explicit suppression state so an older score cannot
reappear when the latest becomes private. Summaries remain rebuildable, never
independent score authorities.

Incremental work updates one observation and its affected old/new per-rater
period states. Striped target/context/day histograms avoid one synchronous global
counter. A rater changing a previously selected representative contributes an
idempotent subtract/add delta. Context definition changes invalidate one generation
and queue paged work, rather than updating every observation in the foreground.
Redistribution and current-authority checks must preserve fractional means and
separate people/observation counts.

Exact arbitrary-range mean-per-rater and distinct-rater queries cannot sum daily
global histograms. Common admitted windows use maintained per-rater summaries
and materialized generations. Other exact ranges run as bounded background jobs
with context/range/policy/visibility input manifests, progress and cancellation.
Large all-time results use published generations. Pending is a first-class API
result; returning a partial prefix as the complete aggregate is forbidden.

Event indexes comprise owner-key lookup, scoped typed start/key B-trees,
range GiST candidates, accepted Tag-to-event forward/reverse binding indexes
and participant reverse paths. Instant and civil-date projections have separate
typed contracts. The Filter compiler chooses temporal-first or Tag-first
candidate plans and bounds residual certainty/authority checks. Chronological
sorting after GiST candidate generation also consumes the budget. Event-to-post
fan-out uses existing Tag application inverses and bounded hydration, not an
unbounded foreground update of every matching post.

Initial request budgets to qualify:

| Operation | Admission and work bound |
| --- | --- |
| Rating timeline | At most 10 targets, one context/scale and 400 returned buckets per request; no more than 4,000 target/bucket cells. Larger ranges use coarser display grain, continuation or an explicit export. |
| Rating contributor/history page | At most 50 returned rows, 5,000 examined candidates and a 1.5-second statement deadline; cursor records examined progress and incomplete state. |
| Exact custom aggregate | Admit to background once projected work exceeds 50,000 rater-period rows or the 1.5-second request budget; no silent estimator substitution. |
| Event query | At most 50 results, 4,096 examined candidates, 50,000 estimated postings and the existing 1.5-second Filter deadline. Exhaustion returns continuation/partial, not a complete empty result. |
| Foreground edit | One observation or event revision per command; explicit bounded batch API required for more. No network request or unbounded reverse traversal while holding locks. |
| Projection worker | At most 500 source/rater rows per page, 20-second transaction deadline, fenced lease and committed cursor; each page retries idempotently. |

Partition routing and backend query contracts must make these limits observable.
They are initial acceptance inputs, not production SLO achievements. Large jobs
use finite per-account/context/global admission queues and storage reservations;
exhaustion returns retryable backpressure. Exact queue sizes are deployment
configuration qualified against the measured worker drain rate before activation.

## Concurrency, freshness and recovery

Qualify at least 100 mixed reads/s, 20 foreground writes/s, 32 concurrent clients
and a fivefold burst, plus a one-million-observation/day sustained ingest scenario
(about 11.6 new observations/s before corrections). Include one context/target
receiving 50% of writes, a prolific rater, sparse targets, hot event dates and a
named event referenced by millions of posts. Measure the ten-million/day case
separately (about 115.7 new observations/s). None is inferred from a toy fixture.

Per-operation costs include fact/revision/head writes, all selected indexes,
one bounded dirty-work receipt, sufficient-statistic deltas and any projection
generation. Measure `pg_stat_wal` and index/heap bytes for creation, correction,
repeated same-value submission, redate, withdrawal and visibility change. Read
memory is bounded by page/cell budgets and admitted concurrent jobs; no worker
loads a full corpus or all people for a popular target into process memory.

Initial non-security freshness objective is 60 seconds; monitor queue oldest age,
arrival/drain rates, retries and failed generations. Permission reductions are
fenced immediately and may make a result unavailable until its safe generation
is ready. Retain the previous generation on computational failure only when it
remains safe for current disclosure. Historical exports bind both recorded cut
and current erasure frontier. Restore canonical facts first, replay privacy
frontiers, rebuild projections and then admit public queries.

Alert on 70% provisioned storage, sustained queue age above 60 seconds, worker
drain below arrival rate, p95 request latency above the admitted deadline,
growing lock waits or replica lag beyond its declared budget. First throttle
admission and postpone expensive custom aggregates; add independently fenced
workers when the database can support them. Rebuild indexes/partitions and
archive eligible history through verified paged protocols. A further physical
shard split requires target/context/rater routing and FK/reference qualification;
adding application workers alone is not that solution.

Acceptance records p95/p99, errors, backpressure, hot-lock contention, storage,
WAL, replica lag, cold/warm plans, index rebuild and full recovery time. Validate
the 500M baseline and 3B estimates against the elected hardware and recovery
objectives. A throughput or RTO limit remains explicit pending qualification;
capacity arithmetic cannot close it.

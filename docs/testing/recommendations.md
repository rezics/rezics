# Recommendation generation qualification

Run `task services-main:db:recommendation-build:check` on an installed disposable
Atlas target with empty recommendation snapshot/signal lanes. The
[fixture](../../services/main/scripts/check-recommendation-build.ts) creates actual
Self authority and native Post, Publishing and Entity identities. It refuses an
existing fixture function, never disables native integrity checks, removes only
its injected failure trigger/function, and retains its generated data.

The [pinned native run](database/recommendation-build-evidence.json) passes 748
assertions. It checks both 64-way HASH(unit_id) layouts, non-finite/negative weight
rejection, distinct SKIP LOCKED claims, expired lease generation replacement,
score/cursor rollback on an injected SQL failure, replay rejection, exact scores,
immutable ready scores and atomic activation after all 64 partitions finish.

The first historical-hour generation consumes 4,141 positive rows in batches of
4,096 and 45. A newer generation is admitted by the actual command and excludes
45 rows at the old window boundary. Its 4,096 positive rows require an empty
terminal page. An injected failure in that second build leaves the previous active
snapshot and its scores unchanged. The real failure/backoff path is resumed;
two connections then race on the same lease. Both are observed behind the exact
partition holder, one directly or through the other waiter; exactly one writes
the batch, and the other returns stale. The newer snapshot then activates.

A 34,560-row zero-weight background makes the positive predicate selective. The
natural plan uses the positive-weight index through a bitmap scan and sorts its
4,141 candidates, returning 4,096 rows with 103 shared buffers. Forced-index probes
are separately identified as diagnostics; they are not the planner's natural
choice or evidence of production throughput. Each diagnostic transaction uses a
pinned PostgreSQL connection. The three positive hot-bucket identities exercise
repeated accumulation, not the maximum 4,096 distinct-identity fan-out of a batch.

The fixture observes both hard blockers and the known waiter chain, following
[PostgreSQL's blocking-PID semantics](https://www.postgresql.org/docs/18/functions-info.html).
Backend TypeScript passes. No production schema/runtime change is part of this
qualification. The earlier unfinished second-snapshot observation is closed by
these executable cases; worker scheduling, online disclosure, retention, failure
exhaustion, admission backpressure, process/restore drills and 500M/3B workloads
remain in M09.

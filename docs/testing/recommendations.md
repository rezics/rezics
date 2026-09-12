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
these executable cases. The lifecycle section below qualifies dispatcher, retention
control, failure exhaustion and admission pressure. Host scheduling, online
disclosure, large backlogs, process/restore drills and 500M/3B workloads remain in M09.

## Retention and runtime lifecycle

`task services-main:db:recommendation-lifecycle:check` runs
[check-recommendation-lifecycle.ts](../../services/main/scripts/check-recommendation-lifecycle.ts).
The [pinned run](database/recommendation-lifecycle-evidence.json) passes 175 assertions
on native PostgreSQL. It retains the oldest UTC-hour bucket for upcoming builds,
protects a building snapshot's older window, and confirms that a later maintenance
clock cannot release that window while database finalization still returns building.
Both pre-fix cases deleted required signal rows.

Expired or incomplete builds preserve the previous active scores. Twelve actual
failure commands exhaust a partition; duplicate and stale acknowledgements do
not add failures or disturb a newer lease. Each computed exponential/clamped
backoff is checked between server timestamps, then only scheduling is accelerated
for the next attempt. Sixteen retired snapshots permit admission, seventeen block
it, and one purge removes four before admission resumes.

The real refresh wrapper advances four empty/small jobs per tick and completes
64 partitions in sixteen ticks, preserving the prior active snapshot until
activation. Cooldown returns idle afterward. Health is ready at exactly three
hours and stale after that boundary. Maintenance preserves active scores even
when other data is old enough to remove. The fixture retains only generated data
on a disposable target. It does not qualify broker delivery, online disclosure,
large retention batches, process/backup restore or corpus-scale throughput.

The lifecycle repair passes backend tests (333 files/1,790 tests) and backend
TypeScript. No schema migration is required.

## Catalog recommendation HTTP reads

`task services-main:db:recommendation-reads:check` runs
[check-recommendation-reads.ts](../../services/main/scripts/check-recommendation-reads.ts).
The [pinned run](database/recommendation-read-evidence.json) passes 39 assertions
across 20 actual HTTP requests. Native editorial covers, requested-language
summaries and independent cover fallback are checked, including withdrawal.
The image fixture qualifies metadata selection; it does not assert delivery of
stored image bytes. The pre-fix endpoint returned no native cover because it
looked only in legacy localizations.

An active score remains stored while its native target becomes private; new
anonymous and authenticated discovery reads exclude it. Draft, unlisted,
moderation-removed and disallowed-rating entries remain absent. Archived and
soft-deleted targets also disappear. Cursor query mismatch and a newly unavailable
anchor are rejected. Tracking signatures verify, authenticated exclusions do not
affect anonymous readers, and explicit exclusions remain effective with
personalization disabled. An excluded anchor can still locate its continuation
without being returned again; removal restores the recommendation.

Authenticated reads exposed a repeatable statement timeout. The old anchor OR
around the exclusion predicate yielded an estimated cost of 1,155,334 and spent
2,362 ms compiling 787 JIT functions in a diagnostic run. An anti-join-preserving
NULLIF anchor probe reduced the prototype cost to 2,656 and execution to 6.8 ms
under the unchanged 1,500 ms limit, with default JIT enabled. Disabling JIT was a
diagnostic comparison, not the repair. The same predicate shape is used by feed
eligibility. These measurements do not close the independent native facet-search
abort or 500M/3B load acceptance.

Backend tests passed 333 files/1,790 tests; backend TypeScript and unchanged
OpenAPI/generated-contract checks passed. No frontend component, schema migration
or image-byte rendering change is part of this repair.

The shared feed/exclusion regression also passes 46 assertions and seven signed
HTTP requests after the anti-join change.

## Event intake authority

`task services-main:db:recommendation-events:check` runs
[check-recommendation-event-intake.ts](../../services/main/scripts/check-recommendation-event-intake.ts).
The [pinned run](database/recommendation-event-intake-evidence.json) passes 55
assertions and nine HTTP requests. Transaction cases cover valid/replayed events,
invalid signatures/time, all-or-nothing denied batches, anonymous and opted-out
attribution, and stale/suspended Self bindings. Five exact-PID lock-wait cases
exercise visibility before intake, intake before visibility, Self revision,
personalization preference and event time expiring while the target is locked.

Events, repeat observations and exclusions share the same canonical target
reference. A missing reference is rejected by its FK, and failed late validation
rolls back an allocated reference. A newly inserted CTE reference is visible to
the event signal trigger. Replay through either event UUID or observation key
cannot double-count signals or metrics. Anonymous/opted-out observations update
metrics without attributed hourly signals. Actual account erasure completes,
removes that account's events, and preserves other accounts, shared references
and aggregates. Event deletion also leaves aggregate retention independent.
A readable late observation after a real reviewed merge retains the source ID.

The HTTP fixture checks actual request validation, the 101-item rejection and a
100-distinct-target batch under the ten-second transaction deadline. That batch
took 1,414 ms in the pinned run and stored 144-byte tuples. Event storage has five
indexes and no old target-UUID/owner-alternative columns. These local measurements
do not qualify peak ingestion or the 500M/3B storage estimates in the owner README.

Fixture transaction cases roll back; API/race records remain on the disposable
target. The fixture is included in the full fresh-install check, alongside the
46-assertion/seven-request exclusion regression. Backend tests pass 332 files and
1,787 tests; backend TypeScript passes. The event persistence refactor leaves the
API contract unchanged. The full check installs nine migrations and 15,924 SQL
statements, validates canonical SQL/integrity/index health, and finds no schema
drift. Full delivery, large erasure/retention backlogs, restoration
and corpus-scale acceptance remain in M09.

## Related-post HTTP reads

`task services-main:db:related-posts:check` runs
[check-related-post-recommendations.ts](../../services/main/scripts/check-related-post-recommendations.ts)
on an installed disposable Atlas target with no recommendation snapshots.
The [pinned run](database/related-post-recommendations-evidence.json) passes 55
assertions and 23 HTTP requests. Posts, replies, account Self identities and a managed organization exercise shared
subject/credit priority, the general fallback and actual HTTP response validation.
The organization supplies credit context without becoming an account profile.
Direct Search checks distinguish active Self credits from organization credits.

Cases reject private/unlisted/draft/moderation-removed/rating-disallowed candidates
and replies beneath unavailable roots. Current root visibility/rating changes also
remove existing replies. Direct post/catalog seeds respect the viewer's ratings,
and reply seeds require readable roots. The allowed-rating preference case proves
that eligible R18 content works for a viewer who enabled it. Signed tracking,
anonymous/account isolation, exclusions with personalization off, cursor scope
mismatch and continuation after excluding the anchor are checked.

The pre-fix endpoint failed on a join to the removed `account_self` table. After
fixing the credit path, a general-rated reply still appeared beneath an R18 root.
The shared feed predicate now checks that root's rating; recommendation seed
queries check both current access and ratings. API contracts and persisted schema
are unchanged. Fixture data remains on the disposable target. This scope does not
qualify full feed concurrency, every post kind, snapshot scoring, large fan-out or
500M/3B throughput.

The first related-post HTTP read took 251 ms in the local fixture. Backend tests
pass 332 files/1,787 tests; backend TypeScript and unchanged OpenAPI/generated
contracts pass. No schema migration or frontend visual change is part of this fix.

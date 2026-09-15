# Subscribe and Realm policy capacity

Status: planning envelope, September 15, 2026; no benchmark or capacity gate has
passed for this feature. Applies to [Subscribe](subscriptions.md),
[Realm participation/Pro](realm-participation-policies.md) and their
[M10 qualification](../plan/modules/subscriptions-and-pro.md).
Follow the [capacity policy](data-integrity-and-workload-budgets.md#capacity-planning)
and reuse the native IAM, content, governance and Search budgets without claiming
their earlier fixtures qualify this new composition.

## Cardinality and amplification

Every potentially growing relation is planned independently at 500,000,000 rows
and estimated at 3,000,000,000 rows. Per-offering limits bound an operation, not the
global number of offerings. Let:

- S be retained purchased subscriptions, G their mean subscription-attributed
  benefit grants, and D independent contributor/complimentary grants;
- H be retained agreement/grant transitions and E retained provider events/effects;
- P be distinct native content identities, R their mean active Realm publications,
  and V the mean retained selected revisions per publication;
- J be review submissions, A mean attempts per submission, and Q metered effects;
- K be recently ranked Realm/publication pairs and B retained ranking generations.

Entitlement sources grow as S*G+D, not just S. Revision storage follows H; receipts
follow E and Q. Scope selections grow as P*R with history P*R*V. Review attempts
grow as J*A. Sparse ranking grows as K*B, not all historical publications times
all users. A body reused in several Realms can share one exact revision payload;
scope mappings, differing selected versions and access checks still have costs.
No beneficiary-by-Realm, beneficiary-by-publication or per-user Pro Feed matrix
is preallocated. Cross-resource benefits do not duplicate IAM memberships or
public content identities.

The following decimal-byte allowances include ordinary tuple/index overhead but
are assumptions to replace with native measurements. Rows in existing owners are
charged only once; additional indexes/projections must be priced as increments.
Source payloads, full text and audit evidence are separated so a small metadata
estimate does not conceal large data.

| Growing family | Heap/payload bytes per row | Index bytes per row | 500M rows | 3B rows |
| --- | ---: | ---: | ---: | ---: |
| Offering, plan/price/revision and policy metadata | 512 | 256 | 384 GB | 2.304 TB |
| Benefit-to-resource approved mapping | 128 | 192 | 160 GB | 960 GB |
| Purchased subscription current head | 512 | 384 | 448 GB | 2.688 TB |
| Entitlement source/current beneficiary-benefit projection, each | 256 | 256 | 256 GB | 1.536 TB |
| Commercial/grant revisions and effect receipts, each | 512 | 192 | 352 GB | 2.112 TB |
| Meter window/current counter | 96 | 160 | 128 GB | 768 GB |
| Meter debit/credit/reservation event | 128 | 192 | 160 GB | 960 GB |
| Review submission head | 384 | 256 | 320 GB | 1.920 TB |
| Review attempt metadata, excluding evidence | 512 | 256 | 384 GB | 2.304 TB |
| Accepted-version Realm mapping/order projection | 160 | 160 | 160 GB | 960 GB |
| Sparse Realm ranking row | 256 | 256 | 256 GB | 1.536 TB |
| Exact-version text document plus full-text index allowance | 2,048 | 3,072 | 2.560 TB | 15.360 TB |
| Outbox/job/delivery receipt metadata, each | 192 | 192 | 192 GB | 1.152 TB |

These are independent family estimates, not one additive deployment total.
For example, S=500M, G=3 and D=100M produce 1.6B source grants, about 819.2 GB
at 512 bytes each before current projections and histories. At S=3B with the
same G and D/S ratio, 9.6B grants require about 4.9152 TB. Similarly R=2 doubles
scope relations without requiring two payload copies of a shared revision.

Budget retained private review evidence separately: 8 KiB average evidence per
retained attempt adds 4.096 TB at 500M attempts and 24.576 TB at 3B. Retention
fractions and deletion deadlines materially change that cost; do not copy the
whole content body into every attempt. Keep hashes/selected revision references
and bounded findings when enough, and erase sensitive retained evidence through
the same privacy frontier as its source. Redundant provider payloads have an
explicit byte/time cap and are not an unbounded append-only secret store.

Add replicas, WAL, temporary index/rebuild copies, free space and backups explicitly.
As a planning example, one primary plus one replica with 50% headroom is 3 times
the logical heap/index footprint before WAL/backups. Measure write amplification
under transitions and expiry; assume neither index compression nor an idle replica
eliminates the need to store metadata. Groonga's documented size/record ceilings
and the existing Search shard-before-limit policy still apply.

## Indexed read and write paths

| Operation | Required leading keys and bounded work |
| --- | --- |
| List an offering's plans | Offering/group/lifecycle and stable order/ID; hydrate only the requested revisions and bounded benefit sets. |
| Own paid subscriptions | Private beneficiary/status/update/ID. Plan-group selection also has a unique current beneficiary/offering/group key for replaceable plans. |
| Resolve a benefit | Beneficiary/benefit/scope current head; source probes by that same key plus lifecycle/validity. Check next expiry and completeness; no scan of all purchased plans on each content read. |
| Apply payment/grant change | Provider-account/event/effect dedupe keys, exact agreement and beneficiary-benefit heads. All affected benefit IDs are fixed by the admitted plan revision. |
| Expiry/reconciliation | Due-time/source-ID keysets and fenced leases. Do not run a timer per subscriber or recalculate every account at midnight. |
| Meter use | Beneficiary/Realm/action/window or named credit-pool identity, plus unique effect key. One exact meter lock; no lock on one popular Realm for every participant. |
| Review queue | Realm/state/next-attempt/ID and submission/revision/attempt; lease generation and terminal-state fences. No model calls inside a transaction. |
| Realm latest feed | Realm/effective-publication-state/visibility/accepted-time/identity seek. Original Work release time and Realm acceptance time are different sort contracts. |
| Realm best feed | Realm/snapshot/score/identity sparse ordering plus Realm-local zero-score continuation. Reuse the ranking lifecycle and bound retained copies. |
| Scoped text search | Selected publication/adoption REV mapping plus exact-version text postings; indexed candidate selection intersects scope before expensive hydration/ranking. |
| Erasure/reverse impact | Beneficiary, original issuer/consenter and target-selection indexes. Account cleanup must not traverse every Realm, Rule revision or historical plan. |

For a single indexed Realm order the target path is O(log N + C), with C the
bounded candidate work rather than all global content. Complex filters and viewer
restrictions still consume candidate budgets; they do not promise a full page.
For a Realm-A/Pro intersection, use a selective indexed seed and current-state
probes or a measured common-query projection. Do not precompute every Realm pair
or materialize all candidate intersections on each request.

Existing Search has a 4,096 candidate window and 50,000 estimated text-posting
budget. Retain them until qualified replacement. A sparse Pro filter falling back
to global order is not sufficient evidence of acceptable Realm retrieval. Elect
Realm-local candidate sources for the high-frequency path and preserve the same
ordering/cursor contract in sparse and dense plans. Full-text matching and facets
must use the displayed accepted version, including when a general Realm has a
newer version of that Unit. Current authority gates identity, snippets, media and
counts as well as bodies. Lower-bound/partial/unavailable counts stay explicit.

Cache entries identify selected scope, filter/order, accepted selection/ranking
generation and a proven visibility domain. Share only safe candidate or public
projection data; beneficiary-private entitlement and blocked-content state cannot
be shared by a coarse "Pro user" cache key. Revocation must invalidate or bypass
stale proofs synchronously even if cosmetic counts and search membership lag.

## Initial admission and execution budgets

These are initial engineering budgets to qualify, not measured community capacity
or irreversible commercial product limits. Return a typed limit/unavailable state
when exceeded; never silently truncate a security proof or expand query scope.

- At most 32 offered plans per offering, 16 groups, 8 active prices per plan and
  16 selected benefits per plan revision. Cross-resource benefit mappings have
  at most 16 explicit approved scope selections; recursive bundles are not enabled.
- Lists return at most 50 items. Detailed plan requests hydrate one plan and its
  admitted benefit set. Each beneficiary/benefit admits at most 32 live/scheduled
  paid sources and independently 32 award sources. Use separately indexed source
  classes and probe at most 33 rows in each to detect overflow; at most 64 admitted
  sources are evaluated. New awards cannot consume paid-source capacity. Commercial
  quotes/intents do not scan awards, and unavailable overlap display cannot block
  a purchase. Expired-source cleanup remains indexed by source class and deadline.
- A subscription source transition affects at most 16 benefit heads in a sorted
  lock order. External event intake caps raw payloads at 256 KiB; larger/provider-
  unsupported events require a bounded fetch or visible operator handling.
- Pro Feed retains the existing 50-item ceiling and per-item association/payload
  bounds. A single candidate hydration cannot expand to the whole reply tree.
  Do not automatically loop through empty bounded pages to fill a visual page.
- A publication orchestration targets at most 8 Realms and reports independent
  per-Realm outcomes. A candidate revision fixes at most 16 inspected dependencies;
  a larger manifest requires the existing bounded composition review protocol,
  not a falsely complete truncated review.
- Each review attempt admits at most 96 KiB normalized input, 16,384 model input
  tokens, 2,048 output tokens and 60 seconds. At most 3 model calls, including
  retries, per admitted review execution; material new evidence needs a new
  explicitly admitted candidate. Unreadable/oversized input goes to human handling.
- Pending AI work is capped at 1,000 jobs per Realm and 50,000 deployment-wide,
  with explicit queue-age backpressure at 5 minutes. Operator/provider concurrency
  and spend caps are mandatory configuration. Intake stops or explicitly offers
  manual handling when unavailable; it does not accumulate an unlimited queue.
- Expiry/reconciliation reads at most 100 due rows per lease; erasure processes
  at most 50 private rows per indexed family per batch. Backfills process at most
  1,000 selected publication mappings per batch with a committed continuation.

DB memory follows page/benefit/candidate bounds. A 4,096-candidate metadata window
at a provisional 256 bytes per candidate is about 1 MiB before runtime overhead;
do not hydrate 4,096 bodies. A maximum 50-item Feed with 2,000-character summaries
can approach 400 KB of UTF-8 summary text before metadata. Model input/output and
evidence byte caps remain separate from the API response budget.

## Workload and operating thresholds

Planning loads below are deployment-wide; they require appropriate database/API
sharding and provider capacity, not one machine. Both the 500M and 3B cardinality
profiles must retain request-work bounds at these loads and under larger backlogs.

| Path | Normal / peak operations per second | Initial p95 target, excluding network/provider latency |
| --- | ---: | --- |
| Subscription/grant state changes | 50 / 500 | 200 ms for local commit |
| Beneficiary benefit checks | 2,000 / 20,000 | 20 ms for bounded local resolution |
| Scoped Feed/Search reads | 200 / 2,000 | 200 ms Feed; 500 ms admitted text query |
| Publication/meter commits | 50 / 500 | 200 ms |
| AI review intake | 5 / 50 | 200 ms durable admission; completion separately measured |

AI throughput and cost are independent gates. For intake rate lambda, mean attempts
a and mean call duration t, minimum average in-flight calls are lambda*a*t.
For example, 5 submissions/s, 1.2 attempts and 8 seconds requires about 48 concurrent
calls before headroom; none of these are measurements. Daily token demand is
86,400*lambda*a*mean input/output tokens, priced using the elected provider at
activation. A locally fast queue cannot qualify affordability or reviewer quality.

Measure raw source candidates, examined rows/buffers, page fill, p50/p95/p99,
locks, WAL bytes/effect, queue oldest age, grant freshness, expired-source cleanup,
ranking staleness, model tokens/cost and appeal outcomes. Include Pro content
fractions of 0.1%, 1% and 50%, skew with one Realm holding most Pro publications,
deep cursors, popular/rare text, overlapping gifts, expiry bursts and long histories.
Hold the eligible Pro set fixed while increasing unrelated content; read work must
follow the declared indexed path rather than unrelated corpus growth.

Backfills/rebuilds stage a generation, capture a mutation frontier, catch up bounded
deltas and activate atomically; failed builds retain the last compatible generation.
No change to one offering/Rule revision synchronously rewrites every subscriber or
publication. At a source/grant change, current eligibility is enforced immediately;
later fan-out is cleanup, notices or read-model repair, never deferred security.

Start repartition/capacity intervention before any relevant index reaches its
engine limit, before primary I/O sustains 70%, or after three five-minute windows
above an accepted p95/queue-age target. Commercial state is initially routed by
beneficiary, review work by Realm/target and search by native content/selection
placement. Cross-shard reads and atomic grant effects need a separately qualified
protocol before physically splitting those owners. The initial single PostgreSQL
authority is not a claim that one host serves 3B rows at peak load.

During incidents, stop new sales when fulfillment cannot be guaranteed, retain
truthful pending settlements, and disable new review admission before budgets
overflow. Do not convert uncertainty into a purchase failure that invites a second
charge, broaden Pro to general results, or replay stale jobs into erased state.
Restores reconcile provider agreements and apply revocation/erasure frontiers before
renewal, review activation and protected delivery resume.

## Qualification basis

[PostgreSQL multicolumn indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html)
and [index ordering](https://www.postgresql.org/docs/18/indexes-ordering.html),
consulted September 15, 2026, support equality-leading seeks and bounded ordered
retrieval. They do not guarantee planner choice or this workload's latency.
[Current Search](../../services/main/src/services/search/README.md) and
[sparse ranking](sparse-best-ranking.md) provide mechanisms to extend, not acceptance
of Realm-scoped adopted versions. [CAPSUB01-CAPSUB08](../testing/subscriptions-and-pro.md#capacity-and-recovery-cases)
requires native plans, storage, skew, concurrent transitions and restoration evidence.
Replace these allowances with measured physical families in the existing capacity
tooling during the verification phase; do not generate a parallel capacity ledger.

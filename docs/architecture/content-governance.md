# Content governance and reporting

## Decision

Content governance records exact rule-backed decisions, reports and independently
progressing referrals. Released cutovers are recorded in [release history](../releases/1.4.0.md#governance-cutover);
they do not authorize deleting current reports or resetting a later installation.

A report or adverse decision cites the applicable community governance context
and/or official rules. Presentation in a Zone alone does not select community
authority. The initial operation profile admits at most two rule sources and 32
exact rule references per command. A reference identifies the governing Space,
immutable rule-set revision and rule occurrence, with the representation shown
to the acknowledging participant retained where required.

| Operation | Applicable rule sources | Requirement |
| --- | --- | --- |
| Report without community governance context | Official rules | At least one exact rule |
| Report under community governance | That admitted Realm capability and official rules | At least one across the selected sources |
| Community adverse action | That governing Space and official rules | At least one exact rule |
| Platform adverse action | Official rules | At least one exact rule |
| Approve, restore, unlock, dismiss or note | Reversal/evidence contract | Do not invent an adverse rule basis |

Validation acquires the current source authority/revision fences and reloads the
selected rules after locking. Stale or no-longer-current selections return a typed
conflict; clients preserve the user's selection rather than choosing another rule.
The [identity](identity-and-access.md) and [Space](space-composition.md) contracts
govern participation, representation and authority independently of classification.

## Report and case model

`content_report` is one reporter submission and contains only reporter-authored
evidence plus the exact reported Resource revision. `content_report_rule` stores its
many rule references. `content_report_referral` routes the submission to one
case per responsible authority. A report selecting both Realm and official
rules therefore remains one report with two independently progressing
referrals, not two copied reports.

`content_review_case` is the authority-owned work item. Platform cases have no
Realm identity; Realm cases carry exactly one Realm identity. Partial unique
indexes allow at most one active case for each `(authority, Realm, Unit)` while
allowing later cases after a prior case reaches a terminal state.

`governance_decision` is the cross-domain immutable decision ledger.
`content_governance_action` retains content-specific transition facts and has a
one-to-one link to that ledger. Adverse actions store their basis in
`governance_decision_rule`; restorative actions point to the decision they
reverse.
Free-form internal notes and public notices are revisioned Posts bound to the
case or action. Reporter allegations, reviewer notes, and decision rules are
separate facts and are never copied into a generic reason column.

Account enforcement retains a separate operational action, but its authority,
Rule basis, and reversal are recorded in the same governance decision ledger.

License invalidation and restoration operate on individual
`unit_license_grant` rows. `invalidate_license` is rule-backed and names the
target `licenseGrantId`. `restore_license` remains a reversal of that action.
`granted` on the ledger is a recorded declaration, not a finding of legal
validity; invalidation withdraws platform recognition of that declaration.
See [Resource license grants](./resource-license-grants.md).

## Concurrency and bounded work

Case creation uses an authority-and-Resource transaction advisory lock only when no
active case exists. Established cases use a shared row lock, so reports for a
viral Resource can proceed concurrently while a terminal case transition cannot
race a new referral. Duplicate protection uses a separate
`(case, reporter)` advisory-lock key; one reporter's retry does not serialize
other reporters.

Report counts use 256 deterministic hash buckets per case. A write updates one
bucket, and a read sums at most 256 rows. This fan-out would be ineffective if
all reports retained the case-creation lock, which is why the hot path releases
that global serialization point after the case exists.

All list endpoints use bounded pages of at most 100. User reports, Realm
reports, reports in a case, and the platform queue use opaque keyset cursors;
none use deep offsets. Hydration is batched by the page's report IDs, so a page
loads rule and referral rows with fixed query fan-out rather than N+1 reads.
The platform queue has partial `(updated_at, id)` and
`(state, updated_at, id)` indexes. Realm report queues use
`(rule_source_realm_id, created_at, id)`, while generic case lists have
authority/Realm created-time indexes. Request memory is bounded by 100 reports,
at most 3,200 rule references, and at most 200 referrals.

## Capacity model

The planning baseline is 500,000,000 reports; the forward estimate is
3,000,000,000. These are sizing assumptions, not production measurements:

- 60% of reports cite official rules only, 25% cite Realm rules only, and 15%
  cite both, for 1.15 referrals per report;
- reports cite 2.4 rules on average, with a hard maximum of 32;
- one case receives 20 referrals on average, while the design also tolerates a
  single viral case and the adversarial one-case-per-referral distribution;
- content actions equal 8% of referrals and adverse actions cite 1.8 rules on
  average;
- 15% of reports include details averaging 400 UTF-8 bytes;
- workload qualification must elect report/decision write rates separately from
  retained row count; the earlier 5,000/30,000 writes/s scenarios are unqualified
  fleet assumptions, not current single-database service promises;
- queue reads target p95 below 200 ms for 50 items, report submission p95 below
  300 ms excluding external authentication, and governance actions p95 below
  500 ms.

The resulting central estimates are:

| Relation | 500M reports | 3B reports |
| --- | ---: | ---: |
| `content_report` | 500M | 3B |
| `content_report_rule` | 1.2B | 7.2B |
| `content_report_referral` | 575M | 3.45B |
| `content_review_case` | 28.75M | 172.5M |
| `content_governance_action` | 46M | 276M |
| `governance_decision_rule` for content actions | about 83M | about 497M |

Approximate PostgreSQL heap-plus-index footprints are 0.35 KiB per report,
0.25 KiB per report-rule row, and 0.38 KiB per referral. Those estimates put
the three corpus-scale report relations near 0.7 TiB at 500M reports and
4.2 TiB at 3B reports. Cases, actions, counters, WAL, replicas, free space,
vacuum headroom, and backups raise operational storage to roughly 1.0–1.4 TiB
at the baseline and 6–9 TiB at the forward estimate. Measure actual tuple and
index sizes after representative load; UTF-8 details, index fill factors, and
write churn can materially change these numbers.

A report transaction writes one report, up to 32 report-rule rows, one or two
referrals, and one or two counter upserts. The maximum logical row fan-out is
37. Index maintenance and full-page images make expected WAL amplification
roughly 4–8 times the logical payload. Shared source locks are acquired in
sorted order, case routes are sorted, and queues apply backpressure at the API
quota and database pool rather than admitting an unbounded in-process queue.

At 500M reports, the design assumes a storage-optimized PostgreSQL primary with
NVMe-class random I/O, read replicas for non-authoritative history, and enough
vacuum/WAL capacity for the measured write rate. Every online request remains
an index range scan or bounded point lookup. Before any queue plan begins to
sort or scan more than 10,000 rows, or before sustained primary I/O exceeds 70%,
the operator must capture `EXPLAIN (ANALYZE, BUFFERS)` with production-like
skew and add capacity rather than increasing page limits.

The 3B estimate remains a same-database planning case. Partition target-owned
case/referral/action history where measured access and retention justify it;
maintain a reporter-keyed inbox index/projection for My Reports. Preserve exact
rule revision and state-transition authority across those tables. A partitioned
layout still consumes one deployment's storage, WAL, vacuum and recovery budget.

Trigger investigation before sustained I/O exceeds 70%, queue p95 exceeds 200 ms
for three windows, or measured restore/index-maintenance time exceeds its budget.
Respond with measured query/index changes, admission limits, physical table or
partition changes and retention policy. A future database split requires its own
transaction/reference/recovery decision; neither 150M nor 3B is a universal
physical row limit. Published throughput remains unqualified until measured.

# Governance Rule decisions

## Contract

REZICS 1.7.0 removes human governance reason enums. A human policy decision is
an immutable `governance_decision` with exactly one basis:

- `rules`: 1–32 `{sourceRealmId, revisionId, ruleId}` references; or
- `reversal`: one previously unreversed decision and no copied Rules.

There is no ungrounded decision basis. Approvals, restorations, and other new
policy judgments cite Rules. Pure workflow events stay outside this ledger.

`governance_decision_rule` proves both `(source Realm, revision)` and `(Rule,
revision)` with composite foreign keys. A deferred database trigger verifies the
Rule count at commit. The writer creates the decision as unfinalized, attaches
its complete basis, and finalizes it in the same transaction. An unfinalized
decision cannot commit; after finalization the database rejects Rule inserts
as well as decision or basis updates and deletes. Domain action tables keep
operational transition fields and reference one decision; audit events
reference the same decision instead of copying a reason string.

Machine authorization and execution failures are not policy rationales.
`audit_event.outcome_code` stores those bounded machine outcomes, while
`governance_decision_id` stores a human policy basis.

## Authority and Rule sources

| Authority | Accepted current Rule sources |
| --- | --- |
| Platform | Official Rule Realm |
| Realm | That Realm and the official Rule Realm |
| Zone | `zone.local_rule_realm_id`, when set, and the official Rule Realm |
| Unit | Official Rule Realm |

The server derives this set; clients cannot expand it. Source Realm IDs are
sorted before shared transaction advisory locks are acquired. Under those
locks the server reloads the current revision and every selected Rule. A stale
revision fails with `GovernanceRuleChanged`; an outside source fails with
`GovernanceRuleSourceForbidden`. A Zone authority also holds a shared row lock
on its Zone configuration until the decision commits, so a concurrent local
Rule Realm switch cannot authorize a decision from a stale setting. Clients do
not auto-select a Rule.

Assigning `zone.local_rule_realm_id` is fail-closed: the Realm must have a
non-deleted Realm Unit and a current immutable revision containing at least one
Rule. The assignment does not copy Rules into the Zone. Assignment holds the
Realm Unit row and the same shared current-revision lock as decision validation,
so a concurrent deletion or publication cannot invalidate the check before
commit. Every later Zone decision revalidates each selected Rule Realm and its
exact current revision, so a deleted, stale, or empty source cannot authorize a
mutation.

Exact-reversal endpoints omit Rules. They find and lock the prior decision and
append a reversal. A unique partial index prevents two reversals of the same
decision. A restoration that is a new policy judgment instead cites current
Rules. Content and account domain actions retain their own reversal links so
their transition-specific invariants remain locally enforceable.

## Workload and capacity

The minimum planning baseline is 500,000,000 decisions and the forward estimate
is 3,000,000,000. Sizing assumes two Rule references per Rule-backed decision
on average, a hard maximum of 32, 90% Rule-backed decisions, and 10% reversals.
Target traffic is 5,000 decision writes/s at the
baseline and 30,000/s at the forward estimate, with no shard accepting more
than 1,500/s. History reads target p95 below 200 ms for 50 rows; a mutation,
including current-Rule validation, targets p95 below 500 ms.

An average decision costs about 0.40 KiB of heap plus indexes and a Rule
reference about 0.25 KiB. At the conservative two-reference average, 500M
decisions plus 1B references use about 0.4 TiB before WAL, replicas, free space,
vacuum headroom, and backups. The 3B/6B estimate is about 2.4 TiB before that
operational amplification. Expected WAL is 4–8 times logical payload during
bursts because each decision maintains authority, subject, target, reversal,
and Rule-history indexes.

The request path performs at most two current-revision lookups, 32 indexed Rule
lookups, one decision insert, 32 Rule inserts, one domain mutation, and one
bounded finalization update, plus one audit insert. It never scans a decision
history or loads corpus state into memory. Lists use `(target, created_at, id)`
or `(subject_kind, subject_id, created_at, id)` keyset ranges. A request retains
at most 32 Rule references;
database pool limits and API quotas provide backpressure. Sorted source locks
avoid deadlock cycles. The deferred basis validation runs once per decision,
not once per Rule, so the maximum basis does not create quadratic commit work.
A viral target can be a write hot key, so target-scoped domain locks must remain
shorter than the transaction and must not wrap remote work.

The 500M baseline requires storage-optimized PostgreSQL with NVMe random I/O,
read replicas for history, and measured autovacuum/WAL capacity. Capture
`EXPLAIN (ANALYZE, BUFFERS)` against production-like target skew before launch
and whenever p95 exceeds its target, primary I/O remains above 70%, or one
index exceeds 500 GiB. Do not raise page or batch limits to conceal pressure.

The 3B estimate is a horizontal cutover, not a single-node promise. Shard by a
stable hash of the typed target identity (Unit or auth User), replicate the
small current-Rule catalog, and maintain subject-specific read projections when
the subject and target shard keys differ. Begin repartitioning no later than
150M decisions per primary shard, a 2 TiB primary volume, 70% sustained I/O, or
three consecutive p95 breaches. UUIDv7 identities and keyset cursors survive
that cutover. Terminal history may move to time-partitioned archival shards only
after authoritative target and subject projections are durable.

## Persistence boundaries

The Rule basis applies to content actions, account enforcement and account
state, Unit access restrictions, soft deletion, ownership overrides and claim
decisions, identity merges, revision visibility restrictions, and platform
address controls. Replacing or clearing an active Unit restriction is a new
Rule-backed policy decision; it is never an unlogged side effect of replacing
access grants. Configuration edit summaries and API-quota change notes are not
policy violation reasons and remain ordinary audit detail. Authentication
denials remain machine outcome codes.

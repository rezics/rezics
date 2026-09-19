# Data integrity and workload budgets

## Capacity planning

Apply this policy when schema, query, index, API, persisted-flow, search,
recommendation, queue, worker, cache or background-job changes affect workload
assumptions or resource costs. Reuse an existing analysis only after checking
that its assumptions and evidence still cover the changed path. A rename or
documentation-only edit does not require a new capacity report.

Every potentially corpus-scale relation or dataset uses a minimum planning
baseline of **500,000,000 rows**, plus an estimate at **3,000,000,000 rows**.
A strictly bounded control/configuration dataset may use its stated, justified
bound. Account for relation amplification rather than assuming one row per
catalog object.

Record the relevant assumptions and growth math in the owning design:
cardinality/distribution, read/write rates, access patterns, latency/throughput
targets, query complexity, row/index storage, write amplification, memory and
network costs, concurrency, skew/hot keys, backpressure, and maintenance/migration
costs. Distinguish measurements from estimates.

Keep request and recurring work bounded using selective indexes, keyset pages,
bounded fan-out/batches, incremental computation, partition pruning and admission
control as appropriate. Full-corpus scans/recomputation, deep offsets, N+1
access, unbounded queues and single-process corpus loading require workload
evidence establishing safety. Prefer partitionable or horizontally scalable
designs beyond the planning baseline.

Validate risky queries with representative distributions and EXPLAIN or
EXPLAIN ANALYZE; benchmark affected backend paths when practical. The local
fixture need not contain 500 million rows, but the analysis must cover both
planning scales, including storage, skew and operational costs. Toy timings
alone are insufficient.

If the baseline cannot be met, record the limiting resource, failure mode,
observable thresholds and a concrete partitioning, sharding, archival or
cutover path. Obtain maintainer approval before accepting that limitation as a
complete design. Unrelated work can continue; an accepted limitation does not
constitute capacity qualification.

The audit counts and worked examples below describe their recorded scenarios.
Verify their schema and workload assumptions against the current native target
before reusing them as evidence.

## Decision

REZICS optimizes for a high-throughput public forum, not for treating every
persisted value as a financial transaction. Validation is therefore placed at
the cheapest layer that can protect the consequence that matters.

PostgreSQL owns only invariants whose violation would leave shared persisted
state contradictory, make indexed storage unsafe, bypass a cardinality bound
that every writer must respect, or corrupt a value used for authorization,
accounting, lifecycle, or aggregate computation. The API and domain service own
input syntax, product policy, permissions, and request-work budgets. Rendered
documents use strict writes and tolerant reads: one malformed historical value
is isolated and observed instead of failing an entire feed or page.

This is not a rule to put every validation in PostgreSQL. It is a rule to put
the final guard for destructive persisted states in PostgreSQL while keeping
harmless format evolution out of the database contract.

## Layer ownership

| Concern | Canonical owner | Database backstop? | Reason |
| --- | --- | --- | --- |
| JSON/body parsing, field syntax, friendly errors | API schema | no | Reject cheaply before business work; malformed-but-bounded text is not persisted corruption. |
| Authorization, state transitions, cross-resource product policy | domain service | only the irreducible persisted invariant | These rules need identity, current state, and typed errors. |
| Required identity, references, uniqueness, row-local state shape | `NOT NULL`, FK, unique/exclusion, `CHECK` | yes | Every writer and concurrent transaction must see the same contract. |
| Cross-row cardinality that protects every reader | indexed trigger plus application precheck | yes, exceptionally | Use only when unique/exclusion constraints cannot express it; lock and probe work must be bounded. |
| Page size and response fan-out | API/query | no | It is a workload and fairness budget, not a fact about stored rows. |
| Batch command count | API and service | no | It bounds one request's CPU, memory, lock duration, and write amplification. |
| Presentation document vocabulary | strict API/domain write; tolerant presentation read | no full DB schema | Format drift must not take down unrelated content. Security-sensitive URLs and executable capabilities are still normalized or rejected. |
| Indexed value byte ceiling | API, generator, and DB `CHECK` | yes | Alternate writers or a generator bug must not make future index writes/rebuilds fail. |

Prefer native `NOT NULL`, foreign-key, unique, and exclusion constraints over
custom triggers. PostgreSQL assumes a `CHECK` condition is immutable and does
not support using one to prove facts about other rows. A trigger is acceptable
only for a genuinely cross-row invariant with a selective index, a sharded
lock key, and fixed probe work.

## Integrity evidence and limit taxonomy

The [earlier integrity audit](../testing/foundation.md#historical-integrity-audit)
records its exact table/check census and nullable-value repairs. Current counts
come from the schema inventory; counts alone do not establish correctness.
PostgreSQL accepts a CHECK result of true or null, so a required nullable operand
needs an explicit presence condition. A shared row invariant must hold for every
writer, including workers and source adoption.

A numeric maximum needs a named reason. Separate limits on one operation or
selected view from limits on all facts retained about a Resource:

| Limit | Meaning and owner |
| --- | --- |
| Page size, candidate window, batch size, response bytes | API/query work and admission policy; never a maximum lifetime corpus degree. |
| Selected names, pinned references or visible controls | Bounded presentation selection; underlying names/references can be paginated independently. |
| Required row identity, uniqueness, value shape | Persisted invariant enforced by native constraints. |
| Fractional-position external input: 512 ASCII bytes | API/generator repair-headroom budget. |
| Fractional-position storage: 1,024 bytes | Generator and DB indexed-storage invariant. |

The earlier reference implementation ranks its full active set and consequently
requires 128 active/16 pinned guards. Those are [current implementation limits](../reference/current-implementation.md#measurements-and-reference-ranking),
not the target's maximum number of multilingual names or external identifiers.
Keep working guards until replacement keysets, ranking generations and bounded
selection queries pass acceptance; removing a guard alone would make work
unbounded. Target writes cannot fingerprint or rerank an entire high-degree set.

## Creation-time classification and Tag applications

An initial create request may admit at most 32 Tag selections as an operation
budget. The authorizing service validates all selected IDs in bounded indexed
batches and commits the admitted applications with the Resource. This request
limit does not cap later classification, multilingual names or Tag history.
Objective type membership follows the [classification contract](classification-spoilers-and-measurements.md),
with source/evidence and acceptance separate from subjective community votes.

A creator vote exists only when an admitted participation operation explicitly
casts it under its voting identity. Importing a source assertion never invents an
account or vote. At four applications per Resource, 500M/3B Resources imply
2B/12B application rows. If an explicitly elected journey also casts one vote per
application, that adds another 2B/12B vote rows; model that fraction independently.
The Resource-forward and Tag-inverse indexes each have storage and WAL costs.

Requests use Resource/Tag keysets and bounded hydration. Popular Tags must not
serialize unrelated Resource creation through a shared read or global aggregate.
Keep small curated form options separate from the corpus. Measure create latency,
lock waits, aggregate contention, relation/index bytes, WAL and replica lag.

Use owner-routed physical partitions and selective inverse projections inside the
selected PostgreSQL database. A three-billion-Resource estimate does not select
another database, fixed partition count or mandatory live dual-write. If measured
hardware, maintenance or restore limits cannot satisfy the workload, expose the
limitation and reselect placement or workload before claiming qualification.

## Fractional positions

Fractional positions use a canonical ASCII alphabet, so character length and
UTF-8 byte length are equal after syntax validation. The contracts are:

- external write input: canonical key and at most 512 bytes;
- persisted/read response: canonical key and at most 1,024 bytes;
- soft rebalance threshold: 512 bytes; and
- hard DB invariant: `octet_length(position) <= 1024` on every admitted fractional
  position column; the schema inventory determines the current count.

The split is intentional. An API-only maximum cannot protect generated keys,
maintenance scripts, workers, imports, or future writers. A 512-byte database
maximum would make the normal recovery operation impossible once an existing
key crossed the soft threshold. The 1,024-byte ceiling is the destructive
storage boundary; 512 bytes reserves repair runway.

In the adversarial pattern that repeatedly inserts into the same `a0`–`a1`
gap, the current generator first reaches 513 bytes after 2,551 insertions and
would reach the hard ceiling after 5,110 successful insertions. Collection,
Content Structure, draft, and Realm-pin planners now compact an owned order
before or immediately after generation when the soft threshold is crossed.
The generator refuses to emit a value beyond the storage ceiling.

Compaction is scoped to an order already materialized by its owning planner; it
never scans a corpus relation. The repair starts with the single degraded
member and doubles its local window only while the surrounding gap cannot hold
keys below the soft threshold. A lone degraded key therefore causes one
position rewrite, not a rewrite of a large owner scope. The worst case remains
linear in one sibling/order scope when the complete local region is dense.
Record each event in `rezics.ordering.rebalances` and its planned
rewritten-member count in `rezics.ordering.rebalance.members`. Move to a
bucketed/two-level order and a resumable background compactor before either
condition becomes steady state:

- a single compaction touches more than 10,000 members; or
- more than 0.1% of ordering mutations require compaction for 15 minutes.

At 500 million and 3 billion relation rows, routing remains by the owning Resource,
Collection, Structure, Agent, Realm, or Post key. There is no global
renumbering operation. A hot owner may serialize its own ordering writes, but
unrelated owners remain independently partitionable.

## Tolerant presentation documents

Portable Text is strictly validated on public writes and destructive restores,
but PostgreSQL stores it as JSONB without copying the complete evolving schema
into a `CHECK`. On presentation reads, a valid document retains object identity
and takes the normal path. A malformed persisted envelope or content value is
normalized to the render-safe vocabulary; a Wiki body that violates its host
block policy becomes an empty body. The source row is not silently rewritten.

Every repair increments `rezics.persisted_document.repairs` with one of three
fixed source attributes: `post.body`, `unit_localization.content`, or
`unit_localization.description`. Posts, feeds, reviews, Content Structure,
Realm surfaces, governance notes, Agents, and Resource content rendered by Zone routes use
this boundary. This turns historical drift into observable repair work without
letting one row fail a complete list.

This tolerance does not authorize executable HTML or arbitrary URL schemes.
The renderer does not execute document JSON, supported links are normalized to
safe schemes, and host-specific custom blocks still pass their structural and
capability policy.

## Constraint rollout

Constraint installation depends on its PostgreSQL kind and the elected engine
version. For supported kinds, such as CHECK and foreign-key constraints,
`NOT VALID` permits staged validation while protecting subsequent writes. It is
not a general option for every constraint: primary/unique index construction and
attachment need their own installation, duplicate detection and lock plan.
Consult the engine's [ALTER TABLE contract](https://www.postgresql.org/docs/18/sql-altertable.html)
and [constraint semantics](https://www.postgresql.org/docs/18/ddl-constraints.html).

A fresh disposable rebuild installs the selected schema without a legacy transfer
requirement. A change to an existing deployment preserves released SQL and the
installation baseline, declares actual affected relations, and budgets scan,
index-build, lock, WAL, temporary disk and restore costs. Validate in bounded
maintenance scopes supported by the selected constraint/partition design; do not
assume every validation becomes partition-local automatically.

The current allowlisted operator command is documented with the
[database migration procedure](../../README.md#database-migrations). Its status and
single-constraint modes are implementation tools, not permission to run a whole
corpus validation during deployment. At 500M/3B rows, account for each heap/index
pass and monitor I/O, lock waits, vacuum and replication. A failed staged validation
retains its actual constraint state; recovery must inspect it rather than assume
that the release installed a fully validated invariant.

## Review checklist

For every new check or maximum, record:

1. the concrete failure prevented, not merely that a value is “invalid”;
2. the narrowest layer that can prevent that failure for every relevant writer;
3. SQL null semantics and whether nullable operands are proved explicitly;
4. request-path complexity, selected index, maximum rows/bytes touched, and hot-key behavior;
5. behavior at 500 million and 3 billion rows, with measured same-database partition/maintenance limits;
6. deployment and historical-data validation cost; and
7. the metric and threshold that triggers redesign rather than another smaller arbitrary limit.

## Research basis

- PostgreSQL documents that a check passes on true or null, that most checks
  should not reference other rows, and that `NOT VALID` plus later
  `VALIDATE CONSTRAINT` separates new-write protection from the historical
  scan: [constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
  and [`ALTER TABLE`](https://www.postgresql.org/docs/17/sql-altertable.html).
- GitLab documents the same two-migration pattern for large production tables:
  [foreign-key validation](https://docs.gitlab.com/development/database/foreign_keys/).
- Figma describes fractional keys growing over time under repeated edits:
  [Realtime editing of ordered sequences](https://www.figma.com/blog/realtime-editing-of-ordered-sequences/).
- Order maintenance has well-known relabeling solutions with constant
  amortized update bounds: [Dietz and Sleator](https://www.cs.cmu.edu/~sleator/papers/maintaining-order.html)
  and [Bender et al.](https://people.csail.mit.edu/edemaine/papers/DietzSleator_ESA2002/paper.pdf).
- Google SRE treats overload protection and load shedding as explicit capacity
  controls rather than substitutes for efficient work:
  [Addressing cascading failures](https://sre.google/sre-book/addressing-cascading-failures/)
  and [Service best practices](https://sre.google/sre-book/service-best-practices/).
- Stripe's public API uses bounded cursor pages (up to 100) and layers several
  rate limiters for fairness and overload control:
  [pagination](https://docs.stripe.com/api/pagination) and
  [rate limiters](https://stripe.com/blog/rate-limiters).

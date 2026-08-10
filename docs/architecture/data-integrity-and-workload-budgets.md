# Data integrity and workload budgets

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

## Whole-schema audit

The audit inspected the 163 Drizzle tables and all 317 pre-change `CHECK`
constraints, including nullable operands, discriminated unions, lifecycle
pairs, aggregate equations, timestamps, JSON root shapes, and ordered values.
The resulting schema has 334 checks on 129 tables; the increase is the 17
fractional-position storage ceilings.

No broad class of checks was removed. The retained checks protect persisted
relationships or values that downstream code legitimately treats as proven.
Full Portable Text and other evolvable document vocabularies intentionally
remain outside PostgreSQL. Pagination maxima likewise remain API-only.

Six constraints had real SQL three-valued-logic holes. PostgreSQL accepts a
`CHECK` when its expression is true **or null**, so a nullable comparison such
as `byte_size > 0` does not prove that `byte_size` exists. The repaired
constraints now explicitly prove non-null values for:

- complete Image Object metadata;
- an external Content Structure target URL;
- an authentication email intent locale;
- both sides of a moderation license transition;
- a resolved Unit ownership claim; and
- Font Awesome icon prefix and name values.

These are database checks because each malformed row would invalidate a shared
state assumption for every writer or reader. Regression tests render and
inspect the Drizzle SQL so a future refactor cannot silently reopen the null
path.

## Limit taxonomy

A numeric maximum needs a named reason. “The query may be slow” is not by
itself a reason for a low product limit; the query still needs a selective
index, keyset cursor, bounded fan-out, and evidence at target cardinality.

| Existing limit | Classification | Enforcement |
| --- | --- | --- |
| Unit Alias/External Link: 128 active per Unit and kind | shared product/cardinality invariant | application precheck and DB trigger |
| Unit Alias/External Link: 16 pinned per Unit and kind | shared presentation-slot invariant | application precheck and DB trigger |
| reference page: default 20, maximum 50 | response/work budget | API only |
| external-link preview: 16 | presentation work budget | service only |
| revision batch: 10,000 logical commands | transaction/work-amplification budget | API and planner only |
| fractional-position external input: 512 ASCII bytes | abuse and operational-headroom budget | API and domain generator |
| fractional-position storage: 1,024 bytes | indexed-storage safety invariant | generator and DB `CHECK` |

The 128/16 reference limits remain in PostgreSQL because all active references
are ranked for cursor-version correctness and contribute to public Unit
presentation or search. A direct writer that bypassed those bounds could make
work unbounded for every viewer of that Unit. The trigger reads at most 128 or
16 entries through existing partial indexes and serializes only one
`(unit_id, reference_kind)` advisory-lock shard. The application now uses the
same lock for creation, curation, and withdrawal. The trigger also covers
`UPDATE OF unit_id`; moving an existing active or pinned row can no longer
bypass the destination capacity check.

Page maxima are deliberately not database constraints. They cap response
serialization, joined-object hydration, network bytes, and per-client
fairness. They do not excuse offset pagination, unindexed filters, or a plan
whose cost grows with corpus size.

## Creation-time Tag applications

Book, Media, Software, and Realm creation accepts at most 32 distinct initial
Tag IDs. One indexed `tag.id IN (...)` lookup proves that every requested Tag
is public, published, approved, and not deleted; one batched insert creates the
direct `unit_tag` applications and one batched insert records the creator's
positive `unit_tag_vote` rows. The work is therefore `O(k)` for `k <= 32`, uses
bounded request memory and network payloads, adds no per-Tag query loop, and
remains inside the Unit creation transaction. Collection membership and the
temporary single-select rule are presentation policy, not persisted
invariants. API quotas provide admission backpressure; concurrent creates use
different `unit_id` keys and only read shared Tag rows, so popular Tags do not
serialize otherwise unrelated creation transactions.

Capacity planning assumes an average of four direct Tags per Unit, with a
long-tailed Tag distribution and one creator vote per initial application. At
500 million Units this is approximately 2 billion `unit_tag` rows and 2 billion
creator-vote rows; at 3 billion Units it is approximately 12 billion rows in
each relation. Each application writes the relation primary key plus the
reverse Tag index, and each vote writes its primary key plus Tag/Profile
indexes and the existing bounded aggregate maintenance. Reads by Unit use the
leading primary-key columns; reverse Tag reads use the `(tag_id, unit_id)`
index and must remain keyset-paginated. The request path never loads a corpus
slice, and the seven curated Collections are a bounded control dataset with at
most 100 items fetched per create-form field.

No new absolute latency target is introduced: this work stays within the
existing Unit-create transaction objective and adds three bounded database
statements. Observe create-transaction latency, lock waits, vote-aggregate
trigger time, relation/index growth, WAL volume, replica lag, and reverse-index
page splits. Before either relation approaches single-node storage or index
maintenance limits, hash-partition it by `unit_id`; at the 3-billion-Unit
estimate, route Unit-owned writes and reads to the same shard and serve global
Tag discovery from partitioned/asynchronous projections. Partition rollout is
a forward schema cutover with backfill and dual-read verification, not a
whole-corpus request-path migration.

## Fractional positions

Fractional positions use a canonical ASCII alphabet, so character length and
UTF-8 byte length are equal after syntax validation. The contracts are:

- external write input: canonical key and at most 512 bytes;
- persisted/read response: canonical key and at most 1,024 bytes;
- soft rebalance threshold: 512 bytes; and
- hard DB invariant: `octet_length(position) <= 1024` on all 17 fractional
  position columns.

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

At 500 million and 3 billion relation rows, routing remains by the owning Unit,
Collection, Structure, Profile, Realm, or Post key. There is no global
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
Realm surfaces, governance notes, Profiles, and Zone-embedded Wiki posts use
this boundary. This turns historical drift into observable repair work without
letting one row fail a complete list.

This tolerance does not authorize executable HTML or arbitrary URL schemes.
The renderer does not execute document JSON, supported links are normalized to
safe schemes, and host-specific custom blocks still pass their structural and
capability policy.

## Constraint rollout

New or tightened corpus constraints are added `NOT VALID`. PostgreSQL enforces
them for new and changed rows immediately without scanning old rows. Existing
rows are validated later, one relation and constraint at a time. Validation is
kept outside the deployment migration so a 500-million-row table cannot turn a
release transaction into an unplanned I/O job.

Inspect all staged constraints:

```sh
DATABASE_ADMIN_URL=... task services-main:db:constraints -- status
```

Validate exactly one allowlisted constraint after repairing any legacy rows
and checking replica lag, database I/O, lock waits, and maintenance headroom:

```sh
DATABASE_ADMIN_URL=... task services-main:db:constraints -- \
  validate unit_localization_position_byte_length_check
```

The command takes a five-second lock timeout, validates no second constraint,
and is idempotent. PostgreSQL validation scans the existing relation but does
not block ordinary concurrent reads and writes. `validate-disposable` is
hard-restricted to the `rezics_atlas` migration-replay database and exists only
so schema reconciliation can compare the fully validated target.

At 500 million rows, validation cost is one linear heap pass per selected
constraint plus the predicate's bounded per-row CPU. At 3 billion rows, perform
validation per physical partition/shard and schedule it against measured I/O
headroom; do not launch all 23 scans together. A failed validation leaves the
constraint installed and protecting new writes, so repair can proceed forward.

## Review checklist

For every new check or maximum, record:

1. the concrete failure prevented, not merely that a value is “invalid”;
2. the narrowest layer that can prevent that failure for every relevant writer;
3. SQL null semantics and whether nullable operands are proved explicitly;
4. request-path complexity, selected index, maximum rows/bytes touched, and hot-key behavior;
5. behavior at 500 million rows and the 3-billion-row partition/shard path;
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

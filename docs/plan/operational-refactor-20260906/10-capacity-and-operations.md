# P10 — Bounded processing, capacity and operational recovery

Status: operational foundations exist; event-streaming architecture accepted 2026-09-07; broker integration and production qualification pending under the design-review gate. Parent: [program and gates](README.md).

## Outcome and current owners

Qualify a sustainable deployment for the promised product portfolio. [System audit](../../report/REZICS-system-readiness-audit-20260906.md) and [source budget](../../report/REZICS-source-integration-and-review-20260906.md) provide specific findings and growth math.
Owners: `services/main/src/worker.ts`, `services/email/outbox.ts`, auth delivery callbacks, database schemas/SQL/projections, `deploy`, `docs/operations`, and host-owned configuration in sibling `../nixos` when implementation reaches that repository.

## Selected operational architecture

- Keep transactional business state on PostgreSQL/PGroonga with explicit domain owners. Use the accepted [NATS JetStream event/task architecture](../../architecture/event-streaming.md), qualifying Debezium Server as the preferred outbox relay and Bun workers as consumers. This supersedes the default of PostgreSQL carrying every new event/ready-job queue; PostgreSQL still owns plans, outbox, business checkpoints and application receipts. Kafka/RabbitMQ/Redpanda remain documented alternatives, not additional initial services.
- Separate latency-sensitive email/notification work, source acquisition, AI calls, canonical application, projections and bulk repair into bounded queues/executors. No slow external model call inside the current serial shared worker loop.
- All leased jobs carry a fencing token or claim generation. Success, failure, renewal and side effects validate it. Fix the existing email outbox's id/status-only completion predicate before broader automation.
- Authentication email enqueue failure must be awaited/observable and retryable at the request boundary; fire-and-forget promise loss is not accepted delivery.
- Transactional outbox + idempotent consumers is the event contract. No claim of exactly-once external delivery; use provider idempotency when available and explicit uncertain-send reconciliation.
- Separate replayable event streams from competing task streams. Use independent durable pull consumers by business purpose/shard, not by Unit or SourceSubscription. ACK only after committed application or continuation; broker redelivery never replaces current authority/revision fences. Track failure disposition and replay explicitly rather than assuming `MaxDeliver` creates a complete dead-letter workflow.
- Qualify file storage, R3 stream/consumer state across independent failure domains and `sync_interval: always` for critical events. Monitor connector offsets/replication-slot WAL, hot-window exhaustion and backpressure through the outbox. Single-node development is not production HA. The architecture document owns exact transport/recovery contracts and dated version evidence.
- Independent connection/concurrency/rate budgets protect foreground queries from imports and model retries. Backpressure stops new acquisition before disk/queue exhaustion.
- Require physical base backup plus continuous WAL where PITR is the recovery target, retaining logical export as additional portability evidence. Qualify PostgreSQL extensions including PGroonga recovery; existing daily logical backup alone cannot prove a five-minute RPO.
- Keep off-host backup, restore drills and asset recovery. A replica is neither a backup nor proof of high availability. Current host capacity is measured, never inferred from an RS product name.
- Back up a protected erasure/revocation ledger with a recovery strategy at least as strong as the data recovery contract. Before restoring traffic, replay completed erasures/revocations across canonical/private state, sessions, caches, exports and eligible source/AI payloads; test restoration from a backup predating deletion.

## Starting workload and limits to measure

These are selected qualification targets, not current measurements.

For the 2026-09-07 identity/grouping contract, measure owner-local identity and
owner-locator storage separately at 500M and 3B logical IDs. Use the
[schema report's routing budget](../../report/REZICS-source-complete-catalog-schema-20260906.md#5-schema-qualification-and-capacity)
as an estimate until sampled heap/index sizes replace it. Include additional
target-routing keys, indexes, revision/evidence and order-profile amplification;
the locator is not a bounded configuration dataset.

Run the workload below with concurrent ID creation/routing publication, cache
misses and locator repair/rebuild. Include 1M-member franchises and independent
continuities; page direct members by indexed owner/profile/cursor, never recurse
through every descendant for an ordinary read or activity write. Cap batch counts
and bytes, repair concurrency and queues; use resumable owner/key checkpoints.
Measure p95/p99 resolution and mutation latency, WAL, lock contention and rebuild
reserve. Physical owner splitting alone does not prove 500M/3B capacity. Select
partition/shard cutovers before the existing protection thresholds are crossed.

| Input/target | Initial test profile |
| --- | --- |
| Foreground mix | 100 reads/s, 20 writes/s, 32 clients; separate 5× burst |
| Source processing | 50 changed/normalized objects/s with actual child-row and WAL amplification |
| Dataset distribution | Real source distributions; 99% ordinary owners plus 1M-edge/occurrence/list hot owners and skewed popular keys |
| API latency | Detail p95 ≤300 ms; search p95 ≤400 ms / p99 ≤1.2 s; simple writes p95 ≤500 ms, excluding third-party latency |
| Unexpected server errors | <0.5% of admitted requests under the qualification workload; every permission/privacy invariant still must pass |
| Projection lag | p95 ≤60 seconds in steady state; permissions never rely solely on stale projections |
| Source freshness | p95 processing ≤24 hours after an eligible upstream snapshot/change becomes available; stricter tiers only where source cadence supports them |
| AI / human queue | automated cases p95 ≤15 minutes when admitted; actionable human cases ≤2 working days |
| Recovery | RPO ≤5 minutes for canonical/user state; RTO ≤4 hours at the measured deployment size |
| Protection thresholds | investigate at sustained 70% disk/IO or query p95 breach; stop bulk admission before free space falls below the larger of 30% or measured restore/rebuild/WAL reserve |

## Capacity ledger required before risky implementation acceptance

Apply the accepted architecture's [message-rate and retention model](../../architecture/event-streaming.md#capacity-model)
alongside the domain-row ledger below. Account separately for broker replication,
consumer delivery bandwidth/state, ready tasks, retained events, outbox/receipts,
connector WAL and recovery archives. 72-hour hot replay is a planning input;
retention and deployment sizing must be qualified together. A stream's replicas
provide fault tolerance; multiple routed streams provide write distribution.

The [design-review gate](00-source-complete-schema.md#design-review-gate) first
requires a compatible physical-key/routing plan and workload assumptions; actual
benchmarks qualify the implementation later. Resolve the current source mapping
claim's global `(mapping_key, owner)` uniqueness and source binding's
`mapping_key`-only PK before claiming source-record/owner partitionability.
Source-key admission, locator rebuild and reverse subscription fan-out need their
own keys and fences; domain table separation does not solve these operations.

For **every** corpus-scale relation, model 500M rows and 3B rows, and the larger child counts induced by object fan-out. Required columns: owner, row count formula, average/p99 row width, indexes, read/write rates, query order, latency, concurrency, hot key, WAL, memory, network, history retention, backup/rebuild space/time, and partition/cutover trigger.

Include the [source subscription/scheduling workload](../../report/REZICS-source-integration-and-review-20260906.md#75-subscription-and-scheduling-amplification):
active subscriptions, shared record/query/feed check plans, due/ready indexes,
observation/outbox publication, resumable reverse fan-out and target application
receipts. Separate source requests from local target mutations. Bound compatible
fetch deduplication, credential scopes, timer catch-up, retries, queue age/bytes,
per-provider rates and per-target coalescing. A feed plan may cover many records;
do not create a timer per Unit or scan the corpus to discover due work.

Also budget native structure, structured source observations and raw archives
separately. The foundation's illustrative 72 value nodes per identity produce
36B/216B rows at 500M/3B identities. Retention and justified structured storage
must be selected before accepting that write/storage amplification; no required
semantics may be dropped to make the estimate fit. Batched inserts inside one
large owner-locked transaction are not resumable bounded processing. Specify
staged publication and transaction/lock budgets for large records and containers.

Illustrative decimal totals: identity at 240 B/row is 120 GB/720 GB; named forms at 288 B are 144 GB/864 GB; relationships at 240 B are 120 GB/720 GB; history at 256 B is 128 GB/768 GB. These exclude payloads and additional indexes unless the measured definition says otherwise. N objects × 20 relations means 10B/60B relations at 500M/3B objects, not 500M/3B relation rows.

At N objects, b bindings/object and u changed binding fraction/day, change arrival is Nbu/86400 per second. A monthly sweep of 3B objects is about 1,157 objects/s before child writes or retries. Snapshot-level change detection and selective adoption must replace per-binding polling. Model token cost and human review capacity separately from database throughput.

Start flat where appropriate, then partition heavy families by stable ownership/time according to access. PostgreSQL partitioned uniqueness must include partition keys or use a separately designed uniqueness owner. Before sharding, prove source-key uniqueness routing, cross-owner reads and migration fencing. Partition count alone proves neither throughput nor distributed scalability.

Groonga table-record, key-space, distinct-term and index-size limits are independently binding. Record actual index flags/version limits, alert at 50% of the tightest proven limit and complete serving partition/cutover before 70% or sooner when forecast growth consumes lead time. Routing and result merging must remain bounded. A single PGroonga index is not a 500M/3B capacity design. See [Groonga limitations](https://groonga.org/docs/limitations.html).

## Implementation and evidence

1. Capture actual host/database/extension versions, disk, bandwidth, restore time and current data distribution read-only at the implementation gate.
2. Repair queue fencing/auth enqueue and isolate workloads; add metrics for oldest age, leases, attempts, errors, throughput and dead-letter recovery.
   Qualify the accepted broker/relay boundary on one source-to-canonical-update
   path before broader integration. Precreate persistent streams, pin versions,
   verify publish-ACK/offset ordering, and test duplicate delivery and current
   subscription/authority checks. New-system outbox CDC is independent of legacy
   offline conversion. A bounded SQL relay is the documented fallback if Debezium
   cannot meet the measured integration/operational requirements.
3. Build a repeatable skewed benchmark/load generator and capacity workbook/manifest from real row samples; no need to populate 500M physical local rows, but show the scaling argument and representative plans.
4. Run concurrent imports with foreground reads/writes, source/API failures, paused consumers, model timeouts and hot-key writes. Inspect `EXPLAIN (ANALYZE, BUFFERS)`, WAL and lock waits.
5. Implement backup/PITR and extension-consistent restore; prove identities, user state, historical evidence and search rebuild/recovery on another environment.
6. Exercise release failure, credential revocation, resource exhaustion and stale worker scenarios. Record playbooks and a safe bulk-work stop switch.
7. Replace estimated ledger widths with measured values and document remaining scale envelope. If the current deployment cannot qualify, add capacity or narrow activation; do not erase the long-term baseline.

## Verification boundaries

Operational invariants and targeted tests are mandatory; GitHub's advisory Check status remains advisory. Repository frontend policy still applies. The host's unrelated Outline service is out of scope and must not be stopped or purged during REZICS migration.

Primary references: [PostgreSQL partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html), [PITR](https://www.postgresql.org/docs/current/continuous-archiving.html), [transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).

## Implementation ledger

2026-09-06, first operational slice:

- Email claim generation and expiry fence completion, retries, failure and renewal;
  expired and pending claims use separately limited partial-index scans.
- Authentication awaits durable enqueue. A Better Auth integration propagates
  enqueue errors through its otherwise error-swallowing background helper.
- Five selected worker lanes isolate scheduling and per-job errors. Nomad runs
  delivery and background work in separate processes, each with three database
  connections, retaining the prior aggregate resource allocation.
- Backend TypeScript and 1,435 tests across 242 files passed. Nomad static
  validation and formatting passed; no Nomad server deployment was performed.
- All 37 existing migrations replayed on isolated PostgreSQL; the production
  writer passed expiry/reclaim rejection, eight nonoverlapping concurrent claims,
  and sensitive-payload clearing checks. A 300,000-row fixture verified both
  claim queries use their partial indexes without pre-limit sorting.
- [Email owner documentation](../../../services/main/src/services/email/README.md)
  records commands, measured plans, 500M/3B estimates and unqualified limits.

Follow-up: the Dockerfile now uses PGDG's signed archive with the base image's
exact PostgreSQL package version. A fresh build retained server/client 18.4 and
PGroonga 4.0.8; all 37 migrations, claim races and the 300,000-row query fixture
passed again on that build. The orphan Tag query was removed and the unchanged
online-count gate passes.

The restored `rezics-dev` was verified through its container's `psql`: PostgreSQL
18.4, PGroonga 4.0.8 and completed migration `20260902101640`. The read-only
inventory command records schema/runtime metadata and Profile/Auth foreign keys.
This local evidence does not qualify production. Production capture, recovery,
retention, admission control and mixed-workload qualification remain pending.

P05 acceptance repair added and locally verified forward migration
`20260906143437_unit_search_document_tombstones.sql`. The complete disposable
migration check passed, including canonical SQL equality, schema synchronization
and PGroonga health. The ordinary `rezics-dev` database was upgraded through Atlas
and its completed revision verified using the container's `psql`; no reset was needed.

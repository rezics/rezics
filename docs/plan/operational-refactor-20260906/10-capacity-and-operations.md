# P10 — Bounded processing, capacity and operational recovery

Status: implementation in progress. Date: 2026-09-06. Parent: [program and gates](README.md).

## Outcome and current owners

Qualify a sustainable deployment for the promised product portfolio. [System audit](../../report/REZICS-system-readiness-audit-20260906.md) and [source budget](../../report/REZICS-source-integration-and-review-20260906.md) provide specific findings and growth math.
Owners: `services/main/src/worker.ts`, `services/email/outbox.ts`, auth delivery callbacks, database schemas/SQL/projections, `deploy`, `docs/operations`, and host-owned configuration in sibling `../nixos` when implementation reaches that repository.

## Selected operational architecture

- Keep the initial business system on PostgreSQL/PGroonga with explicit domain owners; scale worker processes/pools independently. Do not add Kafka, a separate search engine or a database per semantic class without measured need.
- Separate latency-sensitive email/notification work, source acquisition, AI calls, canonical application, projections and bulk repair into bounded queues/executors. No slow external model call inside the current serial shared worker loop.
- All leased jobs carry a fencing token or claim generation. Success, failure, renewal and side effects validate it. Fix the existing email outbox's id/status-only completion predicate before broader automation.
- Authentication email enqueue failure must be awaited/observable and retryable at the request boundary; fire-and-forget promise loss is not accepted delivery.
- Transactional outbox + idempotent consumers is the event contract. No claim of exactly-once external delivery; use provider idempotency when available and explicit uncertain-send reconciliation.
- Independent connection/concurrency/rate budgets protect foreground queries from imports and model retries. Backpressure stops new acquisition before disk/queue exhaustion.
- Require physical base backup plus continuous WAL where PITR is the recovery target, retaining logical export as additional portability evidence. Qualify PostgreSQL extensions including PGroonga recovery; existing daily logical backup alone cannot prove a five-minute RPO.
- Keep off-host backup, restore drills and asset recovery. A replica is neither a backup nor proof of high availability. Current host capacity is measured, never inferred from an RS product name.
- Back up a protected erasure/revocation ledger with a recovery strategy at least as strong as the data recovery contract. Before restoring traffic, replay completed erasures/revocations across canonical/private state, sessions, caches, exports and eligible source/AI payloads; test restoration from a backup predating deletion.

## Starting workload and limits to measure

These are selected qualification targets, not current measurements.

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

For **every** corpus-scale relation, model 500M rows and 3B rows, and the larger child counts induced by object fan-out. Required columns: owner, row count formula, average/p99 row width, indexes, read/write rates, query order, latency, concurrency, hot key, WAL, memory, network, history retention, backup/rebuild space/time, and partition/cutover trigger.

Illustrative decimal totals: identity at 240 B/row is 120 GB/720 GB; named forms at 288 B are 144 GB/864 GB; relationships at 240 B are 120 GB/720 GB; history at 256 B is 128 GB/768 GB. These exclude payloads and additional indexes unless the measured definition says otherwise. N objects × 20 relations means 10B/60B relations at 500M/3B objects, not 500M/3B relation rows.

At N objects, b bindings/object and u changed binding fraction/day, change arrival is Nbu/86400 per second. A monthly sweep of 3B objects is about 1,157 objects/s before child writes or retries. Snapshot-level change detection and selective adoption must replace per-binding polling. Model token cost and human review capacity separately from database throughput.

Start flat where appropriate, then partition heavy families by stable ownership/time according to access. PostgreSQL partitioned uniqueness must include partition keys or use a separately designed uniqueness owner. Before sharding, prove source-key uniqueness routing, cross-owner reads and migration fencing. Partition count alone proves neither throughput nor distributed scalability.

Groonga table-record, key-space, distinct-term and index-size limits are independently binding. Record actual index flags/version limits, alert at 50% of the tightest proven limit and complete serving partition/cutover before 70% or sooner when forecast growth consumes lead time. Routing and result merging must remain bounded. A single PGroonga index is not a 500M/3B capacity design. See [Groonga limitations](https://groonga.org/docs/limitations.html).

## Implementation and evidence

1. Capture actual host/database/extension versions, disk, bandwidth, restore time and current data distribution read-only at the implementation gate.
2. Repair queue fencing/auth enqueue and isolate workloads; add metrics for oldest age, leases, attempts, errors, throughput and dead-letter recovery.
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

Unresolved findings are not completed acceptance: the production host/configuration
is unavailable in this checkout; the fresh image's package installation upgraded
PostgreSQL 18.4 to 18.6; the existing online-count gate still rejects
`tags/service.ts`'s window count (P06/SYS-08). Recovery, retention, admission control,
mixed-workload qualification and production activation remain pending.

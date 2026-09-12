# Relationship query performance

This suite measures REZICS's native Filter → SQL → real Bun HTTP API path. Vitest
continues to own deterministic behavior checks. Provider snapshots and showcase
packs belong to design validation and are not inputs to this suite.

## Run

This harness owns reproducible native relationship-load datasets. Use its bounded
`--rows`, `--seed` and isolated-container lifecycle for scale experiments; ordinary
development content belongs to the main seed service. Dataset support follows the
native workload matrix below, with each additional owner requiring its own fixture
contracts and measured distribution.

Use Docker, Node/Yarn, Task and Bun 1.4.2 or newer. The first command builds the
repository's PostgreSQL/PGroonga image and the pinned gMark generator. k6 is
downloaded into `.temp/performance-tools` with a pinned SHA-256 checksum.

```sh
task services-main:performance:check
task services-main:performance:tools
task services-main:performance:run
task services-main:performance:run -- --mode load --rows 10000 --rate 10 --duration 180 --vus 32
```

The default smoke run executes every selected query journey once, without a
latency acceptance threshold. Load mode uses k6's constant arrival rate, requires
at least 20 successful journeys per case, rejects dropped iterations and errors,
and checks per-case and overall p95/p99. Defaults are 2,000/5,000 ms per journey;
`--p95` and `--p99` set the experiment's budgets. A journey includes the requested
cursor pages. A small sample is an operational check, not a stable tail estimate.

Options include `--seed`, `--rows`, `--case <ID substring>`, `--rate`, `--duration`
(seconds), `--vus`, `--jit on|off` (default `on`), and
`--cache warm|postgres-restart`. JIT changes only the isolated reader role and is
recorded in the run configuration and query plans. The restart experiment
clears PostgreSQL shared buffers; it does not clear host or storage caches.

Each run creates a loopback-only container, applies the committed Atlas history,
checks its revision receipts, and loads only that new database. Native constraints
and triggers remain enabled. Shared definitions are initialized through their
owning service. The measured API uses a non-superuser role with SELECT-only table grants. Development
database URLs are never accepted as command arguments.

Use `--keep` to retain a dataset for repeated experiments, then `--reuse <runId>`
with the same rows and seed. Reuse checks the container's ownership label, tool
versions and migration receipts. A reused container is not removed automatically.
Cleanup of new containers checks both their exact generated name and ownership
label. New containers enable core dumps; reused containers retain their original
limits, which the report records with the engine core pattern and PID suffix setting. Interrupted runs may leave containers; identify them from their report
before removing them. Database installation can require several GB of temporary
WAL even for the smoke dataset because the native baseline has many partitions.

## Workload and evidence

`relations.xml` configures gMark topology: skewed incoming degree and bounded
outgoing degree. `dataset.ts` maps it onto native publishing identities, credits
and subject associations, then adds controlled correlated and disjoint relations,
hot/rare keys, Realm membership, tags, scores and equal-timestamp sort ties. Data
loading streams graph edges and batches database writes. gMark itself retains
generator state in memory.

`workload.ts` owns an explicit matrix of 86 native API cases: 21 relationship/list
shapes × two parameter buckets × two sorts, plus two text cases. It exercises
`all/any/not`, `some/none`, nested predicates, correlated/disjoint conditions,
indexed/unseeded OR branches, star joins, facets and cursor journeys. gMark's
generated graph-query XML is retained as generator output but is not counted as
API coverage: unsupported graph operators cannot be silently treated as native
Filter features. Add native cases here and validate them with the shared parser.
This matrix is not exhaustive coverage of every relation family or legal AST.

Reports live in `.temp/performance/<runId>/`:

| Artifact | Evidence |
| --- | --- |
| `report.json` | Seed, scale, graph checksum, tool versions, physical rows/bytes, completed/missing cases, phase failures, SQL statistics |
| `sql.jsonl` | SQL and bind values captured from the real API, labelled by native case |
| `plans.json` | `EXPLAIN (ANALYZE, BUFFERS, SETTINGS)` summaries: operator rows/loops, estimation error, sort methods, inclusive root I/O |
| `workload.json`, `k6-summary.json` | Reproducible HTTP workload and latency/error/underfilled-page/cursor-cycle metrics |
| `api-*.log`, `k6.log`, failure `postgres.log`/`pgroonga.log`/`postgres.core` | Process diagnostics; SQL capture is disabled during k6 measurement; each native artifact records captured/unavailable separately |
| `pgbench.log` (load mode) | A separate SQL-only mixed workload replaying captured parameters, including statement preparation |

SQL diagnostics execute as the reader in read-only transactions with a 10-second
statement timeout. Failed requests, missing cases, failed plans and load thresholds
remain failures. Underfilled pages are reported independently: an empty legitimate
result does not imply a query error. SQL replay runs after HTTP load and is not
subtracted from HTTP timings as if both measured identical cache/concurrency states.

## Capacity experiments

The planning baseline remains **500,000,000 rows**, with an estimate at
**3,000,000,000 rows** for every corpus-scale relation. `--rows` counts generated
publishing resources, not total physical rows. If measured mean credit and subject
degrees are `c` and `s`, those relations grow as `N*c` and `N*s`; membership,
effective tags, scores, names, indexes and history add separate amplification.
Use the report's relation-specific bytes/row and degree distribution to estimate
both planning scales, then include free space, WAL, replicas, backups and retention.
Do not infer total storage from resource count alone.

The local generator has a bounded 100-million-resource input ceiling, not a claim
that this host can load that size. Larger experiments require partitioned offline
generation and enough storage/RAM. Measure generator peak memory, setup/WAL costs,
working-set residency, skew, concurrent arrivals, and actual reads before scaling.
Repeat at increasing sizes and several seeds; compare warm/restart runs and keep
hardware/database settings with retained reports. Prepared/generic plan behavior
and write concurrency need separate experiments.

The harness deliberately does not certify 500M/3B operation. It supplies evidence
for finding the limiting query/operator and deciding indexed candidate paths,
partition pruning, sharding or archival. Logical correctness, ingestion/source
compatibility and production capacity acceptance remain separate work.

Tool references: [gMark](https://github.com/gbagan/gmark),
[k6 arrival-rate executors](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/),
[PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html),
[pgbench](https://www.postgresql.org/docs/current/pgbench.html).


## Native failure artifacts

The [diagnostic collector](../scripts/performance/diagnostics.ts) checks the exact
container name and run ownership label before copying artifacts. PostgreSQL logs,
PGroonga logs and a native core are captured independently, so an absent extension
log cannot suppress a valid core. The original experiment failure remains the
reported failure. The collector waits up to 30 seconds for Linux [CoreDumping](https://www.man7.org/linux/man-pages/man5/proc_pid_status.5.html) to clear before copying a core, avoiding an in-progress dump. Core copying supports the pinned image's PGDATA directory with
engine pattern `core` and PID suffix disabled; other engine patterns remain visible
in `coreDumpSettings` and require their matching collection path. Kernel settings
are not changed globally. Existing reused containers may still have a zero core limit.

Run `task services-main:performance:diagnostics:check` to start a separate scratch
container, deliberately abort one sleeping PostgreSQL backend, wait for recovery,
and verify a nonempty ELF core and server log through the same collector. The
[pinned capture](../../../docs/testing/database/performance-diagnostics-evidence.json)
passes eight assertions and copied a 178,716,672-byte core. No application schema
or user dataset is installed in that drill. Artifacts stay under `.temp`; cores are
not committed. The test rejects a mismatched ownership label and tears down only
its generated container. This proves capture, not the cause or repair of the
open facet-search/Atlas crashes.

Reserve space for a backend's dumped address space plus the copied artifact when
running crash experiments. Copying has a 60-second deadline and reports failure
explicitly; retain the owned container with `--keep` when further native inspection
is needed. Core size follows process memory and workload, not just catalog rows.


## SQL replay integrity

Each SQL replay copies the current generated scripts into the container directory,
including when a dataset is reused. Docker's [directory-content copy syntax](https://docs.docker.com/reference/cli/docker/container/cp/)
avoids nesting the new directory beneath old scripts. Only filenames selected for
the current workload are passed to pgbench. Native stdout/stderr is written to
`pgbench.log` even when pgbench exits with an error; errors remain failed runs.

`task services-main:performance:sql-replay:check` runs a separate scratch PostgreSQL
container and replays a valid query, a changed division-by-zero query, and another
valid query through the actual helper. The [pinned run](../../../docs/testing/database/performance-sql-replay-evidence.json)
passes five assertions: the changed query fails, its native error log survives,
a subsequent valid script succeeds, and transaction-local settings stay isolated.
Before the repair, the changed invalid query falsely passed because the container still executed the first script.
No application schema is installed in this fixture. This qualifies replay input
and failure capture, not application query latency or corpus capacity.

SQL capture contains read statements, not the API's complete transaction topology.
Like the EXPLAIN diagnostic, replay gives each captured query its own read-only
transaction and ten-second statement budget, including preparation and commit cost.
A captured `set_config(..., true)` therefore cannot impose its timeout or other
local settings on a later query from a different API transaction. The fixture sets
a short timeout and an application name, then verifies that a later read inherits
neither. Collapsing those statements into one replay transaction caused false
facet timeouts. Application/Search deadlines remain unchanged and are qualified
by the actual HTTP workload; the SQL diagnostic is a separate comparison.


## Database connection loss

All harness PostgreSQL clients register error handlers before connecting. An idle
connection loss is recorded as an experiment failure, including during initial
reuse and cache-restart setup. Failed EXPLAIN work retains its partial plan file;
connection cleanup does not suppress the original report. Connection failures do
not qualify an interrupted workload as passed.

On a retained run-owned dataset, run
`task services-main:performance:connection-loss:check -- <datasetRunId>` with no
other harness using that dataset. The fixture launches the actual harness and
terminates only its uniquely named idle administrator backend. The
[pinned run](../../../docs/testing/database/performance-connection-loss-evidence.json)
passes six assertions, verifies a failed report and captured server log, and
preserves the dataset. This is an intentional connection-loss test, not a native
engine-crash repair. A host shutdown can still prevent the process from writing
its final report; interrupted reports must not be counted as acceptance evidence.


The [pinned Linux comparison](../../../docs/testing/database/native-facet-linux-evidence.json)
records the original 10,000-resource graph under both JIT settings and focused
HTTP/SQL load results. It keeps host/image, exact graph, plans, budgets and
artifact checksums together. The [native crash](../../../docs/testing/known-failures.md#native-facet-search-abort)
remains open because it has not reproduced on this host.

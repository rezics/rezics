# Dependency upgrade and relationship-query performance qualification

Work performed on `main`, starting at `65ed4095b`, on September 9–10, 2026.
This record distinguishes successful integrity checks from failed database stress
qualification. The new harness is documented in
[the owning performance guide](../../services/main/performance/README.md).

## Dependency decisions

The audit covered 31 npm manifests, the Yarn toolchain, Rust manifests/lock,
Nix inputs, Terraform provider lock, Docker images and GitHub Actions. Selected
package versions use official registry/release metadata available on September 9.
Existing prerelease families remain on their corresponding release line.

| Component | Selected version |
| --- | --- |
| Elysia | `2.0.0-beta.14` |
| Elysia OpenAPI / CORS | `2.0.0-beta.4` / `2.0.0-beta.1` |
| TypeBox / exact-mirror | `1.3.23` / `1.2.6` |
| Bun / Yarn | `1.4.2` / `4.18.0` |
| React / Vite / TypeScript | `19.2.8` / `8.2.2` / `7.0.2` |
| Kubb | Stable `5.1.0`, with individual plugins at their current stable versions |
| Vitest | `4.1.10` |
| PostgreSQL / PGroonga | `18.6` / `4.0.8`; load qualification has failures below |

Compatibility holds are deliberate:

- TypeBox `1.3.30` removed compiler internals still used by the selected Elysia
  beta. `1.3.23` passes eager compilation of every production API route. The new
  API test exercises `api.compile()`, so import-only tests cannot miss this again.
- Storybook `11.0.0-alpha.0` declares Vitest 3/4 peers, not Vitest 5. All Vitest
  packages remain aligned on 4.1.10. Existing Storybook patches remain in place.
- Astro's checker requires the JavaScript compiler API; its TypeScript 6.0.3
  dependency remains scoped to that owner. Application typechecking uses TS 7.
- The repository's Yarn release-age gate retained Astro 7.3.1, MDX 8.0.0,
  Cloudflare Vite plugin 1.54.5, Wrangler 4.129.1, Portable Text editor 7.12.3,
  toolbar 8.0.52, Markdown 2.0.0, and AWS S3 packages 3.1127.0 instead of the
  respective releases younger than 24 hours. The gate was not weakened.
- Nix inputs were refreshed with the available devenv 2.1.2 CLI and evaluated
  successfully. Building the newer devenv CLI locally failed in an upstream
  `boehm-gc` configure check about source/build timestamps. The CI bootstrap pin
  was retained; this is not a claim that the new CLI or a complete Nix shell was built.

The upgrade also updates cookie 2.x callers, image metadata handling, Elysia error
tags, nullable/recursive OpenAPI components, and Kubb recursive enum naming. SDK
outputs are regenerated through their owning tasks.

## Repairs exposed by verification

- Native catalog resources in Zone lists now resolve to their catalog routes.
  Grid and carousel stories cover the four native owner examples.
- Video metadata edits omit unchanged adapted-audio relations and explicitly
  clear removed relations. Migrated frontend test fixtures use current contracts.
- Hidden Shelf slides are inert, preventing focus inside aria-hidden content.
- Grouped search continuation preserves an empty `facets` array when the next
  page does not request aggregation. Previously the missing value could fail the
  grouped response assembly on later pages.
- Idle PostgreSQL pool errors are logged instead of becoming uncaught process
  errors. The pool can discard a failed idle connection and reconnect for the
  next request; the native database crash itself remains unresolved.

## Verification

- Final `task typecheck` passed across the repository after client regeneration.
- Backend: 328 files, **1,782 tests passed**, including eager route compilation,
  the empty-facet regression and the idle-pool error regression. Backend
  typechecking passed again after the pool fix.
- Web: 281 files, **1,027 tests passed**.
- A live Bun check terminated only its own idle connection on the isolated
  performance database, observed the pool error log, and verified that the next
  query used a new PostgreSQL backend. The process remained alive.
- Shared-library, editor, SDK and text-app checks also passed in their owning
  suites; Rust tests passed. Web and About production builds completed.
- Grid and carousel Storybook interactions/a11y checks passed; the actual
  1280×900 screenshots were inspected after the focus fix. Full-application
  browser acceptance was outside this task's requested boundary.
- Nix lock refresh and `devenv info` evaluation passed. This does not certify a
  complete Nix build or remote GitHub workflow execution.
- `task openapi:check` passed: regeneration matches the committed contract/SDKs.
- Repository-wide formatting still reports **231 unchanged files** with existing
  discrepancies. Changed source/generated files are formatted; formatter rules
  and CI remain enabled. These unrelated files were not rewritten.

## Performance evidence and unresolved failure

Host: Windows, Intel Core i9-14900HX, 32 logical processors, approximately 32 GiB
RAM; Docker Desktop Linux engine reported approximately 15.5 GiB available.
The API ran under Bun 1.4.2 and the disposable database under PostgreSQL 18.6,
PGroonga 4.0.8 and Groonga 16.1.0. All experiments used seed `20260909`.

| Experiment | Result |
| --- | --- |
| 1,000 resources, 86 cases, JIT on, smoke (`7f9a63289ddc4386`) | 86/86 preflight cases, 778/778 distinct SQL plans; k6 completed 103 pages without errors or cursor cycles. Observed journey p95 1,072 ms and p99 1,233 ms, with one journey per case—not a tail-latency qualification. |
| 1,000 resources, two `and-correlated.hot` cases, JIT off, 2 arrivals/s for 30 s (`c5ecf0192473f22d`) | One run passed 61 journeys, p95 934 ms, p99 987 ms, no dropped iterations; subsequent 4-client/10-second pgbench replay had no failed transactions. |
| Same focused load repeated (`50ab0c5a960a3bee`) | Failed with a native database disconnect/crash. The earlier successful run does not establish stability. |
| Fresh 10,000-resource dataset, 86 cases, JIT off (`2053189bfe6bd28d`) | Migration and load completed; 86/86 preflight cases and 866/866 distinct plans succeeded. The subsequent k6 smoke failed when PostgreSQL aborted. The run-owned container was removed by normal cleanup. |

The 10,000-resource generator emitted 37,641 graph edges. Selected physical tables
contained 26,908 credits, 28,720 subject associations, and 10,010 direct/effective
tag rows each. These are actual generated relationships, not mocked query costs.
Its graph SHA-256 was
`b4089e971c11fea83c1c95afa188d2027a6ffabaf57215cb13d654c3598413a6`.

Crashes occurred while executing the `search_candidate` facet statement.
PostgreSQL logged backend termination by signal 6. PGroonga's crash log captured
different native stacks, including `check_stack_depth → copyObjectImpl` and
`nocachegetattr → get_attstatsslot → var_eq_const`, with an index-cost call in
`pgroonga.so` in the latter stack. JIT-off runs also failed, so JIT is not an
established root cause or sufficient workaround. No schema/constraint was weakened
to turn the experiment green. Existing development databases were not reset.

The harness now retains case/page progress, partial coverage, SQL/bind values,
k6 results, PostgreSQL logs and PGroonga crash logs on failure. New run reports also
record source revision/dirty state, host details, database image ID/settings and
the explicit JIT setting. Reports are temporary; this document preserves the
result and the workload remains executable from committed code.

Reproduce with:

```sh
task services-main:performance:tools
task services-main:performance:run -- --rows 10000 --jit off
task services-main:performance:run -- --mode load --rows 1000 --case and-correlated.hot --rate 2 --duration 30 --vus 8 --jit off
```

Repeat with `--jit on` for comparison. The next diagnostic step is the same image
and workload on a separate Linux host, with a native core/backtrace and reduced
facet SQL. Engine, extension and host effects remain unseparated. The upgraded
database runtime is **not qualified for sustained production load** by this work.

## Capacity arithmetic, not capacity acceptance

Every corpus-scale relation retains a 500,000,000-row planning baseline and a
3,000,000,000-row estimate. The following linear storage estimates use the
10,000-resource experiment's observed table-plus-index bytes per physical row:

| Relation | Observed bytes/row | 500M rows, GiB | 3B rows, GiB |
| --- | ---: | ---: | ---: |
| Publishing identity | 599.7 | 279.2 | 1,675.4 |
| Publishing named form | 598.0 | 278.5 | 1,670.8 |
| Credit attribution | 407.0 | 189.5 | 1,137.3 |
| Subject association | 443.3 | 206.4 | 1,238.4 |
| Realm membership | 620.1 | 288.8 | 1,732.6 |

These are per-relation row counts, not catalog-resource counts or whole-database
estimates. For `N` resources, measured degrees imply about `2.6908*N` credit rows
and `2.8720*N` subject rows in this synthetic distribution. History, other owners,
replicas, free space, WAL, backups and retention require additional budgets. Index
height, skew, cache residency, maintenance and planning costs do not scale linearly
with the storage arithmetic. The native crash is a current limiting failure mode;
500M/3B latency, throughput and operational acceptance remain unproven.

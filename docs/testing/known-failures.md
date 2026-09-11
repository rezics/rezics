# Open backend regressions

Keep only unresolved failures and reproduction/closure requirements here. Completed repairs belong in owning tests and Git history. These observations are dated evidence, not a claim that every current environment has the same failure.

## Native facet-search abort

Observed September 9-10, 2026 on Windows with Docker Desktop Linux, Bun 1.4.2, PostgreSQL 18.6, PGroonga 4.0.8 and Groonga 16.1.0. The host had an Intel Core i9-14900HX and approximately 32 GiB RAM; the container engine reported approximately 15.5 GiB. Seed: 20260909.

- Repeated focused and-correlated.hot load on 1,000 resources failed after an earlier passing run. Failing run identifier: 50ab0c5a960a3bee.
- A fresh 10,000-resource workload passed 86 preflight cases and 866 distinct plans, then PostgreSQL aborted during k6 smoke. Run: 2053189bfe6bd28d.
- The workload included 37,641 graph edges; graph digest: b4089e971c11fea83c1c95afa188d2027a6ffabaf57215cb13d654c3598413a6.
- PostgreSQL reported signal 6 while executing the search_candidate facet statement. Native stacks included check_stack_depth -> copyObjectImpl and nocachegetattr -> get_attstatsslot -> var_eq_const, with a pgroonga.so index-cost call in the latter.
- JIT-off also failed. Engine, extension and host effects remain unseparated; JIT is not a proven cause or sufficient workaround.

Reproduce with the committed [performance harness](../../services/main/performance/README.md):

~~~sh
task services-main:performance:tools
task services-main:performance:run -- --rows 10000 --jit off
task services-main:performance:run -- --mode load --rows 1000 --case and-correlated.hot --rate 2 --duration 30 --vus 8 --jit off
~~~

Compare JIT on/off and the same image/workload on a separate Linux host; retain native core/backtrace, reduced SQL/binds and run metadata. Closure requires repeated successful reproduction workloads plus an explained repair or qualified runtime change. Temporary original run files are not required: the recipe and generator remain committed. The retained failure is not replaced by historical suite totals.

## Fresh schema replay abort

The September 8 convergence qualification recorded a PostgreSQL SIGILL during Atlas bookkeeping after schema statements. The underlying cause was not established. The current target must pass a fresh replay with exact generated inputs and engine diagnostics; a different successful replay does not close this observation.

## Integration recovery gaps

- Native merge application/recovery: [private review/reconciliation](foundation.md#native-merge-review-and-reconciliation) and [structure-page worker crash/reclaim/replay with current executor finalization](foundation.md#merge-worker-rollback-replay-and-current-executor) pass. Qualify current reviewer authority at canonicalization and extend crash/restart evidence to canonicalization and source-binding effects; the selected phase tests do not close backup/restore or all-phase recovery.
- Recommendation generation: the prior fixture exercised partition writes/fencing but did not finish its second snapshot. Require repeated bounded batches, preserved old active snapshot, complete activation and crash recovery.

These are acceptance obligations in M06/M09. Re-evaluate against current code before claiming the old failure still reproduces, and remove each entry only after its lasting regression/qualification evidence is in the owning suite.

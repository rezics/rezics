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

Compare JIT on/off and the same image/workload on a separate Linux host; retain native core/backtrace, reduced SQL/binds and run metadata. New performance containers enable core dumps, and `task services-main:performance:diagnostics:check` verifies capture after an isolated backend abort; reused older containers retain their original limits. Inspect `coreDumpSettings` and per-artifact capture outcomes in the report. Closure requires repeated successful reproduction workloads plus an explained repair or qualified runtime change. Temporary original run files are not required: the recipe and generator remain committed. The retained failure is not replaced by historical suite totals.

The [Linux comparison](database/native-facet-linux-evidence.json) on September 12
uses an AMD Threadripper 3970X host and the same pinned PostgreSQL/PGroonga image.
The 10,000-resource graph matches the original checksum and 37,641 edges. Full
JIT-off and JIT-on smoke runs each pass 86 cases and 866 distinct EXPLAIN checks;
focused 1,000-resource JIT-on and 10,000-resource JIT-off load also passes. HTTP
budgets remain unchanged. Replay-only timeout failures were traced to the harness
combining captured local settings across different API transactions; isolated
SQL diagnostics pass. A host-interrupted run is excluded from acceptance.
These comparisons do not reproduce or explain the original SIGABRT. Native core
analysis on a reproducing runtime, or a separately qualified runtime change,
remains required before closing it. The 500M/3B workload gate is also open.

## Fresh schema replay abort

The September 8 convergence qualification recorded a PostgreSQL SIGILL during Atlas bookkeeping after schema statements. The underlying cause was not established. The current target must pass a fresh replay with exact generated inputs and engine diagnostics; a different successful replay does not close this observation.


## Main IAM qualification after schema extraction

The 2026-09-20 [native capacity repair](database/membership-native-capacity-evidence.json),
following [native roster](database/realm-native-roster-evidence.json),
[account enforcement](database/account-native-participation-evidence.json),
the [native account/Org](database/native-account-org-evidence.json),
[Realm](database/realm-native-enrollment-evidence.json) and
[foundation](database/foundation-integrity-repair-evidence.json) repairs,
reduces the owning main TypeScript result from 160 to **31 errors**. Reproduce
with `task services-main:typecheck`. The remaining failures are concentrated in
the stale recovery fixture (28 errors) and
three seed writes through read-only Realm presentation views.

Reconcile the remaining fixture with the native Org/Realm enrollment commands, exact
membership generations and branded `PrincipalRequestContext` credential proofs.
Native account erasure now accepts a fresh direct session without a public Self;
its worker and native Org/Realm cleanup pass their listed focused cases. Full
account and mixed-controller lifecycle qualification remains separate.

The Org fixture's attempted legacy `PATCH /account/me/preferences` on a native
account returned 500: `resolveInteractiveSession` invokes `ensureSelfEntity`,
whose official-Zone follow initialization fails the concrete Zone reference FK on
the unseeded native target. That route still silently constructs a Self. Migrate
retained private preferences and their account fixture to private principal
authority/default initialization; qualify the actual official seed separately.
The native Org fixture checks direct `/account/main-identity` isolation and rejects
represented private-setting reads; that passing check does not close the legacy
locale-preference failure.

Seed must use native persistence owners and preserve consent/enforcement history;
restoring removed membership tables, casting old authority objects or making
presentation views writable does not repair the selected contract. Preserve the
original denied, concurrent, revocation, privacy and recovery scenarios when
updating the fixtures. Full main integrity and the broader Group/Org/Realm/API
qualification remain open; the passing focused storage and unit cases do not
qualify these remaining consumers.

## Online exact-count policy inventory

Observed 2026-09-18 with `task services-main:counts:check`: 14 reported query
occurrences and three stale allowlist expectations fail the policy scanner.
Affected owners include OAuth/participation erasure, Group impact discovery,
Entity measurements, connected-app grants, recommendation partitions, search
facets and attribution. The reported implementation files and scanner are
unchanged by the standards/model refactor; one allowlisted merge path is already
absent before the standards/model refactor. Review each actual bound and update the
queries or narrowly justified allowlist, then pass the owning scanner. A bounded
batch count and an unbounded corpus count must not be accepted interchangeably.

# Shared schema and converter qualification

This owner records the breaking shared-schema replacement selected on 2026-09-18.
The [schema package](../../libraries/schema/README.md) owns the Drizzle model;
[the importer](../../libraries/schema-importer/README.md) owns source conversion.
The main migration history is the sole production installation owner.

## Implemented scope

- 758 table declarations across 23 domain modules, with a generated complete
  column/key/check/index catalogue. Existing native consumers import those same
  declarations; old schema source modules and the standalone migration owner are removed.
- Structured complete RDF graphs and source contracts, 940 inherited Schema.org
  class profiles, explicit native/generic storage dispositions, and rezics.com
  logical identity namespaces. Format 1/rezics.org compatibility is not retained.
- Media identity/URL/observation/appearance/blob/representation/stream/fragment
  separation, exact numeric quantities, contextual selection and immutable seals;
  standalone wiki identities/revisions/payloads; direct/group conversation
  membership and closed message history with erasure; semantic descriptions,
  exact statement evidence, package registry and subscription/entitlement tables.
- 11 pinned vocabularies: 4,468 term/reference identities and 25,265 retained RDF
  statements. Four provider schema converters generate 699 contracts and 11,054
  structural declarations. These counts include schema wrappers, syntax nodes
  and provider metadata, and are not counts of adopted native content facts.

## Executed evidence

Environment: Linux, Node 26.8.2, TypeScript 7.0.2, Drizzle ORM/Kit 1.0.0-rc.4,
PostgreSQL 18.6 and PGroonga 4.0.8. The local container image is
`rezics-postgres:18.6-pgroonga-4.0.8`. Fixture ports 55432/55433 and separate Compose
project names isolate these checks from the application development database.
On this SELinux host the task copied only the migration init scripts into its
own temporary directory and used a read-only labelled mount.

| Check | Result |
| --- | --- |
| `task libraries:schema:typecheck` | Passed. |
| `task libraries:schema-importer:typecheck` | Passed. |
| Schema + importer Vitest projects | 18 tests passed: complete offline reconstruction, inheritance, source syntax, composite references, exact values, invalid inputs, contexts and budgets. |
| Affected main schema/catalog/source/SQL-contract Vitest files | 454 tests across 95 files passed, including targeted reruns after updating obsolete reference/view expectations. |
| Fresh main fixture replay, then apply current tip | Passed. Final fresh replay: 58 migrations/18,831 statements in 7m00s. |
| `check-postgres-schema.ts` | Passed: canonical functions, triggers, views and declared partition structure equal replay. |
| `check-database-schema-drift.ts` with isolated Atlas dev database | Passed: schemas are synced. |
| Importer PostgreSQL harness | 17 scenarios passed, including 30 native rejected-state/integrity assertions. |
| Native reference lookup/revision harness | Passed after repairing the extended-owner expression: 10,039 references, `reference_value_native_id_idx` Index Scan, one result and three shared buffers; allocation/concurrency and exact-revision probes passed. This is a bounded fixture, not a capacity benchmark. |
| Source-coverage inspect | Passed pin/manifest integrity. Broader source-native mapping coverage remains unqualified. |
| Documentation integrity | Passed maintained local links, ownership and pinned upstream document hashes. |

The PostgreSQL harness imports/retries every vocabulary and provider contract,
checks queryable graph/declaration cardinalities, persists all 940 profiles,
preserves duplicate-endpoint relation identities, retains exact old-revision
source/review links, checks numeric ordering beyond JavaScript safe integers,
rejects forged provider declarations even when their IDs are reused, uses 40 translation languages, races adoption CAS, rejects invalid/cyclic history
and corrupt artifacts, and proves atomic rollback. It exports and reconstructs
all selected vocabularies in another database and transfers relation identities,
revisions and selections into a different physical table family without changing
logical IDs. Native SQL cases reject cross-media representations, wrong fragment
bounds, incomplete/sealed selection mutations, mixed reference owners, erased
revision adoption, wrong-language/wiki history, unadmitted/departed message senders,
erased message resurrection, fractional monetary amounts, missing grant origins
and wrong award beneficiaries.

Database copies use the repository's qualified `STRATEGY FILE_COPY` procedure.
A first attempt using PostgreSQL's default copy strategy was cancelled before
any scenario passed; it is not counted as evidence. Only task-created copies and
containers are removed. The 7-minute empty installation reflects the existing
large physical partition layout; it is not a corpus throughput result.

## Reproduction

```sh
task libraries:schema-importer:convert -- all
task libraries:schema:catalogue
task libraries:schema:typecheck
task libraries:schema-importer:typecheck
yarn exec vitest run --project schema --project schema-importer
task services-main:db:fixture:prepare
REZICS_DISPOSABLE_MIGRATION_FIXTURE=1 \
DATABASE_ADMIN_URL='postgresql://postgres:postgres@localhost:5433/rezics_atlas?sslmode=disable' \
task libraries:schema-importer:db:test
```

The normal `task services-main:db:check` includes the importer database harness.
Set both `POSTGRES_MIGRATION_HOST_PORT` and `POSTGRES_MIGRATION_LOCAL_PORT` for an
alternate fixture port, and set `ATLAS_DEV_DATABASE_URL` to that fixture's
`rezics_atlas_dev` database for normalization. Ordinary converter tests are offline;
`fetch` is the explicit network operation.

## Broader limits and open checks

`task services-main:typecheck` remains unsuccessful. A clean detached checkout of
base commit `99be45f46` reproduced 167 errors. This replacement has 160, with no
new file/error-code categories after repairing its affected consumers. Remaining
errors concern the earlier IAM/Org/Realm refactor: obsolete membership fixtures,
old request authority values, missing role-binding eligibility, and consumers
attempting to write current-generation presentation views. This does not qualify
the broader IAM APIs or the whole backend. The original tests remain present.
The first full main `db:check` detected an introduced expression-index regression: old lookup expressions omitted the five added reference owners. Queries now share the complete indexed expression; the original no-Seq-Scan requirement passes. The full rerun installed all 58 migrations/18,831 statements and passed Auth identity, reference lookup, access identity and access role checks. It then exposed an outdated membership assertion that rejected a reserved identity, contrary to the current admission contract. That fixture now verifies zero authority, rejected activation without a receipt and unchanged state after denial; its focused rerun passed. The continuation of the owning task stopped at `check-access-groups.ts:129`: the fixture expected a PostgreSQL constraint-code rejection, but the existing Group command returned `AccessGroupConflict`. Its command implementation and canonical Group SQL were not changed beyond imports in this task. The full main gate remains unqualified; later main checks were not claimed as passed.

This work establishes the selected storage/conversion contracts and bounded
PostgreSQL correctness. It does not establish full source-instance acquisition,
all native mappings, every product API, online migration of every owner, custom
storage-engine implementation, or trillion-row production throughput. The schema
README separates global workload arithmetic from measured results and describes
the local FK, reference validation, CAS, erasure and placement obligations a
future split must preserve.

Catalogue SHA-256: `65fae469fbe2e506c35d6bfb6a70292dd34a6c50b7347e443b557506dd89982f`.

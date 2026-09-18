# Standards/model and shared-schema qualification

The 2026-09-18 refactor replaces the former vocabulary/provider-schema mixture
with standard vocabularies, authored native decisions and generated Drizzle.
The [modeling contract](../architecture/schema-modeling.md),
[schema package](../../libraries/schema/README.md),
[compiler](../../libraries/schema-importer/README.md) and
[content adapters](../../libraries/content-adapters/README.md) own the resulting
contracts. The main service owns the sole production migration history.

Earlier results at `beac6497b` remain in Git. Its 940 permissive class profiles and
provider-contract database tables were not evidence of complete native modeling;
those artifacts/tables are removed. Vocabulary navigation has no invented validation
rules. Native workflow coverage is not inferred from a term or table count.

## Implemented scope and inventory

- 12 exact-byte pinned standard artifacts; 4,693 term/reference identities,
  4,392 definition records and 26,393 retained RDF statements. Required selected
  XSD 1.1 datatype semantics are an explicit implementation catalogue.
- Portable ontology IR distinguishes strict axioms, Schema.org hints and blank-node
  expressions. Every definition has a traceability disposition. Uninterpreted
  axioms remain available without claiming OWL inference or SQL enforcement.
- 28 reviewed profiles and 53 property rules name referent, cardinality, ordering,
  values, writer and storage. The model identity covers source pins, ontology,
  decisions and the authored generated-storage layout.
- 55 actual Drizzle declarations are emitted from the authored storage DSL.
  The complete production catalogue includes 755 tables in 23 physical domains;
  other operational/native declarations have explicit authored ownership.
- Four content-provider inventories retain 699 contracts / 11,054 declarations
  from 46 pinned artifacts. This qualifies the preserved input contracts and
  parsers, not every source field's native adoption.

## Executed evidence

Environment: Linux, Node 26.8.2, TypeScript 7.0.2, Drizzle ORM/Kit 1.0.0-rc.4,
PostgreSQL 18.6 and PGroonga 4.0.8. The fixture image is
`rezics-postgres:18.6-pgroonga-4.0.8`, isolated on loopback port 55432 under Compose
project `rezics_schema_model_fixture`; the broader main gate used a separate
project and port 55433. On this SELinux host only task-owned copies
of migration init scripts receive the container mount label.

| Check | Result |
| --- | --- |
| Schema, schema-importer and content-adapters typechecks | Passed. |
| Three package Vitest projects | 27 tests passed across five files. |
| Main catalog/database and selected generator/source contract suites | 488 tests across 100 files passed (487 initially, then the repaired localization audit). All 15 reviewed localization exceptions remain enforced against the relocated schema owner. |
| Main full typecheck | 160 existing IAM/Realm and related errors; unqualified. |
| Main exact-count policy | Failed on existing queries and stale allowlist entries; all reported implementation files are unchanged by this refactor. |
| Final fresh main migration replay | Passed: 59 migrations / 18,914 SQL statements in 6m51.75s, including the consolidated `20260918153158_schema_model.sql`. |
| Main canonical SQL and structural drift | Passed: functions/triggers/current schema match canonical SQL; Atlas reports schemas synced. |
| PostgreSQL model/native/relocation scenarios | 22 scenarios passed, including 31 native integrity assertions, model/description adoption transitions, 40 translation languages and actual importer CLI import/select/export. |
| Maintained documentation and source pins | Passed local links, schema ownership mapping and pinned source integrity; source-native field coverage remains unqualified. |

Pure checks cover complete offline graph/IR reconstruction, deterministic emitted
Drizzle/model artifacts, changed-field emission and model identity, unknown terms,
ambiguous write authorities, Book grain selection, exact numeric/date/duration
values, unsupported datatype reporting, preferred-label uniqueness, occurrence
ordering, and the declared limits of the advisory SHACL projection. Provider
contract/exchange tests remain independent from native model tests.

The database harness exercises actual writes and rejected states: complete graph
installation/retry, exact installed model/profile bindings, adoption CAS, native
Annotation targets, wrong native writer rejection, meaning/model pinning, identified
relation revisions, old-revision evidence, independent translations, conflicts,
rollback, cycles and malformed values. It also exercises domain media/Wiki/message
constraints and transfers unchanged relation IDs/revisions/selections into a
second database and physical table family. The procedure copies only disposable
fixtures with PostgreSQL `STRATEGY FILE_COPY`; it is not a production backup drill.

## Reproduction

```sh
task libraries:schema-importer:generate
task libraries:schema:catalogue
task libraries:content-adapters:contracts -- all
task libraries:schema:typecheck
task libraries:schema-importer:typecheck
task libraries:content-adapters:typecheck
yarn exec vitest run --project schema --project schema-importer --project content-adapters
yarn exec vitest run --project main services/main/src/services/catalog services/main/src/services/database services/main/scripts/generate-database-migration.test.ts services/main/scripts/catalog-source-inventory.test.ts services/main/scripts/catalog-source-coverage.test.ts
task services-main:db:fixture:prepare
REZICS_DISPOSABLE_MIGRATION_FIXTURE=1 \
DATABASE_ADMIN_URL='postgresql://postgres:postgres@localhost:5433/rezics_atlas?sslmode=disable' \
task libraries:schema-importer:db:test
```

For alternate ports set both `POSTGRES_MIGRATION_HOST_PORT` and
`POSTGRES_MIGRATION_LOCAL_PORT`. Set `ATLAS_DEV_DATABASE_URL` to the fixture's
`rezics_atlas_dev` database for the owning structural drift check. The full main
`db:check` includes the schema database harness after earlier main-domain checks.
Offline generation uses committed pins; only explicit `fetch` downloads standards.

## Limits

Main typechecking still reports the same 160 pre-existing errors recorded at
`beac6497b`, involving the earlier IAM/Org/Realm redesign rather than this model
pipeline. The full main database gate rerun also stopped at the Group fixture's
expectation of a PostgreSQL constraint code where the command returned
`AccessGroupConflict`. The full main attempt ran before final migration consolidation and passed Auth,
reference lookup, access identity, role and membership checks before this failure.
The final consolidated schema then passed its fresh replay and focused checks above.
These failures remain visible; selected schema qualification does not qualify the
whole backend. The online exact-count scanner also retains 14 flagged query
occurrences and three stale allowlist expectations in unchanged owners; see
[open regressions](known-failures.md).

The 500M/3B revision-row checkpoints and trillion-scale occurrence arithmetic are
planning estimates. No corpus-sized dataset or throughput result is claimed.
The two-database fixture proves representation/identity transfer and local
constraints; another database engine, online cross-service cutover, remote endpoint
validation, erasure delivery and recovery need their own implementations and
qualification. Product API completion, inference, full provider acquisition and
all source-native mappings are outside this schema/compiler scope.

The tested generated model ID is `6743429d-e217-571d-a395-a8abc1b24e41`.
Catalogue SHA-256: `9cb07a99f1c964ef024200342ebd0dbb5e8917b249993010305c9361f49d5090`.
Final migration SHA-256: `439a85996db6aee7497298ed8ed68bc47ab33ef8a5dc38541a5121405d80bd5a`.
Intermediate defects in source-alias qualification, guarded upsert transitions and
fixture isolation were repaired before this final run. Final schema-specific evidence uses the
consolidated migration; no interim migration or temporary fixture is required.

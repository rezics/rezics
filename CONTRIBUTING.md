# Contributing

- Inspect existing code and make the smallest complete change within the affected owner. Update internal consumers together; respect real external contract boundaries and preserve unrelated work.
- Use the owning Taskfile and existing generators. Do not hand-edit generated files or upstream mirrors.
- Keep durable knowledge in its owner: types, tests, architecture decisions or the commit. Comments explain non-obvious reasons.
- Maintainer-facing repository language is English; locale content, fixtures and native-language names retain their target language.
- Abstractions should capture an invariant, protocol, lifecycle or reusable semantics. Within the affected code, inline wrappers that only rename or forward when equally clear. Framework/public entry points and generated/upstream boundaries are not judged by call count.

## Contracts and verification

- A type or assertion must not claim more than its source or validation proves. Use existing schemas and runtime checks at the narrowest trust boundary.
- Preserve meaning, missing values and failure states through transformations to their consumers. Same-shaped values need not have the same semantics; do not hide lost guarantees with casts.
- For the current implementation program, the [execution workflow](docs/plan/execution-workflow.md) owns test/check timing and the [plan](docs/plan/README.md#active-execution) records the active phase. During verification, run the nearest checks that cover changed contracts, including important rejected states. Start from the [Taskfile](Taskfile.yml); expand testing only for affected dependencies, failures or unresolved risk. Once required checks pass, stop unless new changes invalidate them. Outside this program, run the nearest required checks before completion.
- Report evidence and limitations for the changed scope. Do not imply whole-system proof from focused checks. Frontend work also follows [the agent verification boundary](AGENTS.md#data-and-verification-boundaries).

## Versioning

The current implementation program has no compatibility requirements for old
schemas, APIs, SDKs, data, IDs/URLs, formats or implementation behavior. Design for
the intended model, remove obsolete compatibility layers within scope and update
retained consumers together. The current plan authorizes autonomous research,
full development/test environment operation and local commits under the
execution workflow's phase-specific policy. Deferred checks must be reported;
implementation checkpoints do not establish acceptance.

REZICS uses Romantic Versioning: `PROJECT.MAJOR.MINOR`. PROJECT changes for a
separate product generation; MAJOR for significant or breaking product, public
API or persisted-contract changes; MINOR for smaller additions and fixes.
Packages have independent release lines. Document breaking target contracts and
their reproducible installation/rebuild procedure; compatibility migration is not
a deliverable of the current program. A breaking change is not a PROJECT bump.

Root `vPROJECT.MAJOR.MINOR` tags define the server/database release boundary;
prefixed product tags do not. Released SQL is append-only: add forward
migrations after the released history rather than editing, deleting or renaming it.

## Database and catalog

- Use the `public` schema, snake_case physical names and lower camel case TypeScript exports. Declare Drizzle `relations` only for actual `database.query` consumers; foreign keys enforce integrity.
- The current [installation baseline](services/main/src/services/database/baseline.json) records the completed native replacement. Preserve that epoch and its recovery record; historical replacement authorization is not an instruction to regenerate it. Released-history checks enforce immutability.
- Generate changes with `task services-main:db:generate -- <name>` and qualify them during verification with `task services-main:db:check` on the disposable shadow target. Follow the execution workflow for generators that bundle validation. Use the repository replay workflow rather than raw `atlas migrate diff`; see [migration operations](README.md#database-migrations).
  For function/trigger-only changes, use the canonical SQL file's underscore-form name or register the requested name in `PostgreSqlSchemaMigrationBundles` in [the PostgreSQL manifest](services/main/src/services/database/schema/postgres/manifest.ts).
  The structural diff excludes functions/triggers; an unregistered name will not install their changed definitions.
- Unit is a logical identity/reference/capability contract. Stable logical owners hold native identity and lifecycle; physical table/database placement is a separate mapping. Do not restore a global `unit` parent or substitute a universal entity table. Preserve concrete foreign keys and validated reference alternatives.
- Apply the [native Work and release contract](docs/architecture/database/native-work.md) across creative domains. Reuse [composition and import protocols](docs/architecture/database/content-composition.md) with domain-specific validation; current table names do not define product identity or exempt a domain.
- Follow the [provider-independent catalog model](docs/architecture/database/catalog-model.md#provider-independent-model). Source schemas test conformance; they do not dictate native ownership or a universal Edition layer.
- Follow the [database target](docs/architecture/database/README.md) and [current plan](docs/plan/README.md). Fresh development/test rebuilds and source-native conversion tests qualify the new model; no legacy transfer is required.

## Exported TypeScript APIs

Use TSDoc on owning exported boundaries. Use `@alpha` for intended public APIs
not yet released, with audience and product state in `@remarks`; `@beta` only
for supported previews; `@internal` only for APIs not intended for third parties.
Tags do not enforce authorization: restricted APIs need typed runtime policy,
server enforcement and allowed/denied tests.

## Advisory GitHub checks

The GitHub `Check` workflow is advisory, not a merge, tag, release or deployment
gate. Keep failures visible and fix them when practical. Do not make release
workflows depend on its conclusion or configure it as a required status check.
This does not waive the checks required for acceptance; the execution workflow
owns their timing during the current program.

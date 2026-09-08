# Contributing

- Inspect existing code and make the smallest complete change within the affected owner. Update internal consumers together; respect real external contract boundaries and preserve unrelated work.
- Use the owning Taskfile and existing generators. Do not hand-edit generated files or upstream mirrors.
- Keep durable knowledge in its owner: types, tests, architecture decisions or the commit. Comments explain non-obvious reasons.
- Maintainer-facing repository language is English; locale content, fixtures and native-language names retain their target language.
- Abstractions should capture an invariant, protocol, lifecycle or reusable semantics. Within the affected code, inline wrappers that only rename or forward when equally clear. Framework/public entry points and generated/upstream boundaries are not judged by call count.

## Contracts and verification

- A type or assertion must not claim more than its source or validation proves. Use existing schemas and runtime checks at the narrowest trust boundary.
- Preserve meaning, missing values and failure states through transformations to their consumers. Same-shaped values need not have the same semantics; do not hide lost guarantees with casts.
- Run the nearest checks that cover changed contracts, including important rejected states. Start from the [Taskfile](Taskfile.yml); expand testing only for affected dependencies, failures or unresolved risk. Once required checks pass, stop unless new changes invalidate them.
- Report evidence and limitations for the changed scope. Do not imply whole-system proof from focused checks. Frontend work also follows [the agent verification boundary](AGENTS.md#data-and-verification-boundaries).

## Versioning

The first supported compatibility baseline is v1.0.0. Do not restore pre-v1
routes, formats or compatibility layers. Remove obsolete code only within the
requested scope.

REZICS uses Romantic Versioning: `PROJECT.MAJOR.MINOR`. PROJECT changes for a
separate product generation; MAJOR for significant or breaking product, public
API or persisted-contract changes; MINOR for smaller additions and fixes.
Packages have independent release lines. Breaking releases require an explicit
migration or cutover plan, not a PROJECT bump.

Root `vPROJECT.MAJOR.MINOR` tags define the server/database release boundary;
prefixed product tags do not. Released SQL is append-only: add forward
migrations after the released history rather than editing, deleting or renaming it.

## Database and catalog

- Use the `public` schema, snake_case physical names and lower camel case TypeScript exports. Declare Drizzle `relations` only for actual `database.query` consumers; foreign keys enforce integrity.
- The current [installation baseline](services/main/src/services/database/baseline.json) records the completed native replacement. Preserve that epoch and its recovery record; historical replacement authorization is not an instruction to regenerate it. Released-history checks enforce immutability.
- Generate changes with `task services-main:db:generate -- <name>` and qualify them with `task services-main:db:check` on the disposable shadow target. Use the repository replay workflow rather than raw `atlas migrate diff`; see [migration operations](README.md#database-migrations).
- Unit is a logical identity/reference/capability contract. Domain owners hold physical identity and lifecycle; do not restore a global `unit` parent or substitute a universal entity table. Preserve concrete foreign keys and validated reference alternatives.
- Follow the [provider-independent catalog model](docs/report/REZICS-Catalog领域边界与实施分期-20260906.md#23-provider-independent-native-model). Source schemas test conformance; they do not dictate native ownership or a universal Edition layer.
- The completed [native cutover](docs/plan/operational-refactor-20260906/00-source-complete-schema.md#breaking-replacement-baseline) replaced old contracts, including v1+ contracts. Offline legacy import is separate from the runtime. New changes follow the current target and normal release rules.

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
This does not waive the checks required for a change.

# Contributing

- Inspect existing code before changing it. Make the smallest complete change within the relevant owner boundary; update internal call sites together unless the boundary is a real external contract.
- Put durable knowledge where it belongs: types, tests, comments, or the commit. Write comments only for irreducible "why."
- Do not hand-edit generated files or upstream mirrors.
- Run the nearest relevant checks first, then broader checks affected by the change. Preserve unrelated worktree changes.
- Maintainer-facing repository language is English. Keep localization content, test fixtures, and native-language names in their target language.

## Versioning

REZICS uses Romantic Versioning (RomVer) in `PROJECT.MAJOR.MINOR` form.

- Increment `PROJECT` only when REZICS becomes a separate product generation.
- Increment `MAJOR` for significant or breaking product, public API, or persisted-contract changes.
- Increment `MINOR` for smaller additions, fixes, and maintenance releases.

For example, `1.2.0` is Project 1, Major 2, Minor 0. Independent packages keep
their own RomVer release lines, so `@rezics/api@1.6.0` is valid independently of
the platform version. A breaking release must include an explicit migration or
cutover plan, even though it remains within Project 1.

Root `vMAJOR.MINOR.PATCH` tags are the server and database release boundary.
Every SQL migration present in the preceding root release is append-only:
do not edit, delete, or rename it after release. Repair a released database
contract with a new forward migration whose filename sorts after the released
history. Prefixed product tags such as `web/v*`, `about/v*`, and `api/v*` do not
advance the database migration boundary.

Generate database migrations with `task services-main:db:generate -- <name>`.
The task replays the versioned directory with production-equivalent file
transactions into the disposable shadow database, then runs `atlas schema diff`
against the typed Drizzle exporter. Do not replace this workflow with
`atlas migrate diff`: released data migrations contain transaction-scoped
temporary relations that Atlas's migration-directory state reader cannot replay.

## Advisory GitHub checks

The GitHub `Check` workflow is advisory. Its result does not block merging,
tagging, release dispatch, or production deployment. Failures remain visible
and should be fixed when practical, but release workflows must never depend on
the workflow's completion or conclusion. Do not configure `Check` as a required
status check.

## Existing conventions

- Abstractions must compress meaning, not merely shorten syntax: they should capture invariants, protocols, lifecycles, or genuinely reusable complete semantics. Delete one-use wrappers that only forward, rename, or pass arguments when the inline form is equally clear. Framework entry points, public package entry points, generated code, and upstream mirrors are external-contract boundaries and are not judged by call count; within a boundary, still express intent directly.
- Follow the [access permission schema](./libraries/access/README.md) when adding or changing authorization keys, implications, or grantability.
- Use only the `public` database schema. Use `snake_case` for physical table, column, constraint, and index names; use lower camel case for TypeScript exports.
- Model a Unit subtype or marker table with its `id` as both the primary key and a direct foreign key to `unit.id`; do not copy `unit.kind` into that table. Store a Unit kind beside a foreign key only when the relationship itself requires a database-enforced kind invariant.
- Declare Drizzle `relations` only when a `database.query` relation query needs them. Table-definition foreign keys provide integrity; do not pre-maintain bidirectional relation metadata.

## TSDoc release maturity

- Use TSDoc syntax for exported TypeScript boundaries. Mark an API intended to become public but not yet released with `@alpha`, and explain the current product state and intended audience in `@remarks`.
- Promote the release tag to `@beta` only after an API is deliberately available as a supported preview or beta. Use `@internal` only for APIs that are not intended for third-party use. No release tag is a synonym for "unfinished."
- Put the maturity annotation on the owning exported boundary instead of repeating it on every implementation helper.
- Documentation tags never enforce authorization. Any platform-restricted API must also have a typed runtime policy, server-side enforcement, and tests for allowed and denied callers.

# Contributing

- Inspect existing code before changing it. Make the smallest complete change within the relevant owner boundary; update internal call sites together unless the boundary is a real external contract.
- Put durable knowledge where it belongs: types, tests, comments, or the commit. Write comments only for irreducible "why."
- Do not hand-edit generated files or upstream mirrors.
- Run the nearest relevant checks first, then broader checks affected by the change. Preserve unrelated worktree changes.
- Maintainer-facing repository language is English. Keep localization content, test fixtures, and native-language names in their target language.

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

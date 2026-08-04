# Contributing

- Inspect existing code before changing it. Make the smallest complete change within the relevant owner boundary; update internal call sites together unless the boundary is a real external contract.
- Put durable knowledge where it belongs: types, tests, comments, or the commit. Write comments only for irreducible "why."
- Do not hand-edit generated files or upstream mirrors.
- Run the nearest relevant checks first, then broader checks affected by the change. Preserve unrelated worktree changes.
- Maintainer-facing repository language is English. Keep localization content, test fixtures, and native-language names in their target language.

## Advisory GitHub checks

The GitHub `Check` workflow is advisory. Its result does not block merging,
tagging, release dispatch, or production deployment. Failures remain visible
and should be fixed when practical, but release workflows must never depend on
the workflow's completion or conclusion. Do not configure `Check` as a required
status check.

```progress
id: governance.repository-license
status: open
goal: Publish the repository license and contribution-rights agreements needed for public collaboration.
depends: []
accept:
  - The repository has an approved Apache-2.0 license file and any required notices.
  - Core-team intellectual-property assignment and external-contributor license terms name the actual legal entity and have qualified legal review.
  - EasyCLA or an approved equivalent checks the correct agreement for each contributor class without blocking exempt automation.
  - This contributing guide explains the agreement flow and links to the authoritative terms.
verify:
  - Ask qualified counsel to approve the license, assignment, and contributor agreement for the operating entity.
  - Open a test contribution from each contributor class and confirm that the configured agreement check reaches the expected result.
  - Run `task progress:check`.
```

## Progress Protocol workflow

Progress Items are machine-validated outcome contracts, not a second copy of the product backlog.
Before adding one from rezics-outline or another planning source, compare it with the current
implementation and history. Do not add work that is already complete, superseded, purely
aspirational, or missing an observable result.
Use the [product capability map](./docs/architecture/product-capability-map.md) to find the owning
outcome chain and to keep repository and Outline coverage complete.

- Put each Item beside the source, test, architecture document, legal draft, or runbook that owns
  the result. Do not recreate `TODO.md` or another central task database.
- Give the Item a stable domain-prefixed ID, one outcome-oriented goal, direct dependencies, and
  acceptance and verification steps that a maintainer can actually observe.
- Keep cross-domain prerequisites explicit with `depends`; do not encode priority or ownership as
  fake dependencies.
- Set `status: done` only after every acceptance statement is true and every verification step has
  been performed. Outline status or implementation intent alone is not completion evidence.
- Reconcile affected Items whenever their owning contract changes, then run `task progress:check`
  before handoff.

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

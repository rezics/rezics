# Source declaration dispositions

`fields.jsonl` is a generated inventory of pinned source declarations. Its 8,412
entries include schema wrappers, upstream account fields and repeated vocabulary
shapes. This number is **not** the number of required native catalog facts.
`coverage.json` is a hand-reviewed exact-path disposition manifest. The current
selection records 22 decisions: 15 required native gaps, three source-only fields
and four exclusions. The other 8,390 declarations remain explicitly unreviewed.
No native implementation is certified by this selection.

Run from the repository root:

```powershell
# Validate the manifest/pins and inspect unresolved work; expected exit 0.
bun services/main/scripts/check-catalog-source-coverage.ts --inspect
# Require complete dispositions and evidence; currently expected exit 1.
bun services/main/scripts/check-catalog-source-coverage.ts
# Include every missing exact path and native gap in machine-readable output.
bun services/main/scripts/check-catalog-source-coverage.ts --inspect --json
# Narrow deterministic checks; no database, network or application server.
node node_modules/vitest/vitest.mjs run --config services/main/vitest.config.ts services/main/scripts/catalog-source-coverage.test.ts
```

The default qualification command fails for missing entries, native gaps,
duplicate/unknown paths, circular or absent dependencies, pin/count drift and
missing/stale evidence. Inspect mode allows known incomplete coverage but still
fails invalid manifests, pin drift and broken evidence/dependencies. Neither mode
downloads source artifacts or regenerates declarations. Use the existing inventory
generator for source changes, then review the changed declarations and update the
manifest pin deliberately. Do not replace missing entries with automatic rules.

## Decisions and evidence

Each entry identifies exactly `(source, contract, path)` and supplies a semantic
reason. Parent objects, references and wildcards never cover descendant entries.

| Disposition | Meaning |
| --- | --- |
| `native` | A required catalog fact or identity binding. `mapping.status: gap` records the intended semantic result and missing proof. `evidenced` requires owner, field, typed column/relation representation, semantics and every evidence role below. |
| `source-only` | Provider-specific metadata retained, when permitted, as scoped source evidence. It is not a native fact or a claim that storage/export is implemented. |
| `out-of-scope` | An explicit exclusion from public catalog conformance, with its scope and reason. This never grants permission for another ingestion path. |
| `structural` | A declaration wrapper with exact `coveredBy` dependencies. Vocabulary identifiers, labels and relationship roles are not automatically structural. |
| `derived` | A value with exact `inputs` dependencies and an explicit `derivation`. A provider's statistical score is not automatically derived from native facts. |

Native evidence must include `schema`, `canonicalWrite`, `nativeQuery`,
`semanticExport` and `fixture`. Each reference records a repository-relative file,
normalized-text SHA-256, literal anchor and a claim explaining what that evidence
proves. A raw source-shaped observation, JSON payload, descriptive owner string,
or importer accepting top-level keys cannot substitute for this chain. The schema
rejects raw-only representations and incomplete role sets. The validator verifies
file integrity and anchors, and rejects using the same location for multiple roles;
reviewers still must assess the claims and run the
named acceptance fixtures. `qualified` means this **disposition/evidence-integrity
gate** passes, not that the implementation, semantic mappings, database, API,
restoration, source-use permission or capacity is accepted. The validator cannot
detect a dishonest semantic claim merely because the referenced code exists.

The denominator reports only reviewed required native paths and remains explicitly
incomplete until every declaration has a valid disposition. Structural expansion
and source-only/excluded metadata do not inflate native coverage. Even a complete
declaration review does not cover facts absent from the pinned schemas, such as
undeclared infobox values or the required novel translation/serialization cases
not established by Open Library types. The [source conformance specification](../../../../../../docs/testing/source-conformance.md)
and [Book/creation suite](../../../../../../docs/testing/book-and-creation.md) own
those independent requirements. This inventory is evidence, not an old-contract
compatibility obligation.

## Bounds

This is an offline control dataset, not corpus processing. Inputs are limited to
20,000 declarations and 20,000 dispositions; every dependency list has at most
256 entries, each file is at most 8 MB and all files together at most 64 MB. Exact
identity lookup and dependency traversal are O(declarations + dependency edges);
canonical pin sorting is O(declarations log declarations). Evidence files are read
and hashed once per distinct path. Text checks run per evidence reference within these bounds.
There are no database scans, queues or 500M/3B-record operations. Exceeding these
metadata limits fails closed and requires a deliberate bound review; target
corpus-scale native storage still needs its separate capacity qualification.

The strict contract distinguishes required properties from optional ones and
rejects unknown keys, following the [JSON Schema object-contract distinction](https://json-schema.org/understanding-json-schema/reference/object).

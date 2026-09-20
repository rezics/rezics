# Source declaration dispositions

The [live validation contract](../../../../../../docs/testing/source-conformance.md#live-acquisition-and-validation)
uses current acquired inputs and ignored inventories. `fields.jsonl`, `inventory.json`
and `report.json` are generated locally; none is an upstream version prerequisite
for future runs. `coverage.json` owns reviewed exact-path decisions and the source
shape each decision expects. A changed field must be reviewed; whole-artifact
byte changes do not invalidate unrelated decisions.

Run from the repository root:

```sh
# Check script types, then fetch current contracts and report known incomplete coverage.
task services-main:catalog:sources:typecheck
task services-main:catalog:sources:live -- --inspect
# Regenerate/replay the last completed all-provider acquisition offline.
task services-main:catalog:sources:inventory
task services-main:catalog:sources:inventory -- --check
# Require complete native dispositions/evidence; known gaps currently reject it.
task services-main:catalog:sources:coverage
# Include every unresolved exact path; also retained in ignored report.json.
task services-main:catalog:sources:coverage -- --inspect --json
```

The default qualification command fails for missing decisions, native gaps,
duplicate/removed paths, changed reviewed shapes, circular/absent dependencies and
missing/stale native evidence. Inspect mode permits explicitly reported missing
coverage but still rejects malformed decisions, changed/removed reviewed fields
and invalid evidence. Neither mode silently fetches new inputs or reuses a failed
network attempt as current compatibility. The live task fetches first and stops
on failure; ordinary offline replay reports its acquisition time/run identity.

Acquisition stores raw input bytes, a completed run receipt and failed-run
diagnostics in the adapter's ignored input directory. Native declaration generation
uses one completed all-provider run, preserves source surfaces and validates
cross-document references. Its ignored inventory receipt binds the exact generated
bytes to that acquisition; a changed/mixed/stale pair is rejected before evaluating
coverage. Source schema and native coverage are separate results.

## Decisions and evidence

Each entry identifies exactly `(source, contract, path)`, supplies a semantic
reason, and records `sourceShape` (shape, reference, repetition and nullability).
These are reviewed parser/mapping expectations, not a fixed remote version. Parent objects, references and wildcards never cover descendant entries.

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
declaration review does not cover facts absent from the observed schemas, such as
undeclared infobox values or the required novel translation/serialization cases
not established by Open Library types. The [source conformance specification](../../../../../../docs/testing/source-conformance.md)
and [Book/creation suite](../../../../../../docs/testing/book-and-creation.md) own
those independent requirements. This inventory is evidence, not an old-contract
compatibility obligation.

## Bounds

This is an offline control dataset, not corpus processing. Inputs are limited to
20,000 declarations and 20,000 dispositions; every dependency list has at most
256 entries. Coverage metadata/evidence files are at most 8 MB each and 64 MB together. The shared acquisition separately admits at most 128 artifacts, 8 MB each and 32 MB per run. Exact
identity lookup and dependency traversal are O(declarations + dependency edges);
canonical inventory sorting is O(declarations log declarations). Evidence files are read
and hashed once per distinct path. Text checks run per evidence reference within these bounds.
There are no database scans, queues or 500M/3B-record operations. Exceeding these
metadata limits fails closed and requires a deliberate bound review; target
corpus-scale native storage still needs its separate capacity qualification.

The strict contract distinguishes required properties from optional ones and
rejects unknown keys, following the [JSON Schema object-contract distinction](https://json-schema.org/understanding-json-schema/reference/object).

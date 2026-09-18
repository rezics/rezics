# Native catalog implementation

Use the [current plan](../../../../../docs/plan/README.md), [catalog architecture](../../../../../docs/architecture/database/catalog-model.md) and [source conformance](../../../../../docs/testing/source-conformance.md). Code and executable tests establish current behavior; the target design is not a claim that every provider or API is qualified.

## Ownership

Publishing, music, program, software, entity, grouping, reference and distribution own physical identities and typed structures. Unit is a logical reference/capability contract. Source schemas supply evidence and conformance cases rather than native ownership. Work, expression, release, occurrence and participation context remain distinct. No old schema/API/data compatibility is required.

Use owner-local commands in transactions, propagate failures or use explicit savepoints, and supply authenticated private actor identity separately from public credits. Typed exact revisions and concrete foreign keys protect child ownership. Current access and producer-created IDs belong in integration fixtures.

## Source pipeline

Acquisition records immutable, fieldset-qualified observations. Versioned bindings/proposals call native commands and record exact native application receipts. Native history is not a source payload. A source redirect is not a native merge; source withdrawal and compensation affect only still-owned changes. Large updates require staged parts, complete dependency/correspondence validation and lease/head/authority fences.

The [source-contract owner](source-contracts/README.md), [artifacts](../../../../../libraries/schema-importer/sources/catalog/artifacts.lock.json) and [field inventory](source-contracts/fields.jsonl) provide pinned source inputs and reviewed dispositions. Use the existing generator and owning Taskfile, with reproducible network acquisition when needed. A local cache is disposable; no durable specification depends on its location or contents. Raw-only fields and declaration counts do not establish native coverage.

## Test ownership

Use source-free native fixtures, provider parsing/mapping fixtures, real PostgreSQL command/constraint tests and stateful APIs. Keep 500M/3B row/index/history/source amplification budgets, bounded keyset reads and staged writes. [Known failures](../../../../../docs/testing/known-failures.md) retain unresolved replay, merge and search evidence. Remaining implementation is in the module plan rather than a chronological ledger here.

# Native identity correction, merge and split

The [database target](database/README.md) owns identity invariants; the [community/governance module](../plan/modules/community-and-governance.md) owns implementation. No prior merge API or persisted layout must remain compatible.

## Authority and meaning

A merge is a reviewed identity-resolution decision, not a rewrite of every incoming reference. Preserve original native identities, source correspondence, exact revisions, requested target and operation provenance. Ordinary catalog merge excludes account/participation-controlled identities; those require their dedicated recovery/control workflow. A metadata match never transfers authority.

Pin source/target heads, visibility/capability state and the reconciliation policy. Independent reviewers must have actual read/review authority over the exact material. Revalidate the proposer, reviewers, roots and epochs at application. A rejection cannot be ignored by replaying an older approval.

## Resolution and reconciliation

Retain immutable resolution events and a controlled current resolution head. Reject self/cyclic resolutions under sorted root locks with epoch rechecks after waiting. Bound lookup work; excessive chains use explicit reconciliation rather than request-time whole-corpus traversal. Source writes follow the reviewed current state and cannot silently redirect ownership or history.

Inventory names, identifiers, facts, structures and source bindings into bounded reconciliation items. Each item is applied with exact input/output receipts, retained with a reason or marked ambiguous/action-required. Do not copy historical facts as if newly authored by another source. Rebinding pauses automatic source adoption until the target/protocol is reviewed; old observations and application epochs retain original identity.

Split or undo appends a correction decision and assigns affected facts/occurrences to explicit identities. Later mixed human edits cannot be automatically attributed by ID or text similarity; ambiguous assignments remain visible and prevent a falsely complete result. Account/private data never follows an ordinary catalog split by inference.

## Execution and verification

Jobs use stable cursors, bounded pages, lease tokens, authority/source/head fences and atomic receipts. Cancellation/restart preserves the previous valid view or an explicit transition state. A changed target/human revision prevents stale compensation. No operation scans or rewrites all incoming FKs in one transaction.

Test independent reviewer access, source preservation, every assignment disposition, repeated replay, source rebind, private reads, revocation and crash recovery. The unresolved full-fixture issue is tracked in [known failures](../testing/known-failures.md). Capacity uses 500M/3B reconciliation rows, skewed owners, indexed request/item keysets and measured history/receipt/WAL cost; bounded toy runs are not capacity acceptance.

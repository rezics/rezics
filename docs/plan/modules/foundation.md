# M01: foundation

Dependencies: none. Contract owner: [database architecture](../../architecture/database/README.md), dictionary D01-D04 and the shared access vocabulary.

## Remaining work

- Move remaining generic consumers onto qualified identity and catalog metadata revision values. Extend the bridges for other revision owners and add occurrence references using complete concrete FK keys and sealed targets; qualify scoped addresses without a universal Unit parent or unchecked polymorphic ID.
- Define stable logical owner versus physical table/database placement, and qualify same-owner layout changes separately from logical-owner corrections. Reference shape alone does not prove independence.
- Complete the shared Unit contract across owner adapters: bounded resolution/state/summary, supported structural capabilities, exact targets and current authorization. Remove per-owner target alternatives from generic consumers without duplicating Tag, favorite, follow, relation or access behavior by resource kind; retain domain-specific structural FKs.
- Implement canonical definitions, operation receipts, narrow heads and immutable revisions. Preserve unknown/absent/conflict and sensitive-value availability states.
- Integrate qualified participation controls with remaining Realm disclosure, ownership and cross-module account-enforcement transitions, resource grants/restrictions and exact disclosure fences; prove ordered locks and current-snapshot rechecks across those paths.
- Extend the fresh native fixture workflow for remaining lifecycle contracts and finish account-erasure workers and restoration-frontier cases without online migration steps.
- Test added revision/occurrence families, slug collisions, stale writes, revoked authority, private evidence and account erasure; qualify consumer disclosure independently from reference integrity.
- Qualify the [Unit capability cases](../../testing/foundation.md#unit-capability-contract-acceptance), including logical owner-layout changes and independent metadata-only Work references, on the single-database target. Distributed deployment and live relocation are outside this gate.
- Expose lookup/access/history APIs after persistence tests pass; regenerate affected consumers together.

## Acceptance

Real PostgreSQL rejects invalid references and stale/revoked writes under two-connection races. Stateful APIs preserve produced identities. A class, source claim or declared creator cannot grant authority. Every public/private reference has a tested disclosure path. Use owning database/access tasks, not parser mocks alone.

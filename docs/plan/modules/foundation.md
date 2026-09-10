# M01: foundation

Dependencies: none. Contract owner: [database architecture](../../architecture/database/README.md), dictionary D01-D04 and the shared access vocabulary.

## Remaining work

- Move generic consumers onto qualified identity reference values and extend the registry as new owners land. Qualify addresses and exact revision/occurrence bridges using complete concrete FK keys and sealed targets; no universal Unit parent or unchecked polymorphic ID.
- Implement canonical definitions, operation receipts, narrow heads and immutable revisions. Preserve unknown/absent/conflict and sensitive-value availability states.
- Implement principal/persona control, delegation, ownership, grants/restrictions and disclosure fences with ordered locks and current-snapshot rechecks.
- Provide fresh database setup, seeded principals/scopes and fixtures that rebuild development/test data without online migration steps.
- Test invalid exact revision/occurrence targets, slug collisions, stale writes, revoked authority, private evidence and account erasure; qualify consumer disclosure independently from reference integrity.
- Expose lookup/access/history APIs after persistence tests pass; regenerate affected consumers together.

## Acceptance

Real PostgreSQL rejects invalid references and stale/revoked writes under two-connection races. Stateful APIs preserve produced identities. A class, source claim or declared creator cannot grant authority. Every public/private reference has a tested disclosure path. Use owning database/access tasks, not parser mocks alone.

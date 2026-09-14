# M01: foundation

Dependencies: none. Contract owners: [database architecture](../../architecture/database/README.md), dictionary D01-D04, [identity/access](../../architecture/identity-and-access.md), [connected applications](../../architecture/connected-apps.md) and the shared access vocabulary.

## Remaining work

- Reconcile the selected mixed identity contract before dependent DDL/APIs: private AuthPrincipal, many-to-many Entity representation, default/app preferences, typed memberships, Groups, persistent custom Roles, scoped Bindings and assignment ceilings. Remove the unique-Self and account-only grantee assumptions in affected consumers without preserving old wire/schema compatibility.
- Specify and implement direct versus represented request contexts, private accountability, role/group/representation mutation admission, durable institutional assignments versus dependent delegation, recovery continuity and complete authority-fence closure. Account/Entity/security administration supports mixed grantees under action-specific conditions.
- Apply the [qualified opaque token/OIDC profile](../../architecture/connected-apps.md#qualified-external-token-profile) to dependent DDL/APIs. Finish server-enforced pairwise client admission, private management surfaces, live domain dependencies, installation-client mapping and external-client interoperability. Integrate the [qualified Bun CIMD transport](../../architecture/connected-apps.md#cimd-network-boundary) with server-enforced client admission, refresh authority and fleet budgets. Decide and qualify any token-exchange extension separately.
- Implement App/client registration, Entity connections, user consent, scope-owned installations/service principals, credential lifecycle, MCP discovery/tool access, signed bounded webhook delivery and shared quota ownership. Hosted third-party account infrastructure and uploaded-agent/outbound-runtime execution are not part of this activation.
- Execute [IAM/APP target cases](../../testing/identity-and-access.md) through real persistence, stateful HTTP, revocation races, erasure/restore and the [capacity envelope](../../architecture/identity-access-capacity.md). Extend OpenAPI/SDK consumers and diagnostics without exposing raw global principal identity.

- Move remaining generic consumers onto qualified identity and catalog metadata revision values. Extend the bridges for other revision owners and add occurrence references using complete concrete FK keys and sealed targets; qualify scoped addresses without a universal Unit parent or unchecked polymorphic ID.
- Define stable logical owner versus physical table/database placement, and qualify same-owner layout changes separately from logical-owner corrections. Reference shape alone does not prove independence.
- Complete the shared Unit contract across owner adapters: bounded resolution/state/summary, supported structural capabilities, exact targets and current authorization. Remove per-owner target alternatives from generic consumers without duplicating Tag, favorite, follow, relation or access behavior by resource kind; retain domain-specific structural FKs.
- Implement canonical definitions, operation receipts, narrow heads and immutable revisions. Preserve unknown/absent/conflict and sensitive-value availability states.
- Reconcile existing participation fixtures with the new target, then integrate Realm disclosure, ownership and cross-module enforcement, mixed resource grants/restrictions and exact disclosure fences. Older fixture counts do not qualify new group/role/delegation dependencies.
- Extend the fresh native fixture workflow for remaining lifecycle contracts and finish account-erasure workers and restoration-frontier cases without online migration steps.
- Test added revision/occurrence families, slug collisions, stale writes, revoked authority, private evidence and account erasure; qualify consumer disclosure independently from reference integrity.
- Qualify the [Unit capability cases](../../testing/foundation.md#unit-capability-contract-acceptance), including logical owner-layout changes and independent metadata-only Work references, on the single-database target. Distributed deployment and live relocation are outside this gate.
- Expose lookup/access/history APIs after persistence tests pass; regenerate affected consumers together.

## Acceptance

Real PostgreSQL rejects invalid references and stale/revoked writes under two-connection races. Stateful APIs preserve produced identities. A class, source claim or declared creator cannot grant authority. Every public/private reference has a tested disclosure path. Use owning database/access tasks, not parser mocks alone.

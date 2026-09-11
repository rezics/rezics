# Authorization

The backend is authoritative. Every request owns one `Authorization`, including
anonymous requests. Authenticated decisions carry the account and self Entity;
native catalog decisions also require the current participation context. The
engines consume the canonical [access vocabulary](../../../../../libraries/access/README.md).

Routes and services ask the domain that owns the subject. Each domain lives in
its own directory; `authorization.ts` performs actor-bound decisions, while
`policy.ts` and `query.ts` hold reusable rules with no request-bound authority.

- `account` owns account enforcement for writes and contributions.
- `unit` owns Unit visibility, ownership, atomic permission grants and restrictions, publishing,
  restoration, and deletion.
- `collection` owns collection ownership.
- `realm` owns membership state, rules, hierarchy, and maps Realm operations to Unit permissions.
- `platform` owns global capability grants.
- `upload` owns profile-scoped object keys.

Only the root `Authorization` constructs domain authorizers. Application code
must not instantiate them separately or call their database decisions around the
root. Pure policy and query-condition exports remain available where no actor is
being authorized.

Retained platform owners share Unit access; native catalog reads dispatch to their participation
policy. A platform-resource grant assigns one atomic permission to an Auth account, all active members of a
Realm, or every authenticated Profile. A restriction denies one atomic permission to a Profile or
all active members of a Realm. An empty scope is the Unit root and an ancestor scope covers
descendants. Permission implications are expanded by policy; clients never infer authority from
labels or roles. Profile invitations contain an explicit permission list and have no effect until
accepted.

Zone-specific permissions are applicable only when the target Unit kind is `zone`.
`zone.theme.manage` delegates token and preset management without granting page, navigation,
general Unit-update, or lifecycle mutations. Level 1 and preset mutations additionally pass the
platform development-preview gate through the Zone authorizer; ownership and platform Unit-edit
authority remain the ordinary recovery boundaries but do not bypass that release gate.

For an existing Unit, access precedence is platform `unit.edit`, current direct Profile ownership,
matching Profile or Realm restriction, then matching authenticated, Realm, or Profile grants.
Platform authority and ownership are recovery boundaries and deliberately override restrictions.
Realm subjects cannot own Units. Missing or deleted Units are rejected before this precedence is
evaluated. The policy tests are the executable contract for this order.

Governance mutation is scope-aware: an actor delegated `unit.access.manage` at
`zone/page/welcome` may change grants or restrictions for that subtree but cannot manage a sibling
or the Unit root, and may delegate only permissions the actor holds for the same scope. Ownership
transfer requires the current owner or platform authority. Dock surfaces use `dock/{surface}`.
Zone resources use `zone/boundary`, `zone/theme`, `zone/settings`, `zone/page/{slug}`, and
`zone/navigation/{navigationId}`; Wiki navigation uses
`realm/wiki/navigation/{navigationId}`. The
effective-access endpoint returns permission decisions and their provenance so clients do not
duplicate policy.

Decisions are memoized per request and expiry is checked at decision time. Visibility fails closed:
deleted or moderation-removed Units are invisible, configured Search exposes only discoverable
public Units plus Units explicitly readable by the actor, and denied direct reads are reported as
not found. Ownership, grants, and restrictions use append-only revocation records, and the database
enforces one active owner per Unit.

Request-local cached decisions are presentation or preliminary admission results.
Mutations use transaction-bound checks rather than cached decisions.

## Resource access fences

[access-lock.ts](unit/access-lock.ts) orders and deduplicates resource keys. Dependent commands
take shared fences; grant, restriction and ownership changes take exclusive fences. Acquire
these before routing/native row locks and evaluate policy in a subsequent READ COMMITTED
statement. Favorites preview capture holds this fence through its saved-content transaction.
Already captured private content belongs to its account; refreshing it requires current access.

This resource fence does not by itself qualify all transitive Realm membership, platform
control, exact-revision disclosure or recovery dependencies. Their owner-specific checks
remain required; see [foundation verification](../../../../../docs/testing/foundation.md).

## Expiry at the authorization checkpoint

Grant, restriction and invitation predicates use `statement_timestamp()`, so each check uses
the start of its current SQL statement rather than the start of a possibly older transaction.
This STABLE cutoff remains usable as an indexed comparison value. PostgreSQL distinguishes
these time sources in its [current date/time contract](https://www.postgresql.org/docs/18/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT).

Platform grant selection locks its candidate row. If that grant has an expiry, a second
scalar statement checks the deadline after the row lock is acquired: a wait can outlive the
candidate query's cutoff even when the lock holder does not modify the row. The locked
grant cannot be concurrently revoked between this checkpoint and the admitted operation.
Each later operation must perform its own check; this is not an entitlement lasting for
the remainder of an arbitrarily long transaction.

The expiry change adds no storage or indexes at either the 500M or 3B planning scale.
Resource/principal predicates retain their existing selective keys. The platform active
unique key bounds unrevoked candidates to one per account/capability; an expiring selected
grant adds one constant-time SQL statement and one round trip, with no additional table
scan. Monitor authorization latency and lock wait; the focused fixture is not sustained-load
or whole-authority-graph acceptance.

## Read scopes

`unit.read` uses the same ancestor-prefix rule as other scoped permissions. A
read grant for `section/one` permits that scope and its descendants, not the
resource root, `section` or sibling paths. Full resource detail/list reads require
root read authority; a descendant grant is not a whole-resource disclosure.
Ownership and platform recovery precedence remain unchanged, and matching
restrictions still override ordinary grants.

The decision reuses the bounded-depth scope comparison (at most eight segments).
It adds no SQL, storage or indexes and filters candidates before the existing
specificity sort. This change does not qualify unbounded authority-graph fan-out
or alter the existing 500M/3B workload assumptions.

## Access-configuration snapshots

The access-management snapshot resolves Auth recipients through active self-Entity
bindings and their public Entity names. A private Auth account name is not a
recipient label; an absent or inactive self binding yields no label. The owner label
continues to use its public Entity presentation.

Snapshot queries sharing a transaction client run sequentially. This preserves
one database snapshot without relying on PostgreSQL client query queuing. Label
hydration stays in a single account-binding query with indexed Entity-name probes;
there is no per-recipient application query. No new rows or indexes are added at
either the 500M or 3B planning scale. Broad access-roster cardinality remains part
of the remaining workload qualification.

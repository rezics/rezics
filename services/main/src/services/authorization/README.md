# Authorization

The backend is authoritative. Every request owns one `Authorization`, including
anonymous requests, and all decisions are bound to its `profileId`.

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

Unit access is one mechanism for every Unit kind, including Realms, Entities, Zones, Books, Posts,
Wikis, and Collections. A grant assigns one atomic permission to a Profile, all active members of a
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

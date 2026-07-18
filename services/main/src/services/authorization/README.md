# Authorization

The backend is authoritative. Every request owns one `Authorization`, including
anonymous requests, and all decisions are bound to its `profileId`.

Routes and services ask the domain that owns the subject. Each domain lives in
its own directory; `authorization.ts` performs actor-bound decisions, while
`policy.ts` and `query.ts` hold reusable rules with no request-bound authority.

- `account` owns account enforcement for writes and contributions.
- `unit` owns Unit visibility, role-to-permission decisions, scoped bindings, Profile restrictions,
  protections, publishing, restoration, and deletion.
- `collection` owns collection ownership.
- `realm` owns membership, role capabilities, Realm grants, rules, and hierarchy.
- `platform` owns global capability grants.
- `upload` owns profile-scoped object keys.

Only the root `Authorization` constructs domain authorizers. Application code
must not instantiate them separately or call their database decisions around the
root. Pure policy and query-condition exports remain available where no actor is
being authorized.

Unit access is one mechanism for ordinary Units including Zones, Books, Posts, Wikis, and
Collections. A binding subject is a Profile, a Realm relationship (`member`, `content_editor`, or
`governor`), or every authenticated Profile. Roles expand into permissions; an empty scope is the
Unit root and an ancestor scope covers descendants. Profile restrictions and restrictions on the
active members of a Realm override non-platform grants, which supports open editing plus a targeted
deny-list. A direct Profile owner bypasses Realm-derived restrictions so a later membership change
cannot remove the Unit's recovery path; direct Profile restrictions remain authoritative. Dynamic
Realm subjects cannot own Units. Protections are independent guardrails (`frozen` or `owner_only`)
and do not grant access by themselves.

For an existing Unit, access precedence is platform `unit.edit`, direct Profile restriction, Realm
restriction unless the actor is a direct Profile owner, public or binding access, then protection.
Platform authority is the recovery boundary and deliberately overrides every access restriction and
protection. Missing or deleted Units are rejected before this precedence is evaluated. The policy
tests are the executable contract for this order.

Governance mutation is itself scope-aware: a maintainer delegated to `zone/page/welcome` may grant,
restrict, or protect that subtree but cannot manage a sibling or the Unit root. Owner and
maintainer assignment additionally requires a root owner or platform authority. Zone surfaces use
`zone/boundary`, `zone/theme`, `zone/dock`, `zone/settings`, `zone/page/{slug}`, and
`zone/navigation/{key}`. The effective-access endpoint returns permission decisions and their
source so clients never infer capabilities from role names.

Decisions are memoized per request and expiry is checked at decision time. Visibility fails closed:
deleted or moderation-removed Units are invisible, configured Search exposes only discoverable
public Units plus Units explicitly readable by the actor, and denied direct reads are reported as
not found. Access mutation uses revocation records and preserves a last-owner invariant.

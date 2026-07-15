# Authorization

The backend is authoritative. Every request owns one `Authorization`, including
anonymous requests, and all decisions are bound to its `profileId`.

Routes and services ask the domain that owns the subject. Each domain lives in
its own directory; `authorization.ts` performs actor-bound decisions, while
`policy.ts` and `query.ts` hold reusable rules with no request-bound authority.

- `account` owns account enforcement for writes and contributions.
- `unit` owns unit visibility, editing, restoration, and field locks.
- `collection` owns collection ownership.
- `realm` owns membership, role capabilities, Realm grants, rules, and hierarchy.
- `platform` owns global capability grants.
- `upload` owns profile-scoped object keys.

Only the root `Authorization` constructs domain authorizers. Application code
must not instantiate them separately or call their database decisions around the
root. Pure policy and query-condition exports remain available where no actor is
being authorized.

Unit read and edit booleans are memoized for the request. Grants and account
enforcements are checked against expiry at decision time. Visibility fails
closed: deleted units are invisible, private Realms require active membership,
and a denied read is reported as not found.

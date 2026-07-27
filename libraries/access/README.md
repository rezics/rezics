# Access model

`@rezics/access` is the canonical vocabulary and pure contract for Rezics domain access control.
Persistence, backend authorization, API schemas, localization, bootstrap data, and tests consume
this package; none of those consumers may define a second permission registry.

The package deliberately does not authenticate callers, query grants, resolve ownership or Realm
membership, evaluate request-bound decisions, or expose user-interface copy. Those responsibilities
belong to the backend authorization engine and the owning product surfaces.

## Vocabulary

- A **permission** is one independently grantable operation on a logical resource.
- A **role** is a named collection of permissions. A role is not itself a permission.
- A **scope** narrows a permission to a Unit root or descendant path.
- A **policy** combines identity, ownership, grants, restrictions, membership, and resource state
  into a decision.
- An **API scope** controls whether a credential may enter an API surface. It does not prove access
  to a particular domain object.

Keep these layers distinct. An API operation may require multiple permissions, and an API method,
HTTP verb, button label, audit event, or persistence strategy does not determine a permission key.

## Permission keys

Keys use a logical resource path followed by one atomic action:

```text
<authority-or-resource>.<logical-resource-path>.<action>
```

Examples:

```text
unit.update
unit.status.update
realm.units.create
realm.post.replies.create
realm.rules.update
```

Use `read`, `create`, `update`, and `delete` by default. A domain action such as `restore`,
`moderate`, or `manage` is permitted only when it represents an independently grantable security
boundary that cannot be described accurately by a standard action. Every domain action requires a
rationale in `UnitPermissionDefinitions`.

Do not introduce `write` as a leaf domain permission. `write` may describe an intentionally broad
API credential scope or role, but it hides which mutations are actually authorized.

## The independent-grant test

Split two permission keys only when the product needs to grant the operations independently.

- Editing a Unit and changing its lifecycle status are independently grantable, so status changes
  require both `unit.update` and `unit.status.update`.
- Creating a direct Realm Unit and creating a Reply are independently grantable, so they use
  `realm.units.create` and `realm.post.replies.create`.
- Updating Realm rules appends an immutable revision, but the logical operation remains
  `realm.rules.update`. Append-only storage does not create a separate publish permission.

A permission makes an actor eligible to attempt an operation. Domain validation still rejects
invalid values, illegal state transitions, stale revisions, and broken invariants.

## Permissions, roles, and implications

Leaf permissions remain explicit. A permission must not silently gain an unrelated mutation merely
because a common role normally includes both. For example, `unit.status.update` does not imply
`unit.update`; a publishing editor role contains both.

Implications capture stable prerequisite access such as `unit.update` implying `unit.read`. They are
declared centrally, closed transitively, ordered by the canonical permission tuple, and tested for
cycles.

## Persistence and transport

The TypeScript tuples in this package are the current source of truth. PostgreSQL enums consume
them, migrations change stored values, API schemas expose them, and generated clients reflect the
API. Historical migration files and generated outputs may contain copied values because they are
artifacts, not competing registries.

Immutable revisions are persistence records, not necessarily authorization resources. Name a
permission after the logical aggregate being changed unless revisions themselves are first-class,
independently grantable objects.

Default grants are provisioning choices, not permanent visibility invariants. A public Realm is
created with authenticated `realm.units.create` and `realm.post.replies.create` grants; later
visibility changes do not silently recreate grants that a Realm owner deliberately revoked.

## Adding or changing a permission

1. State the logical resource, action, security boundary, and explicit non-effects.
2. Prefer a standard action; document the rationale for a domain action.
3. Add the key to the canonical tuple and its complete definition.
4. Review applicability, authenticated grantability, scopes, and implications.
5. Update roles, bootstrap data, database migrations, API schemas, localization, and audit
   presentation as applicable.
6. Add allowed and denied behavior tests, including adjacent operations that must remain denied.
7. Regenerate transport artifacts and run the access, backend, i18n, and affected frontend checks.

New resource kinds and new permission keys require an explicit access review. Do not use wildcard
or fallback classification that grants future resources authority merely because they compile.

## Design references

These references guide the model but do not replace this repository's typed contract:

- [Google API Improvement Proposal 211: Authorization checks](https://google.aip.dev/211)
- [Google Cloud IAM permissions overview](https://cloud.google.com/iam/docs/permissions-overview)
- [OpenFGA modeling concepts](https://openfga.dev/docs/modeling/getting-started)

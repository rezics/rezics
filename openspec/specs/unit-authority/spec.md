# unit-authority Specification

## Purpose

Defines the `hasAuthorityOver(caller, unit)` service-layer
predicate exposed by the `unit` server domain. Owns the three
authority paths (owner via `Unit.userId`, system `ADMIN` from
access-token claims, and realm `MODERATOR`/`OWNER` via
`RealmUnit`), the rule that owner-less units never authorize
through `null === null`, and the indexed-lookup latency budget
(<10ms p99) used by the `work-release` and `work-link-claim`
capabilities.

## Requirements

### Requirement: hasAuthorityOver(caller, unit) returns true for owner, admin, or realm-moderator

The `unit` server domain SHALL expose a service-layer predicate `hasAuthorityOver(caller, unit) → boolean` that returns `true` if any of the following hold:

1. `unit.userId !== null AND unit.userId === caller.userId` (the caller owns the unit).
2. The caller carries the `ADMIN` system role (resolved from the access token).
3. The caller is a moderator (or higher role: `MODERATOR`, `OWNER`) in any Realm that contains the unit via `RealmUnit`.

The predicate is the canonical authorization input for any operation introduced by the `work-release` and `work-link-claim` capabilities. Callers SHALL NOT inline these checks elsewhere; they SHALL invoke this predicate.

#### Scenario: Owner has authority

- GIVEN a Unit "u" with `userId = "user-a"`
- AND a caller with `userId = "user-a"`
- WHEN `hasAuthorityOver(caller, u)` is invoked
- THEN it SHALL return `true`

#### Scenario: System admin has authority over any unit

- GIVEN a Unit "u" with `userId = "user-a"`
- AND a caller with `userId = "user-b"` AND admin role
- WHEN `hasAuthorityOver(caller, u)` is invoked
- THEN it SHALL return `true`

#### Scenario: Realm moderator has authority over units in their realm

- GIVEN a Unit "u" referenced by a `RealmUnit` row of realm "R"
- AND a caller who is a moderator of realm "R" (and not the owner of "u", not a system admin)
- WHEN `hasAuthorityOver(caller, u)` is invoked
- THEN it SHALL return `true`

#### Scenario: Stranger has no authority

- GIVEN a Unit "u" with `userId = "user-a"`, not referenced by any realm the caller moderates
- AND a caller who is not "user-a", not an admin, and not a mod of any realm containing "u"
- WHEN `hasAuthorityOver(caller, u)` is invoked
- THEN it SHALL return `false`

### Requirement: Authority check tolerates units without an owner

A unit with `userId = null` (e.g., a system-imported catalog Unit) SHALL pass the authority predicate only via the admin or realm-mod paths. The owner path SHALL NOT match `null === null` to grant authority to any caller.

#### Scenario: Null-owner unit and a non-admin caller

- GIVEN a Unit "u" with `userId = null` and not in any realm the caller moderates
- AND a caller who is not an admin
- WHEN `hasAuthorityOver(caller, u)` is invoked
- THEN it SHALL return `false`

### Requirement: Authority resolution latency budget

The predicate SHALL resolve in under 10 ms at the p99 for typical realm-membership cardinalities (a unit appearing in at most a handful of realms, a caller moderating at most a few hundred realms). Implementations SHOULD use indexed JOINs on `RealmUnit (unitId, realmId)` × realm role tables and SHOULD cache admin role on the access token.

#### Scenario: Latency under indexed lookup

- GIVEN a unit referenced by 3 `RealmUnit` rows
- AND a caller with admin role bit cached on the access token
- WHEN `hasAuthorityOver(caller, unit)` is invoked
- THEN the response SHALL be returned in under 10 ms p99 in production-equivalent environments

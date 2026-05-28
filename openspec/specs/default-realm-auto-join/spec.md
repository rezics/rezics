# default-realm-auto-join Specification

## Purpose

Defines the fire-and-forget step in `/internal/users/provision` that
adds every newly-provisioned user to the default realm using the cached
default realm ID. The auto-join is best-effort: it never blocks the
provisioning response, and failures (missing cache, duplicate
membership, database errors) are caught and logged so user creation
always succeeds.

## Requirements

### Requirement: Auto-join default realm on user provisioning

The `/internal/users/provision` endpoint SHALL add a fire-and-forget step after user upsert that joins the new user to the default realm. The join SHALL use the cached default realm ID from the server boot-time cache.

The auto-join SHALL NOT block the provisioning response. Failures (including duplicate membership errors) SHALL be caught and logged, not propagated.

#### Scenario: New user provisioned with default realm available

- **WHEN** a new user is provisioned via `/internal/users/provision` and the default realm ID is cached
- **THEN** the user is added as a `RealmMember` with `roleKey: "member"` and the provisioning response returns `{ ok: true }` without waiting for the join to complete

#### Scenario: Existing user re-provisioned

- **WHEN** an existing user is re-provisioned (upsert hits update path) and they are already a member of the default realm
- **THEN** the join attempt throws a unique constraint error, which is caught silently, and the provisioning response returns `{ ok: true }`

#### Scenario: Default realm ID not cached

- **WHEN** a user is provisioned but `getDefaultRealmId()` returns `null`
- **THEN** the auto-join step is skipped entirely and the provisioning response returns `{ ok: true }`

#### Scenario: Auto-join fails due to database error

- **WHEN** a user is provisioned and the realm join fails for any reason (network, constraint, etc.)
- **THEN** the failure is logged and the provisioning response still returns `{ ok: true }`

# realm-membership-me Specification

## Purpose

Defines the authenticated `GET /realms/:unitId/members/me`
endpoint and its `RealmMemberDTO` (or `null`) response. Owns the
rule that the endpoint returns the caller's
`roleKey` / `joinedAt` for the addressed realm without leaking
other members' state, and supports surfaces that need to know
"am I a member, and what is my role here" without listing the
full membership.

## Requirements

### Requirement: Endpoint GET /realms/:unitId/members/me returns current user's membership
The server SHALL expose `GET /realms/:unitId/members/me` that returns the authenticated user's `RealmMemberDTO` (including `roleKey`) for the specified realm, or `null` if the user is not a member. The endpoint SHALL require authentication.

#### Scenario: Member queries their own role
- **GIVEN** user "Alice" is a moderator of realm "Fantasy Hub"
- **WHEN** Alice calls `GET /realms/<fantasy-hub-id>/members/me`
- **THEN** the response SHALL contain `{ realmUnitId, userId, roleKey: "moderator", joinedAt }`

#### Scenario: Non-member queries membership
- **GIVEN** user "Bob" is not a member of realm "Fantasy Hub"
- **WHEN** Bob calls `GET /realms/<fantasy-hub-id>/members/me`
- **THEN** the response SHALL be `null`

#### Scenario: Unauthenticated request rejected
- **WHEN** an unauthenticated request is made to `GET /realms/<id>/members/me`
- **THEN** the endpoint SHALL respond with an authentication error

### Requirement: Frontend hook useMyRealmMembership
The `@rezics/api` package SHALL expose a `useMyRealmMembership(realmId)` query hook that fetches the current user's realm membership. The hook SHALL return the membership data or `null`. Stale time SHALL be 5 minutes.

#### Scenario: Hook returns membership for member
- **GIVEN** the current user is a moderator of the realm
- **WHEN** `useMyRealmMembership(realmId)` is called
- **THEN** `data.roleKey` SHALL be `"moderator"`

#### Scenario: Hook returns null for non-member
- **GIVEN** the current user is not a member of the realm
- **WHEN** `useMyRealmMembership(realmId)` is called
- **THEN** `data` SHALL be `null`

### Requirement: canManageRealm utility
The system SHALL provide a `canManageRealm` utility function that determines if the current user can manage a realm. The function SHALL return `true` if the user's global role is `ADMIN` or `ROOT`, OR if the user's realm membership role is `owner`, `admin`, or `moderator`.

#### Scenario: Global admin can manage any realm
- **GIVEN** a user with global role `ADMIN` who is not a member of a realm
- **WHEN** `canManageRealm` is evaluated
- **THEN** it SHALL return `true`

#### Scenario: Realm moderator can manage
- **GIVEN** a user with global role `USER` and realm role `moderator`
- **WHEN** `canManageRealm` is evaluated
- **THEN** it SHALL return `true`

#### Scenario: Regular member cannot manage
- **GIVEN** a user with global role `USER` and realm role `member`
- **WHEN** `canManageRealm` is evaluated
- **THEN** it SHALL return `false`

#### Scenario: Non-member cannot manage
- **GIVEN** a user with global role `USER` and no realm membership
- **WHEN** `canManageRealm` is evaluated
- **THEN** it SHALL return `false`

### Requirement: Join action atomically writes both edges

The realm join endpoint SHALL atomically write both a `RealmMember` row (permission edge with default `roleKey='member'`) and a `Subscription` row (attention edge with default `channels=['*']`). The two writes SHALL succeed or fail together. The endpoint SHALL also update both `Realm.memberCount` and `Unit.subscriberCount` for the realm unit in the same transaction.

#### Scenario: Join inserts both rows

- **GIVEN** user U is not a member of realm R
- **WHEN** U calls the realm join endpoint for R
- **THEN** after the request commits, both `RealmMember(realmUnitId=R, userId=U.unitId)` and `Subscription(subscriberUnitId=U.unitId, targetUnitId=R, channels=['*'])` exist, and `Realm.memberCount` and `Unit.subscriberCount` for R are each incremented by 1

#### Scenario: Failure rolls back both rows

- **WHEN** the join transaction fails after inserting `RealmMember` but before inserting `Subscription`
- **THEN** the transaction rolls back and neither row exists after the request

### Requirement: Leave action atomically removes both edges

The realm leave endpoint SHALL atomically delete both the user's `RealmMember` row and the user's `Subscription` row to the realm, if either exists. Counters SHALL be decremented accordingly in the same transaction.

#### Scenario: Leave removes both rows

- **GIVEN** user U has both `RealmMember(R, U)` and `Subscription(U → R)`
- **WHEN** U calls the realm leave endpoint for R
- **THEN** after the request commits, neither row exists and both counters are decremented by 1

#### Scenario: Leave is idempotent on partial state

- **GIVEN** user U has `RealmMember(R, U)` but no `Subscription(U → R)` (state predating this change or after a manual mute)
- **WHEN** U calls the realm leave endpoint for R
- **THEN** the `RealmMember` row is removed, no error is raised about the missing subscription, and `Realm.memberCount` is decremented while `Unit.subscriberCount` is unchanged

### Requirement: Mute action affects subscription only

The realm mute endpoint SHALL delete the user's `Subscription` row to the realm without affecting the `RealmMember` row. The unmute endpoint SHALL re-insert a `Subscription` row with default `channels=['*']`.

#### Scenario: Mute preserves membership

- **GIVEN** user U has both `RealmMember(R, U, roleKey='moderator')` and `Subscription(U → R, channels=['*'])`
- **WHEN** U calls the realm mute endpoint for R
- **THEN** the `Subscription` row is deleted, the `RealmMember` row remains with `roleKey='moderator'` unchanged, `Unit.subscriberCount` is decremented, and `Realm.memberCount` is unchanged

#### Scenario: Unmute restores subscription

- **GIVEN** user U has `RealmMember(R, U)` and no `Subscription(U → R)`
- **WHEN** U calls the realm unmute endpoint for R
- **THEN** a new `Subscription(U → R, channels=['*'])` row is created and `Unit.subscriberCount` is incremented

### Requirement: Public-realm lurker subscription path

Subscribing to a realm SHALL NOT require membership. The subscription service SHALL allow `POST /subscription { targetUnitId: realmUnitId }` from any authenticated user when the target realm is public (`Realm.isPublic = true`). Private realms SHALL reject non-member subscription attempts.

#### Scenario: Public realm allows lurker subscription

- **GIVEN** realm R has `isPublic = true` and user U is not a member of R
- **WHEN** U calls `POST /subscription` with `{ targetUnitId: R.unitId }`
- **THEN** a `Subscription` row is created and no `RealmMember` row is created

#### Scenario: Private realm blocks non-member subscription

- **GIVEN** realm R has `isPublic = false` and user U is not a member of R
- **WHEN** U calls `POST /subscription` with `{ targetUnitId: R.unitId }`
- **THEN** the request is rejected with an authorization error

### Requirement: Current membership includes state and capability hints

`GET /realms/:unitId/members/me` SHALL return membership role, member state, accepted rule identity/version metadata, muted/banned status, and server-derived capability hints for realm UI rendering. Rule acknowledgement metadata SHALL identify at least the current rule Unit id, required rule version, accepted rule version when present, and whether acknowledgement is currently required.

#### Scenario: Muted member fetches membership

- **GIVEN** the current user is muted in the realm
- **WHEN** they call `GET /realms/:unitId/members/me`
- **THEN** the response SHALL include `state: "muted"` and posting capability hints set to false

#### Scenario: Member has not accepted current rule unit

- **GIVEN** a realm requires rule Unit `R2` at version 1
- **AND** the current user previously accepted old rule Unit `R1` at version 4
- **WHEN** they call `GET /realms/:unitId/members/me`
- **THEN** the response SHALL report current rule Unit `R2`
- **AND** acknowledgementRequired SHALL be true

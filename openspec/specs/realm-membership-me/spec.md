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

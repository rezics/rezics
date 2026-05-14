## ADDED Requirements

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

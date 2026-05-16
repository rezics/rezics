## Purpose

The engagement-subscription capability provides a single, unified attention edge between any user and any subscribable Unit (users, books, realms, posts, tags, etc.). Every "I want to know about X" intent in the platform — follows, realm subscriptions, book follows, DM permission, mention reachability — is expressed as a row in the `Subscription` table with a per-channel filter, replacing the legacy `Follow` model and ad-hoc per-domain recipient resolution. The capability owns the subscription data model, the channel registry, the fan-out recipient resolver consumed by the notification feed, the denormalized subscriber counts, and the CRUD API surface for managing subscriptions.

## Requirements

### Requirement: Subscription edge model

The system SHALL persist attention edges in a `Subscription` model with `id`, `subscriberUnitId` (a `Unit.id` of type `USER` in v1), `targetUnitId` (any `Unit.id`), `channels` (a `String[]` filter), `createdAt`, and `updatedAt`. The pair `(subscriberUnitId, targetUnitId)` SHALL be unique.

#### Scenario: Subscribe to a target

- **WHEN** user U calls `POST /subscription` with `{ targetUnitId: T }` and no `channels` field
- **THEN** a `Subscription` row is created with `subscriberUnitId=U.unitId`, `targetUnitId=T`, `channels=['*']`

#### Scenario: Duplicate subscription rejected

- **GIVEN** user U already has a `Subscription` row with `targetUnitId=T`
- **WHEN** U calls `POST /subscription` with `{ targetUnitId: T }` again
- **THEN** the request is rejected with a conflict error and no second row is inserted

#### Scenario: Self-subscription rejected

- **WHEN** user U calls `POST /subscription` with `{ targetUnitId: U.unitId }`
- **THEN** the request is rejected with a validation error

### Requirement: Channel filter shape

`Subscription.channels` SHALL contain entries matching one of three forms:

1. The single token `'*'` denoting "every event on this target".
2. `'<category>.*'` where `<category>` is a registered category for the target's `UnitType` — denoting "every event in this category".
3. `'<category>.<event>'` matching an exact event name registered for the target's `UnitType`.

The system SHALL reject writes containing any channel string not matching one of the three forms or referencing an unknown category or event for the target type.

#### Scenario: Wildcard accepted

- **WHEN** a write sets `channels=['*']`
- **THEN** the write succeeds

#### Scenario: Category wildcard accepted

- **WHEN** a write sets `channels=['chapter.*']` for a `BOOK` target
- **THEN** the write succeeds

#### Scenario: Mixed channels accepted

- **WHEN** a write sets `channels=['chapter.*', 'review.new']` for a `BOOK` target
- **THEN** the write succeeds

#### Scenario: Unknown event rejected

- **WHEN** a write sets `channels=['chapter.exploded']` for a `BOOK` target and `chapter.exploded` is not in the registry
- **THEN** the write is rejected with a validation error naming the offending channel

#### Scenario: Wrong-type channel rejected

- **WHEN** a write sets `channels=['chapter.new']` for a `TAG` target
- **THEN** the write is rejected with a validation error

### Requirement: Channel registry per UnitType

The `@rezics/contract` package SHALL export a `CHANNEL_REGISTRY` mapping each subscribable `UnitType` to its `categories` set and its `events` set. The registry SHALL be the single source of truth consumed by both backend write-validation and frontend channel-picker UI.

#### Scenario: Backend and frontend agree

- **WHEN** the backend rejects `chapter.unknown` for `BOOK`
- **THEN** the frontend channel picker built from `CHANNEL_REGISTRY.BOOK` does not offer `chapter.unknown` as a selectable option

### Requirement: Fan-out recipient resolver

The system SHALL provide a backend resolver that, given an event `{ kind, sourceUnitId, directRecipients?, payload? }`, returns the union of (a) `directRecipients` and (b) all `subscriberUnitId` values from `Subscription` rows where `targetUnitId = sourceUnitId` and the row's `channels` matches the event by any of the three wildcard tiers.

The resolver query SHALL evaluate three array-containment checks against `channels`: exact event, `'<category>.*'`, and `'*'`.

#### Scenario: Exact-event subscriber matches

- **GIVEN** user U has `Subscription(target=B, channels=['chapter.new'])`
- **WHEN** event `{ kind: 'chapter.new', sourceUnitId: B }` is resolved
- **THEN** U is in the recipient set

#### Scenario: Category-wildcard subscriber matches

- **GIVEN** user U has `Subscription(target=B, channels=['chapter.*'])`
- **WHEN** event `{ kind: 'chapter.updated', sourceUnitId: B }` is resolved
- **THEN** U is in the recipient set

#### Scenario: Global-wildcard subscriber matches

- **GIVEN** user U has `Subscription(target=B, channels=['*'])`
- **WHEN** event `{ kind: 'review.new', sourceUnitId: B }` is resolved
- **THEN** U is in the recipient set

#### Scenario: Non-matching channel filter excludes

- **GIVEN** user U has `Subscription(target=B, channels=['review.new'])`
- **WHEN** event `{ kind: 'chapter.new', sourceUnitId: B }` is resolved
- **THEN** U is not in the recipient set

#### Scenario: Direct recipient included regardless of subscription

- **GIVEN** user U has no subscription to B
- **WHEN** event `{ kind: 'reply.new', sourceUnitId: B, directRecipients: [U.unitId] }` is resolved
- **THEN** U is in the recipient set

### Requirement: Denormalized subscriber count

`Unit` SHALL carry a `subscriberCount: Int @default(0)` column maintained by the subscription service. The counter SHALL be incremented atomically with each `Subscription` insert and decremented atomically with each delete, both within the same transaction as the row write.

#### Scenario: Subscribe increments count

- **GIVEN** `Unit T` has `subscriberCount = 5`
- **WHEN** a new `Subscription(target=T)` row is inserted
- **THEN** `Unit.subscriberCount` for `T` is `6` after the transaction commits

#### Scenario: Unsubscribe decrements count

- **GIVEN** `Unit T` has `subscriberCount = 6` and user U has a subscription to T
- **WHEN** U deletes their subscription to T
- **THEN** `Unit.subscriberCount` for `T` is `5` after the transaction commits

### Requirement: Realm dual-track join semantics

The system SHALL treat `RealmMember` (permission edge with `roleKey`) and `Subscription` (attention edge with `channels`) as two orthogonal edges between a user and a realm. The join action SHALL atomically write both rows; the leave action SHALL atomically remove both; the mute action SHALL remove only the `Subscription` row.

#### Scenario: Join writes both edges

- **WHEN** user U calls `POST /realm/:id/join` for a realm she is not a member of
- **THEN** a `RealmMember(realmUnitId=:id, userId=U.unitId, roleKey='member')` row is inserted AND a `Subscription(subscriberUnitId=U.unitId, targetUnitId=:id, channels=['*'])` row is inserted, both within one transaction

#### Scenario: Leave removes both edges

- **GIVEN** user U is a member of realm R and has a subscription to R
- **WHEN** U calls `POST /realm/:id/leave`
- **THEN** both the `RealmMember` and the `Subscription` row are deleted within one transaction

#### Scenario: Mute keeps membership, removes subscription

- **GIVEN** user U is a member of realm R and has a subscription to R
- **WHEN** U calls `POST /realm/:id/mute`
- **THEN** the `Subscription` row is deleted and the `RealmMember` row remains intact

#### Scenario: Lurker subscription without membership

- **GIVEN** realm R is public and user U is not a member of R
- **WHEN** U calls `POST /subscription` with `{ targetUnitId: R.unitId }`
- **THEN** a `Subscription` row is created and no `RealmMember` row is created

### Requirement: Follow retirement and backfill

The legacy `Follow` model SHALL be retired in this change. Every existing `Follow(followerId=A, followingId=B)` row SHALL be backfilled into `Subscription(subscriberUnitId=A, targetUnitId=B, channels=['*'])`. After backfill, the `Follow` table SHALL be dropped.

`User.followersCount` and `User.followingsCount` SHALL be recomputed from `Subscription` aggregates restricted to USER-typed subscribers and targets, and SHALL remain denormalized counters maintained by the subscription service.

#### Scenario: Existing follow becomes subscription

- **GIVEN** a row `Follow(followerId=A, followingId=B)` exists before migration
- **WHEN** the migration runs
- **THEN** a `Subscription(subscriberUnitId=A, targetUnitId=B, channels=['*'])` row exists after migration

#### Scenario: User.followersCount preserved

- **GIVEN** user B had `followersCount=42` before migration backed by 42 `Follow` rows
- **WHEN** the migration runs
- **THEN** `User.followersCount` for B is `42` after migration

### Requirement: Subscription API endpoints

The server SHALL expose:

- `POST /subscription` body `{ targetUnitId, channels? }` — create a subscription; default `channels=['*']`.
- `DELETE /subscription/:targetUnitId` — remove the authenticated user's subscription to the given target.
- `PATCH /subscription/:targetUnitId` body `{ channels }` — replace the channel filter on an existing subscription.
- `GET /subscription/me` query `?targetType=<UnitType>` — list the authenticated user's subscriptions, optionally filtered by target type.
- `GET /subscription/check/:targetUnitId` — return `{ subscribed: boolean, channels?: string[] }` for the authenticated user.
- `GET /subscription/count/:targetUnitId` — return the cached `subscriberCount` for the target.

All write endpoints SHALL require authentication.

#### Scenario: Create endpoint

- **WHEN** an authenticated user U calls `POST /subscription` with `{ targetUnitId: T }`
- **THEN** a `Subscription` row is created and the response contains the row id

#### Scenario: Check endpoint

- **GIVEN** user U has `Subscription(target=T, channels=['chapter.*'])`
- **WHEN** U calls `GET /subscription/check/T`
- **THEN** the response is `{ subscribed: true, channels: ['chapter.*'] }`

#### Scenario: Count endpoint

- **GIVEN** `Unit T` has `subscriberCount = 17`
- **WHEN** any caller (auth or anonymous) calls `GET /subscription/count/T`
- **THEN** the response is `{ count: 17 }`

#### Scenario: Patch updates channels

- **GIVEN** user U has `Subscription(target=T, channels=['*'])`
- **WHEN** U calls `PATCH /subscription/T` with `{ channels: ['chapter.new'] }`
- **THEN** the `Subscription` row's `channels` is `['chapter.new']`

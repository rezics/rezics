# realm-score Specification

## Purpose

Defines the `ScoreEntry` model and aggregate that drive realm
scoped scoring on Units. Owns the `(userId, unitId, realm)`
uniqueness invariant, the 1-10 integer score range with optional
per-field component scores, the rules for create / update /
delete by the owning user, and the realm-aware aggregation
exposed by score read endpoints.

## Requirements

### Requirement: ScoreEntry stores individual user scores per realm

The system SHALL maintain a `ScoreEntry` model representing a single user's score for a unit within a realm. Each ScoreEntry MUST have a UUID primary key (`id`), and the combination of `(userId, unitId, realm)` MUST be unique. The `value` field SHALL be an integer between 1 and 10 inclusive. The `fields` column SHALL be an optional JSON object mapping field keys to integer scores (each also 1-10).

#### Scenario: Create a score for a book in the default realm

- GIVEN a user "user-1", a book "book-1", and the default realm "realm-default"
- WHEN the user submits a score with `value = 8`
- THEN a ScoreEntry SHALL be created with `userId = "user-1"`, `unitId = "book-1"`, `realm = "realm-default"`, `value = 8`, `fields = null`

#### Scenario: Create a score with extended fields

- GIVEN a user "user-1", a book "book-1", and a realm "realm-story" with registered fields `["pacing", "plot", "characters"]`
- WHEN the user submits a score with `value = 8` and `fields = { "pacing": 7, "plot": 9, "characters": 6 }`
- THEN a ScoreEntry SHALL be created with the provided value and fields

#### Scenario: Reject duplicate score for same user-unit-realm

- GIVEN an existing ScoreEntry for `(userId = "user-1", unitId = "book-1", realm = "realm-default")`
- WHEN the user submits another score for the same combination
- THEN the existing ScoreEntry SHALL be updated (upsert), not duplicated

#### Scenario: Reject score outside 1-10 range

- WHEN a user submits a score with `value = 0` or `value = 11`
- THEN the system SHALL reject the request with a validation error
- AND no ScoreEntry SHALL be created or modified

#### Scenario: Reject field score outside 1-10 range

- WHEN a user submits a score with `fields = { "pacing": 15 }`
- THEN the system SHALL reject the request with a validation error

### Requirement: ScoreAggregate maintains pre-computed aggregates per unit and realm

The system SHALL maintain a `ScoreAggregate` model keyed by `(unitId, realm)`. It MUST store `totalScore` (sum of all values), `totalCount` (count of all entries), `distribution` (JSON histogram of scores 1-10), and `fields` (JSON per-field aggregates). The aggregate MUST be updated atomically within the same transaction as ScoreEntry mutations.

#### Scenario: Aggregate created on first score

- GIVEN no existing ScoreAggregate for `(unitId = "book-1", realm = "realm-default")`
- WHEN a user submits a score with `value = 8`
- THEN a ScoreAggregate SHALL be created with `totalScore = 8`, `totalCount = 1`, `distribution = { "8": 1 }`

#### Scenario: Aggregate updated on subsequent score

- GIVEN an existing ScoreAggregate with `totalScore = 40`, `totalCount = 5`, `distribution = { "7": 2, "8": 2, "9": 1 }`
- WHEN a new user submits a score with `value = 7`
- THEN the aggregate SHALL be updated to `totalScore = 47`, `totalCount = 6`, `distribution = { "7": 3, "8": 2, "9": 1 }`

#### Scenario: Aggregate updated on score change

- GIVEN an existing ScoreEntry with `value = 7` and an aggregate reflecting it
- WHEN the user updates their score to `value = 9`
- THEN the aggregate SHALL reflect the delta: `totalScore += 2`, `totalCount` unchanged, `distribution["7"] -= 1`, `distribution["9"] += 1`

#### Scenario: Aggregate updated on score deletion

- GIVEN an existing ScoreEntry with `value = 8` and an aggregate reflecting it
- WHEN the ScoreEntry is deleted
- THEN the aggregate SHALL reflect: `totalScore -= 8`, `totalCount -= 1`, `distribution["8"] -= 1`

#### Scenario: Aggregate deleted when count reaches zero

- GIVEN a ScoreAggregate with `totalCount = 1`
- WHEN the last ScoreEntry is deleted
- THEN the ScoreAggregate row SHALL be deleted

### Requirement: Field-level aggregation with distribution

When a ScoreEntry includes `fields`, the ScoreAggregate's `fields` JSON MUST maintain per-field aggregates. Each field entry SHALL contain `total` (sum), `count` (number of entries with that field), and `dist` (1-10 histogram). Field aggregates MUST be updated atomically alongside the top-level aggregate.

#### Scenario: Field aggregate created on first scored field

- GIVEN a ScoreAggregate with `fields = null`
- WHEN a user submits a score with `fields = { "pacing": 7 }`
- THEN the aggregate's fields SHALL become `{ "pacing": { "total": 7, "count": 1, "dist": { "7": 1 } } }`

#### Scenario: Field aggregate updated on subsequent score

- GIVEN a ScoreAggregate with `fields = { "pacing": { "total": 14, "count": 2, "dist": { "7": 2 } } }`
- WHEN a new user submits a score with `fields = { "pacing": 9 }`
- THEN the field aggregate SHALL become `{ "pacing": { "total": 23, "count": 3, "dist": { "7": 2, "9": 1 } } }`

#### Scenario: Field aggregate handles score update delta

- GIVEN a ScoreEntry with `fields = { "pacing": 7 }` and the aggregate reflecting it
- WHEN the user updates their score to `fields = { "pacing": 9 }`
- THEN the field aggregate SHALL reflect the delta: `total += 2`, `count` unchanged, `dist["7"] -= 1`, `dist["9"] += 1`

#### Scenario: Partial field submission does not affect other fields

- GIVEN a ScoreEntry with `fields = { "pacing": 7, "plot": 8 }`
- WHEN the user updates with `fields = { "pacing": 9 }` (plot omitted)
- THEN the aggregate for "pacing" SHALL be updated
- AND the aggregate for "plot" SHALL reflect the removal: `total -= 8`, `count -= 1`, `dist["8"] -= 1`

### Requirement: Score upsert API

The system SHALL expose `POST /score` for creating or updating a user's score. The request MUST include `unitId`, `realm`, and `value`. The request MAY include `fields`. The endpoint SHALL validate the score range, validate field keys against the realm's ScoreRealmField registry, and perform the upsert + aggregate update in a single transaction. Authentication is required.

#### Scenario: Upsert creates a new score

- GIVEN an authenticated user "user-1" with no existing score for `(unitId = "book-1", realm = "realm-default")`
- WHEN the user calls `POST /score` with `{ unitId: "book-1", realm: "realm-default", value: 8 }`
- THEN the system SHALL create a ScoreEntry and update the ScoreAggregate
- AND return the created ScoreEntry

#### Scenario: Upsert updates an existing score

- GIVEN an authenticated user "user-1" with an existing score of `value = 7` for `(unitId = "book-1", realm = "realm-default")`
- WHEN the user calls `POST /score` with `{ unitId: "book-1", realm: "realm-default", value: 9 }`
- THEN the system SHALL update the ScoreEntry and apply the delta to the ScoreAggregate

### Requirement: Score deletion with review protection

The system SHALL expose `DELETE /score/:id` for deleting a ScoreEntry. Before deletion, the system MUST check whether any Unit records (reviews/remarks) reference the ScoreEntry via `scoreEntryId`. If linked units exist, the system SHALL reject the deletion and return the list of blocking unit IDs. Admin users SHALL bypass this check -- the system SHALL delete linked units in the same transaction before deleting the ScoreEntry.

#### Scenario: Delete a score with no linked reviews

- GIVEN a ScoreEntry "score-1" with no Unit records referencing it
- WHEN the owner calls `DELETE /score/score-1`
- THEN the ScoreEntry SHALL be deleted
- AND the ScoreAggregate SHALL be updated (delta subtracted)

#### Scenario: Reject deletion when reviews exist (non-admin)

- GIVEN a ScoreEntry "score-1" referenced by Unit "review-1" (kindKey = "review")
- WHEN a non-admin user calls `DELETE /score/score-1`
- THEN the system SHALL reject with a 409 Conflict
- AND the response SHALL include the list of blocking unit IDs: `["review-1"]`

#### Scenario: Admin bypasses review check

- GIVEN a ScoreEntry "score-1" referenced by Units "review-1" and "remark-1"
- WHEN an admin calls `DELETE /score/score-1`
- THEN the system SHALL delete "review-1" and "remark-1" first
- AND then delete "score-1"
- AND update the ScoreAggregate
- AND the entire operation SHALL execute in a single transaction

### Requirement: Score aggregate query APIs

The system SHALL expose read endpoints for score aggregates. `GET /score/unit/:unitId` SHALL return all realm aggregates for a unit. `GET /score/unit/:unitId/:realm` SHALL return a single realm aggregate. `GET /score/user/:userId/:unitId` SHALL return a user's ScoreEntry records for a unit across all realms. No authentication is required for read endpoints.

#### Scenario: Get all realm aggregates for a book

- GIVEN a book "book-1" with ScoreAggregates in realms "realm-default" and "realm-story"
- WHEN a client calls `GET /score/unit/book-1`
- THEN the system SHALL return both aggregates with `totalScore`, `totalCount`, `distribution`, and `fields`

#### Scenario: Get single realm aggregate

- GIVEN a book "book-1" with a ScoreAggregate in "realm-default"
- WHEN a client calls `GET /score/unit/book-1/realm-default`
- THEN the system SHALL return the aggregate for that realm only

#### Scenario: Get a user's scores for a book

- GIVEN "user-1" has ScoreEntry records for "book-1" in realms "realm-default" and "realm-story"
- WHEN a client calls `GET /score/user/user-1/book-1`
- THEN the system SHALL return both ScoreEntry records

#### Scenario: Return empty result for unscored unit

- GIVEN no ScoreAggregate exists for "book-1" in any realm
- WHEN a client calls `GET /score/unit/book-1`
- THEN the system SHALL return an empty array

### Requirement: Default realm for unscoped scores

Scores for the common case (no specific realm context) SHALL use the default realm entity's `unitId` as the `realm` value. The `realm` column SHALL never be NULL. All queries for default-realm scores SHALL use this concrete realm ID.

#### Scenario: Score without explicit realm uses default

- WHEN a user submits a score without specifying a realm
- THEN the system SHALL use the default realm's unitId as the `realm` value

#### Scenario: Default realm has no extended fields

- GIVEN the default realm has no ScoreRealmField entries
- WHEN a user submits a score with `fields = { "pacing": 7 }` for the default realm
- THEN the system SHALL reject the request because "pacing" is not a registered field for the default realm

### Requirement: Admin aggregate recalculation

The system SHALL expose an admin-only endpoint to recalculate a ScoreAggregate from its source ScoreEntry records. This serves as a safety net against delta drift. The recalculation SHALL recompute `totalScore`, `totalCount`, `distribution`, and `fields` by scanning all ScoreEntry records for the given `(unitId, realm)`.

#### Scenario: Recalculate a drifted aggregate

- GIVEN a ScoreAggregate with `totalScore = 100` but the actual sum of ScoreEntry values is `98`
- WHEN an admin triggers recalculation for that `(unitId, realm)`
- THEN the ScoreAggregate SHALL be updated to `totalScore = 98` with correct `totalCount`, `distribution`, and `fields`

## ADDED Requirements

### Requirement: Tag is a Unit with type TAG and language-neutral identity

A tag SHALL be represented as a Unit record with `type = TAG` and `isLanguageNeutral = true`. Tags are universal entities whose human-readable labels are stored in UnitTranslation records. The tag entity itself carries no inherent language; translations provide labels in any number of languages.

#### Scenario: Create a new tag

- GIVEN an authenticated user
- WHEN the system creates a tag for the concept "fantasy"
- THEN a Unit record SHALL be created with `type = TAG` and `isLanguageNeutral = true`
- AND a UnitTranslation record SHALL be created linking the tag Unit to the label "fantasy" in the specified language

#### Scenario: Tag has labels in multiple languages

- GIVEN a tag Unit with id "tag-1"
- WHEN UnitTranslation records exist for "tag-1" with label "fantasy" (en), "fantaisie" (fr), and "ファンタジー" (ja)
- THEN querying the tag in any of those languages SHALL return the corresponding label
- AND the underlying tag entity SHALL remain a single Unit record regardless of how many translations exist

### Requirement: Tags are flat with no hierarchy, categories, or namespaces

Tags SHALL NOT have parent-child relationships, category groupings, or namespace prefixes at the schema level. Every tag is a peer-level entity. Organizational structure is achieved through the realm system, not through tag hierarchy.

#### Scenario: Reject hierarchical tag relationships

- GIVEN a tag Unit "genre:fantasy"
- WHEN a caller attempts to establish a parent-child relationship between two tag Units
- THEN the system SHALL NOT provide any mechanism to create such a relationship
- AND no schema field or relation SHALL exist for tag hierarchy

#### Scenario: No category or namespace field on tag

- GIVEN the Unit model in the Prisma schema
- WHEN inspecting a Unit with `type = TAG`
- THEN there SHALL be no `category`, `namespace`, or `parentTagId` field on the Unit or any tag-specific table

### Requirement: UnitTag is a scored junction determining tag prominence

UnitTag SHALL be a junction table with a composite primary key of `(unitId, tagUnitId)`. It SHALL contain a `score` field (default 0), a `voteCount` field (default 0), a `pinned` boolean field (default `false`), a `position` nullable string field, and timestamp fields (`createdAt`, `updatedAt`). The `UnitTagDTO` SHALL contain `unitId`, `tagUnitId`, `score`, `voteCount`, `pinned`, `position`, `createdAt`, and `updatedAt`. The `tagLabel` field is **removed** — tag display labels are resolved via the batch translation query (`tag-batch-translation` capability), not embedded in the scored junction DTO. Display prominence is governed by pin/position first, score second (see "UnitTag display ordering pins-first then by score descending").

#### Scenario: Create a UnitTag association

- **GIVEN** a Unit "unit-1" and a tag Unit "tag-1"
- **WHEN** a UnitTag record is created for `(unitId = "unit-1", tagUnitId = "tag-1")` via the standard creation flow
- **THEN** the record SHALL be persisted with `score = 1`, `voteCount = 1`, `pinned = false`, `position = null`, and auto-generated timestamps

#### Scenario: UnitTagDTO contains pinned and position but no label field

- **GIVEN** the `UnitTagDTO` type definition
- **WHEN** a consumer reads the type
- **THEN** it SHALL contain `unitId`, `tagUnitId`, `score`, `voteCount`, `pinned`, `position`, `createdAt`, `updatedAt`
- **AND** it SHALL NOT contain `tagLabel` or any display text field

#### Scenario: Tag display requires a separate translation query

- **GIVEN** a list of `UnitTagDTO` records for a book
- **WHEN** the frontend needs to display tag labels
- **THEN** it SHALL extract `tagUnitId` values from the DTOs
- **AND** it SHALL call the batch translation query with those IDs and the desired language

### Requirement: UnitTag has pinned and position fields for editorial ordering

UnitTag SHALL contain a `pinned: boolean` field (default `false`) and a `position: string?` field (nullable) used for editorial pinning independent of community score. When `pinned = true`, `position` SHALL be a fractional-indexing key (lexicographically sortable string) determining the row's order among other pinned rows for the same unit. When `pinned = false`, `position` SHALL be `null` and the row participates in score-based ordering.

#### Scenario: New UnitTag has pinned=false and position=null

- **WHEN** a UnitTag row is newly created
- **THEN** the row SHALL have `pinned = false` and `position = null`

#### Scenario: Pinning a row sets pinned and position together

- **GIVEN** UnitTag `(unit-1, tag-1)` with `pinned = false, position = null`
- **WHEN** an authorized actor pins the row with position `"M"`
- **THEN** the row SHALL have `pinned = true, position = "M"`

#### Scenario: Unpinning a row clears position

- **GIVEN** UnitTag `(unit-1, tag-1)` with `pinned = true, position = "M"`
- **WHEN** an authorized actor unpins the row
- **THEN** the row SHALL have `pinned = false, position = null`

### Requirement: UnitTag display ordering pins-first then by score descending

When retrieving the UnitTag list for a unit, the system SHALL emit rows in two sections in order: first all rows where `pinned = true` sorted by `position` ascending (lexicographic string compare), then all rows where `pinned = false` sorted by `score` descending. Ties within either section SHALL maintain a stable order.

#### Scenario: Pinned tags lead the list regardless of score

- **GIVEN** UnitTag rows for "unit-1": `tag-A (pinned=true, position="G")`, `tag-B (pinned=true, position="M")`, `tag-C (pinned=false, score=999)`, `tag-D (pinned=false, score=10)`
- **WHEN** a client requests the tag list for "unit-1"
- **THEN** the order SHALL be: `tag-A`, `tag-B`, `tag-C`, `tag-D`

#### Scenario: Inserting between two pinned rows uses fractional indexing

- **GIVEN** pinned rows with positions `"G"` and `"M"`
- **WHEN** an authorized actor pins a new row between them
- **THEN** the new row's `position` SHALL be a key that sorts between `"G"` and `"M"` lexicographically (e.g., `"J"`)
- **AND** no existing pinned row's `position` SHALL be modified

### Requirement: TagVote records individual user votes on tag accuracy

TagVote SHALL have a composite primary key of `(userId, unitId, tagUnitId)`. It SHALL contain a `value` field constrained to +1 or -1 and a `createdAt` timestamp. Each user MAY cast exactly one vote per tag-unit pair indicating whether they agree (+1) or disagree (-1) that the tag applies to the unit.

#### Scenario: User upvotes a tag on a unit

- GIVEN user "user-1", Unit "unit-1", and tag "tag-1" with a UnitTag record
- WHEN "user-1" votes +1 on tag "tag-1" for "unit-1"
- THEN a TagVote record SHALL be created with `(userId = "user-1", unitId = "unit-1", tagUnitId = "tag-1", value = 1)`

#### Scenario: User downvotes a tag on a unit

- GIVEN user "user-2", Unit "unit-1", and tag "tag-1" with a UnitTag record
- WHEN "user-2" votes -1 on tag "tag-1" for "unit-1"
- THEN a TagVote record SHALL be created with `value = -1`

#### Scenario: User cannot vote twice on the same tag-unit pair

- GIVEN user "user-1" has already voted +1 on tag "tag-1" for "unit-1"
- WHEN "user-1" attempts to cast another vote on the same tag-unit pair
- THEN the system SHALL update the existing TagVote record rather than creating a duplicate
- AND the composite primary key constraint SHALL enforce uniqueness

### Requirement: Score recalculation aggregates votes only

The `score` on a UnitTag record SHALL equal the sum of all `TagVote.value` entries for that `(unitId, tagUnitId)` pair. The `voteCount` SHALL equal the total number of TagVote records for that pair. RealmTagUnit rows SHALL NOT contribute directly to UnitTag.score; any contribution from a realm tagging action arrives via the client-side double-write path that issues a separate `POST /unit-tags`, which inserts an ordinary TagVote on behalf of the calling user.

#### Scenario: Score reflects aggregate votes only

- **GIVEN** UnitTag `(unit-1, tag-1)` with TagVote records: user-A (+1), user-B (+1), user-C (-1)
- **WHEN** the score is recalculated
- **THEN** the `score` SHALL be `+1`
- **AND** `voteCount` SHALL be `3`

#### Scenario: RealmTagUnit existence does not affect UnitTag score

- **GIVEN** UnitTag `(unit-1, tag-1)` with `score = 5` derived from 5 TagVote rows
- **AND** two RealmTagUnit rows linking realms to `(unit-1, tag-1)` exist with various RealmTagVote counts
- **WHEN** the UnitTag score is recalculated
- **THEN** the score SHALL remain `5`
- **AND** the recalculation SHALL ignore RealmTagUnit and RealmTagVote rows

### Requirement: Tags with highest scores appear first within the unpinned section

When retrieving the tags for a unit, the system SHALL place all `pinned = true` rows first ordered by `position` ascending, then all `pinned = false` rows ordered by `score` descending. Tags with negative scores within the unpinned section SHALL still be returned (subject to the visibility-threshold rule) and SHALL appear last within that section.

#### Scenario: Unpinned section ordered by score

- **GIVEN** Unit "unit-1" with UnitTag rows (all unpinned): "action" (score 80), "comedy" (score 150), "romance" (score -2), "drama" (score 30)
- **WHEN** a client requests the tag list for "unit-1"
- **THEN** the order within the unpinned section SHALL be: "comedy", "action", "drama", "romance"

#### Scenario: Negative score tags appear last within the unpinned section

- **GIVEN** Unit "unit-1" with all rows unpinned: "horror" (score -5), "thriller" (score 10)
- **WHEN** a client requests the tag list for "unit-1"
- **THEN** "thriller" SHALL appear before "horror"

### Requirement: Any user can propose a tag on a unit

Any authenticated user SHALL be able to propose a tag on a unit by sending a `POST /unit-tags` request. The first proposer's request creates the UnitTag row and writes their `+1` TagVote (resulting in `score = 1`); subsequent proposers' requests append their `+1` TagVote and increment the row by 1. Repeated calls by the same user are idempotent.

#### Scenario: User proposes a new tag on a unit

- **GIVEN** an authenticated user "user-1" and Unit "unit-1"
- **WHEN** "user-1" proposes tag "tag-new" on "unit-1"
- **THEN** a UnitTag row SHALL be created with `(unit-1, tag-new)`, `score = 1`, `voteCount = 1`, `pinned = false`, `position = null`
- **AND** a TagVote row SHALL be created for "user-1" with value `+1`

#### Scenario: Proposed tag gains prominence through votes

- **GIVEN** UnitTag `(unit-1, tag-new)` with `score = 1` and one TagVote
- **WHEN** 20 other users each cast `+1` TagVote on `(unit-1, tag-new)`
- **THEN** the score SHALL be `21` and voteCount SHALL be `21`
- **AND** the tag SHALL move higher in the unpinned section's score-ordered display

### Requirement: Creating a UnitTag row writes the creator's first +1 TagVote

When a `POST /unit-tags` request creates a UnitTag row that did not previously exist, the system MUST atomically insert a `TagVote` row of `(userId = caller, unitId, tagUnitId, value = +1)`. The newly created UnitTag row SHALL therefore have `score = 1` and `voteCount = 1`.

#### Scenario: First-time create initializes vote and score

- **GIVEN** no UnitTag exists for `(unit-1, tag-1)`
- **AND** caller "user-1" is authenticated
- **WHEN** "user-1" sends `POST /unit-tags` for `(unit-1, tag-1)`
- **THEN** a UnitTag row SHALL be created with `score = 1`, `voteCount = 1`, `pinned = false`, `position = null`
- **AND** a TagVote row SHALL be created with `(user-1, unit-1, tag-1, +1)`

### Requirement: A subsequent UnitTag create by another user behaves as a +1 vote on the existing row

When a `POST /unit-tags` request targets `(unitId, tagUnitId)` for which a UnitTag already exists, and the caller has not previously cast a TagVote on that pair, the system MUST insert a `TagVote` row of value `+1` from the caller and increment the existing UnitTag's `score` and `voteCount` by 1.

#### Scenario: Second user proposes the same tag

- **GIVEN** UnitTag `(unit-1, tag-1)` exists with `score = 1`, `voteCount = 1`
- **AND** caller "user-2" is authenticated and has no prior TagVote on this pair
- **WHEN** "user-2" sends `POST /unit-tags` for `(unit-1, tag-1)`
- **THEN** a TagVote row SHALL be created with `(user-2, unit-1, tag-1, +1)`
- **AND** the UnitTag row SHALL be updated to `score = 2`, `voteCount = 2`
- **AND** no duplicate UnitTag SHALL be created

### Requirement: Repeated UnitTag create by the same user is idempotent

When a `POST /unit-tags` request targets a pair on which the caller already holds a TagVote, the system MUST treat the request as a no-op for vote insertion: it SHALL NOT create a duplicate vote and SHALL NOT increment `score` or `voteCount`. The endpoint SHALL return success with the current UnitTag state.

#### Scenario: User retries a create they already performed

- **GIVEN** "user-1" previously created UnitTag `(unit-1, tag-1)`, producing a TagVote row
- **WHEN** "user-1" sends `POST /unit-tags` for the same pair again
- **THEN** the system SHALL return success
- **AND** no additional TagVote row SHALL be inserted
- **AND** UnitTag `score` and `voteCount` SHALL be unchanged

### Requirement: Pin and delete authority for UnitTag is restricted to admin or unit owner

Setting `pinned`, mutating `position`, unpinning, and deleting a UnitTag row SHALL be restricted to:
- platform administrators, OR
- the user whose `userId` is referenced by `Unit.userId` of the row's `unitId`.

If `Unit.userId IS NULL`, only platform administrators SHALL hold pin and delete authority for that row. Realm moderators SHALL NOT hold pin or delete authority on UnitTag.

#### Scenario: Unit owner pins a tag on their unit

- **GIVEN** Unit "unit-1" has `userId = "user-owner"`
- **AND** UnitTag `(unit-1, tag-1)` exists with `pinned = false`
- **WHEN** "user-owner" requests to pin the row at position `"M"`
- **THEN** the row SHALL be updated to `pinned = true, position = "M"`

#### Scenario: Platform admin deletes a UnitTag

- **GIVEN** UnitTag `(unit-1, tag-1)` exists
- **WHEN** a platform administrator sends `DELETE /unit-tags/unit-1/tag-1`
- **THEN** the row SHALL be removed
- **AND** all TagVote rows for `(unit-1, tag-1)` SHALL also be removed

#### Scenario: Non-owner non-admin user is denied

- **GIVEN** Unit "unit-1" has `userId = "user-owner"`
- **AND** caller "user-x" is neither admin nor "user-owner"
- **WHEN** "user-x" attempts to pin or delete UnitTag `(unit-1, tag-1)`
- **THEN** the system SHALL deny the operation with an authorization error

#### Scenario: Orphan unit allows only admin authority

- **GIVEN** Unit "unit-orphan" has `userId = NULL`
- **WHEN** any non-admin user attempts to pin or delete UnitTag rows on "unit-orphan"
- **THEN** the system SHALL deny the operation
- **AND** only a platform administrator SHALL be able to perform the operation

### Requirement: UnitTag deletion is unconditional for authorized actors

Deletion of a UnitTag row by an authorized actor (platform admin or `Unit.userId`) SHALL succeed regardless of the row's current `score`. There SHALL be no minimum-score gate or community-consensus precondition for deletion.

#### Scenario: Delete a high-score row

- **GIVEN** UnitTag `(unit-1, tag-1)` with `score = 250`
- **WHEN** an authorized actor sends a delete request
- **THEN** the row SHALL be removed

#### Scenario: Delete a low-score row

- **GIVEN** UnitTag `(unit-1, tag-1)` with `score = -5`
- **WHEN** an authorized actor sends a delete request
- **THEN** the row SHALL be removed

### Requirement: UnitTag rows with score at or below -100 are hidden from regular users

When a list/search endpoint returns UnitTag rows for a regular (non-admin, non-unit-owner) caller, rows whose `score ≤ -100` SHALL be excluded. When the same endpoint is called by a platform administrator or by the unit's owner, those rows SHALL be included with a flag (e.g. `belowVisibilityThreshold: true`) marking their suppressed status. Authorized callers MAY render those rows distinctly.

#### Scenario: Regular user does not see suppressed rows

- **GIVEN** UnitTag `(unit-1, tag-1)` has `score = -120`
- **WHEN** a regular user requests the tag list for "unit-1"
- **THEN** the response SHALL NOT include `(unit-1, tag-1)`

#### Scenario: Admin sees suppressed rows with flag

- **GIVEN** UnitTag `(unit-1, tag-1)` has `score = -120`
- **WHEN** a platform administrator requests the tag list for "unit-1"
- **THEN** the response SHALL include `(unit-1, tag-1)` with `belowVisibilityThreshold = true`

#### Scenario: Unit owner sees suppressed rows on their own unit

- **GIVEN** Unit "unit-1" has `userId = "user-owner"`
- **AND** UnitTag `(unit-1, tag-1)` has `score = -120`
- **WHEN** "user-owner" requests the tag list for "unit-1"
- **THEN** the response SHALL include `(unit-1, tag-1)` with `belowVisibilityThreshold = true`

### Requirement: Admin discovery endpoint for low-score UnitTag rows

The system SHALL expose an admin-only endpoint that lists UnitTag rows with `score` at or below a configurable threshold (default `-100`), to support periodic moderation sweeps. The endpoint SHALL accept a `threshold` query parameter and SHALL return rows ordered by `score` ascending.

#### Scenario: Admin lists low-score rows

- **GIVEN** several UnitTag rows have `score ≤ -100`
- **WHEN** a platform administrator calls the admin discovery endpoint with `threshold = -100`
- **THEN** the response SHALL include those rows ordered by `score` ascending

#### Scenario: Non-admin is denied

- **WHEN** a non-admin caller invokes the admin discovery endpoint
- **THEN** the system SHALL deny the request with an authorization error

### Requirement: Tag label is language-dependent via UnitTranslation

The human-readable label for a tag SHALL be stored exclusively in UnitTranslation records associated with the tag's Unit. The tag Unit itself has no `name` or `label` column. Clients resolve the display label by querying UnitTranslation for the user's preferred language, falling back to a default language if no translation exists.

#### Scenario: Resolve tag label in user's language

- GIVEN tag Unit "tag-1" with UnitTranslation entries: "Fantasy" (en), "Fantasia" (it)
- WHEN a user with preferred language "it" views the tag
- THEN the system SHALL display "Fantasia"

#### Scenario: Fall back to default language when translation is missing

- GIVEN tag Unit "tag-1" with UnitTranslation entries: "Fantasy" (en) only
- WHEN a user with preferred language "ko" views the tag
- THEN the system SHALL fall back and display "Fantasy" (en)

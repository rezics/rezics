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

UnitTag SHALL be a junction table with a composite primary key of `(unitId, tagUnitId)`. It SHALL contain a `score` field (default 0), a `voteCount` field (default 0), and timestamp fields (`createdAt`, `updatedAt`). The `score` field determines the display prominence of the tag on a unit -- tags with higher scores appear first.

#### Scenario: Create a UnitTag association

- GIVEN a Unit "unit-1" and a tag Unit "tag-1"
- WHEN a UnitTag record is created for `(unitId = "unit-1", tagUnitId = "tag-1")`
- THEN the record SHALL be persisted with `score = 0`, `voteCount = 0`, and auto-generated timestamps

#### Scenario: Display order follows score descending

- GIVEN Unit "unit-1" with UnitTag entries: tag-A (score 42), tag-B (score 105), tag-C (score 7)
- WHEN retrieving the tag list for "unit-1"
- THEN the tags SHALL be returned in order: tag-B, tag-A, tag-C (descending by score)

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

### Requirement: Score recalculation aggregates votes and realm contributions

The `score` on a UnitTag record SHALL be recalculated as the sum of all TagVote `value` entries for that `(unitId, tagUnitId)` pair plus any score contributions from realm tag applications (RealmTagUnit). The `voteCount` SHALL reflect the total number of TagVote records for that pair.

#### Scenario: Score reflects aggregate votes

- GIVEN UnitTag `(unit-1, tag-1)` with TagVote records: user-A (+1), user-B (+1), user-C (-1)
- WHEN the score is recalculated
- THEN the `score` SHALL be updated to include the vote sum of +1 (from votes alone, before realm contributions)
- AND `voteCount` SHALL be 3

#### Scenario: Score includes realm contributions

- GIVEN UnitTag `(unit-1, tag-1)` with a vote sum of +3
- AND two RealmTagUnit entries exist linking realm tags to `(unit-1, tag-1)`
- WHEN the score is recalculated
- THEN the `score` SHALL incorporate contributions from both votes and realm tag applications

### Requirement: Tags with highest scores appear first on a unit's tag list

When retrieving the tags for a unit, the system SHALL order UnitTag records by `score` in descending order. Tags with negative scores MAY still be returned but SHALL appear last.

#### Scenario: Tag list ordered by score

- GIVEN Unit "unit-1" with tags: "action" (score 80), "comedy" (score 150), "romance" (score -2), "drama" (score 30)
- WHEN a client requests the tag list for "unit-1"
- THEN the response SHALL list tags in order: "comedy", "action", "drama", "romance"

#### Scenario: Negative score tags appear last

- GIVEN Unit "unit-1" with tags: "horror" (score -5), "thriller" (score 10)
- WHEN a client requests the tag list for "unit-1"
- THEN "thriller" SHALL appear before "horror"

### Requirement: Official tag boosting via higher score values

Rezics-curated or official tags SHALL be given authority through manually set higher score values on their UnitTag records. There SHALL be no special `isOfficial` schema field or separate boosting mechanism -- the score itself IS the authority signal.

#### Scenario: Curated tag has elevated score

- GIVEN an administrator applies tag "sci-fi" to Unit "unit-1"
- WHEN the UnitTag record is created or updated
- THEN the `score` SHALL be set to a value significantly higher than the typical user-vote range (e.g., 1000)
- AND no separate `isOfficial` or `isCurated` field SHALL exist on UnitTag

#### Scenario: Curated tag remains prominent despite downvotes

- GIVEN UnitTag `(unit-1, sci-fi)` with a manually set score of 1000
- AND 10 users each vote -1 on the tag
- WHEN the score is recalculated
- THEN the resulting score (990) SHALL still place the tag above most user-voted tags

### Requirement: Any user can propose a tag on a unit

Any authenticated user SHALL be able to propose a tag on a unit by creating a UnitTag record. Proposed tags start with an initial low score, relying on community votes and realm endorsements to gain or lose prominence.

#### Scenario: User proposes a new tag on a unit

- GIVEN an authenticated user "user-1" and Unit "unit-1"
- WHEN "user-1" proposes tag "tag-new" on "unit-1"
- THEN a UnitTag record SHALL be created with `(unitId = "unit-1", tagUnitId = "tag-new")` and an initial low `score`
- AND the tag SHALL appear in the unit's tag list at a position determined by its score

#### Scenario: Proposed tag gains prominence through votes

- GIVEN UnitTag `(unit-1, tag-new)` with initial low score
- WHEN 20 users each vote +1 on the tag
- THEN the recalculated score SHALL reflect the accumulated votes
- AND the tag SHALL move higher in the display order

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

## MODIFIED Requirements

### Requirement: UnitTag is a scored junction determining tag prominence

UnitTag SHALL be a junction table with a composite primary key of `(unitId, tagUnitId)`. It SHALL contain a `score` field (default 0), a `voteCount` field (default 0), and timestamp fields (`createdAt`, `updatedAt`). The `score` field determines the display prominence of the tag on a unit — tags with higher scores appear first. The `UnitTagDTO` SHALL contain `unitId`, `tagUnitId`, `score`, `voteCount`, `createdAt`, and `updatedAt`. The `tagLabel` field is **removed** — tag display labels are resolved via the batch translation query (`tag-batch-translation` capability), not embedded in the scored junction DTO.

#### Scenario: UnitTagDTO contains no label field

- **GIVEN** the `UnitTagDTO` type definition
- **WHEN** a consumer reads the type
- **THEN** it SHALL contain `unitId`, `tagUnitId`, `score`, `voteCount`, `createdAt`, `updatedAt`
- **AND** it SHALL NOT contain `tagLabel` or any display text field

#### Scenario: Tag display requires a separate translation query

- **GIVEN** a list of `UnitTagDTO` records for a book
- **WHEN** the frontend needs to display tag labels
- **THEN** it SHALL extract `tagUnitId` values from the DTOs
- **AND** it SHALL call the batch translation query with those IDs and the desired language

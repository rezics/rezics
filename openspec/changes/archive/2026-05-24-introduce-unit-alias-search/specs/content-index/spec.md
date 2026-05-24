## ADDED Requirements

### Requirement: Content index includes searchable Unit aliases
The content index SHALL include alias-derived searchable text for indexed Units. Alias-derived searchable fields SHALL be separate from translation-derived fields such as `titles`, `subtitles`, `summaries`, and `descriptions`.

#### Scenario: Content document includes accepted alias values
- **GIVEN** an indexed BOOK Unit has alias values `"3 Body Problem"` and `"TBF"`
- **WHEN** the Unit is synced to the content index
- **THEN** the document SHALL contain those values in alias-derived searchable fields
- **AND** the document's `titles` array SHALL continue to contain only UnitTranslation title values

### Requirement: Content index includes aliases by score threshold or pin
When building alias-derived searchable fields for content documents, the system SHALL include aliases where `score > visibilityThreshold OR pinned = true`. It SHALL exclude unpinned aliases at or below the visibility threshold.

#### Scenario: Pinned alias below threshold is indexed
- **GIVEN** an alias has `score = -120` and `pinned = true`
- **WHEN** the owning Unit is synced to the content index
- **THEN** the alias value SHALL be indexed as searchable text

#### Scenario: Unpinned alias below threshold is not indexed
- **GIVEN** an alias has `score = -120` and `pinned = false`
- **WHEN** the owning Unit is synced to the content index
- **THEN** the alias value SHALL NOT be indexed as searchable text

### Requirement: Content index includes pinned UnitTags below threshold
When building tag-derived searchable fields for content documents, the system SHALL include a UnitTag row if `score > visibilityThreshold OR pinned = true`. Pinned UnitTags SHALL preserve their raw score in `tagScores` and SHALL NOT receive an indexed ranking boost solely because they are pinned.

#### Scenario: Pinned low-score UnitTag remains filterable
- **GIVEN** `UnitTag(unit-1, tag-1)` has `score = -120`
- **AND** `pinned = true`
- **WHEN** `unit-1` is synced to the content index
- **THEN** `tag-1` SHALL be included in the document's `tagIds`
- **AND** `tagScores["tag-1"]` SHALL equal `-120`

#### Scenario: Unpinned low-score UnitTag is excluded from search fields
- **GIVEN** `UnitTag(unit-1, tag-2)` has `score = -120`
- **AND** `pinned = false`
- **WHEN** `unit-1` is synced to the content index
- **THEN** `tag-2` SHALL NOT be included in the document's `tagIds`

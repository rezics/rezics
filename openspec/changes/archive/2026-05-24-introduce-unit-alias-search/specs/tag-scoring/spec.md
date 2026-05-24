## ADDED Requirements

### Requirement: Pinned UnitTags remain searchable below score threshold
When building searchable tag fields or tag filters for search indexes, the system SHALL include a UnitTag if `score > visibilityThreshold OR pinned = true`. Pinned UnitTags below the score threshold SHALL remain searchable because owner/admin classification intent is respected for inclusion.

Pinned SHALL NOT modify `UnitTag.score`, `UnitTag.voteCount`, search ranking score, or score-based ordering.

#### Scenario: Pinned low-score tag remains searchable
- **GIVEN** `UnitTag(unit-1, tag-1)` has `score = -120`
- **AND** `pinned = true`
- **WHEN** the search index is built or patched for `unit-1`
- **THEN** `tag-1` SHALL be included in searchable/filterable tag fields
- **AND** the indexed raw score for `tag-1` SHALL remain `-120`

#### Scenario: Pinned does not boost score ranking
- **GIVEN** `UnitTag(unit-1, tag-1)` is pinned with `score = 1`
- **AND** `UnitTag(unit-2, tag-1)` is unpinned with `score = 50`
- **WHEN** results are explicitly ordered by tag score for `tag-1`
- **THEN** `unit-2` SHALL rank ahead of `unit-1`

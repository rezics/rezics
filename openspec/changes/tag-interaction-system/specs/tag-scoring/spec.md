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

## ADDED Requirements

### Requirement: Series remains an explicit follow-up capability

This change SHALL NOT implement series library content. It SHALL preserve series
as an explicit follow-up decision and SHALL avoid adding schema, API, or UI
behavior that prevents either documented candidate path.

#### Scenario: Game media change does not create series type

- **WHEN** this change is implemented
- **THEN** it SHALL NOT add `UnitType.SERIES`
- **AND** it SHALL NOT require series-specific APIs for GAME or MEDIA detail pages

### Requirement: Shelf-based series path is documented

One candidate path for series SHALL use `Unit(type = SHELF)` with
`Shelf.kindKey = "series"` as the ordered collection substrate. A series shelf
would use `UnitTranslation` for display text and `ShelfUnit` for ordered
members. When it contains releases that belong to work domains, existing
`UnitWork(role = SHELF)` reconciliation would make the series visible in those
work domains without an additional series relation.

#### Scenario: Series shelf enters work domain through contained release

- **GIVEN** a future series shelf contains release `release-a`
- **AND** `UnitWork(release-a, work-x, role = RELEASE)` exists
- **WHEN** shelf work-domain membership is reconciled
- **THEN** the shelf would receive `UnitWork(seriesShelf, work-x, role = SHELF)`
- **AND** no dedicated series-to-work relation would be required

### Requirement: Series Unit path is documented

Another candidate path for series SHALL be a future first-class Series Unit or
equivalent library Unit whose ordered members are stored through
`contentStructure` and `contentUnitId`. This path would give series a dedicated
content identity but requires a new Unit type or equivalent type-extension
decision.

#### Scenario: Series Unit stores members through content structure

- **WHEN** a future Series Unit represents an ordered movie series
- **THEN** its entries could be stored as content-structure nodes
- **AND** each node would point at a member Unit through `contentUnitId` or an equivalent member reference

### Requirement: Current change does not choose the series path

The GAME/MEDIA backend SHALL not depend on whether series is later implemented
with Shelf or with a dedicated Series Unit. GAME/MEDIA services SHALL model
release, work, content structure, platform, age rating, and system requirement
behavior independently from series.

#### Scenario: Game backend works before series exists

- **WHEN** GAME backend implementation is complete
- **THEN** game releases, DLC structure, platforms, ratings, and system requirements SHALL work without any series model
- **AND** adding series later SHALL not require changing those core semantics

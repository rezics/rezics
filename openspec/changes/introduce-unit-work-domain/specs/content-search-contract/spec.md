## ADDED Requirements

### Requirement: Content Search Documents Carry Work-Domain Fields

Content search documents for release-aware Units SHALL include work-domain
projection fields: `workUnitId`, `searchGroupId`, `ownTagIds`, `workTagIds`,
`allTagIds`, `ownTagLabels`, `workTagLabels`, `allTagLabels`, `releaseRank`,
`displayPolicy`, and `primaryForLanguages`.

`allTagIds` SHALL contain the union of release-local tag ids and inherited
work-level tag ids. `searchGroupId` SHALL equal `workUnitId` when present and
SHALL fall back to the Unit's own id otherwise.

#### Scenario: Release document includes inherited work tags

- **GIVEN** `UnitWork(release-a, work-x)` exists
- **AND** `UnitTag(work-x, tag-fantasy)` exists
- **WHEN** the content search document for `release-a` is built
- **THEN** `workTagIds` SHALL include `tag-fantasy`
- **AND** `allTagIds` SHALL include `tag-fantasy`
- **AND** `searchGroupId` SHALL equal `work-x`

#### Scenario: Standalone document groups by itself

- **GIVEN** Unit `unit-y` has no active `UnitWork` membership
- **WHEN** its content search document is built
- **THEN** `workUnitId` SHALL be null
- **AND** `searchGroupId` SHALL equal `unit-y`

### Requirement: Search Options Support Grouped Release Presentation

The content search contract SHALL expose options that allow callers to request
the default grouped release presentation or expanded release rows. Grouped
presentation SHALL be the default for ordinary content search.

#### Scenario: Default grouped search

- **WHEN** a caller sends a content search request without an explicit release expansion option
- **THEN** the response SHALL be allowed to collapse multiple releases with the same `searchGroupId`
- **AND** each grouped result SHALL expose enough metadata for the frontend to show collapsed alternatives

#### Scenario: Expanded release search

- **WHEN** a caller explicitly requests expanded release results
- **THEN** the response SHALL be allowed to return multiple release documents for the same `searchGroupId`
- **AND** each result SHALL still include its `workUnitId` and `searchGroupId`

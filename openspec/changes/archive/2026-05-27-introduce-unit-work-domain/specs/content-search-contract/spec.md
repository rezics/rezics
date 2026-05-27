## ADDED Requirements

### Requirement: Content Search Documents Carry Work-Domain Fields

Content search documents for release-aware Units SHALL include work-domain
projection fields: `workUnitId`, `searchGroupId`, `ownTagIds`, `workTagIds`,
`allTagIds`, `ownTagLabels`, `workTagLabels`, `allTagLabels`, `position`, and
`displayPolicy`.

Content search documents for non-release Units that participate in work domains
MAY expose generic work-domain membership fields derived from `UnitWork`, such
as work ids and membership roles, analogous to existing Unit-based tag and realm
fields. These fields SHALL be derived from `UnitWork`, not from shelf/post
special-case projection columns.

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

### Requirement: Search Metadata Uses Canonical Work After Merge

Content search documents for release-aware Units SHALL use merge-resolved
canonical work ids for `workUnitId` and `searchGroupId` after work merge repair
has completed. During async merge repair, search MAY be temporarily stale, but
repair jobs SHALL converge documents to the target canonical work.

#### Scenario: Merged work groups under target

- **GIVEN** source work `work-old` has been merged into target work `work-new`
- **AND** release `release-a` was formerly grouped under `work-old`
- **WHEN** the content search document for `release-a` is rebuilt
- **THEN** `workUnitId` SHALL equal `work-new`
- **AND** `searchGroupId` SHALL equal `work-new`

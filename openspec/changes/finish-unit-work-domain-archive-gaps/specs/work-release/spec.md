## MODIFIED Requirements

### Requirement: Work/Release Semantics Are Release-First

Public navigation SHALL prefer visible release Units for release-aware domains.
Search result rendering, shelf item rendering, reading flows, and home/result
card destinations SHALL follow the same rule. Hidden work Units SHALL NOT be
passed as ordinary public book route params unless the route is an admin/editor
work-maintenance surface.

#### Scenario: Public card does not route to hidden work

- **GIVEN** a search or home card has grouped work metadata for `work-x`
- **AND** `work-x` is a hidden work Unit
- **WHEN** the user activates the card
- **THEN** the app SHALL navigate to a visible release Unit for that work
- **AND** it SHALL NOT navigate to an ordinary public `/book/...` route using
  `work-x`

### Requirement: UnitWork Supersedes Direct Work-Link Semantics

`UnitWork` SHALL be the canonical read path for release/work grouping. Legacy
`Unit.workUnitId` MAY remain synchronized during migration, but list/search/API
paths that expose work-domain semantics SHALL read canonical membership through
`UnitWork`.

#### Scenario: Unit list work filter reads UnitWork

- **WHEN** a caller filters release-aware Units by work
- **THEN** the service SHALL filter by `UnitWork(workUnitId, role = RELEASE)`
- **AND** direct `Unit.workUnitId` filtering SHALL be limited to documented
  migration compatibility paths

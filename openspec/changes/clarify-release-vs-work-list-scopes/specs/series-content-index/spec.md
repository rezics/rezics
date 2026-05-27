## ADDED Requirements

### Requirement: Series Filters Preserve Release And Work-Domain Names

Series list filters SHALL preserve separate meanings for release membership and
work-domain association. `containsReleaseUnitId` SHALL mean direct counted
membership of a visible release in the series content index. `relatedWorkUnitId`
SHALL mean work-domain association through `UnitWork(role = SERIES)`.

#### Scenario: Direct release series lookup

- **WHEN** a client lists series with `containsReleaseUnitId = release-a`
- **THEN** the response SHALL include series whose direct release index contains `release-a`
- **AND** it SHALL NOT include a series only because it is related to the same work domain

#### Scenario: Work-domain related series lookup

- **WHEN** a client lists series with `relatedWorkUnitId = work-x`
- **THEN** the response SHALL include series registered under `UnitWork(role = SERIES, workUnitId = work-x)`
- **AND** this SHALL be distinct from direct release membership lookup

### Requirement: Release-Aware Series Entrypoints Choose The Intended Filter

Frontend series entrypoints SHALL use `containsReleaseUnitId` when the user is
adding or inspecting the current release's direct series membership. They SHALL
use `relatedWorkUnitId` when the user is inspecting series related to the whole
work domain.

#### Scenario: Add current release to series

- **WHEN** the app prepares data for adding the current release to a series
- **THEN** it SHALL query existing direct membership with `containsReleaseUnitId`

#### Scenario: Show work-related series

- **WHEN** the app shows series related to all releases of a work
- **THEN** it SHALL query with `relatedWorkUnitId`

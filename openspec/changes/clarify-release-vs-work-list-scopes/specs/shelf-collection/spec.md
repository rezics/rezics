## ADDED Requirements

### Requirement: Shelf List Distinguishes Exact Unit And Work-Domain Containment

The shelf list API SHALL treat `containsUnitId` as an exact `ShelfUnit.unitId`
containment filter. The shelf list API SHALL provide `containsWorkUnitId` for
work-domain shelf lookup through `UnitWork(role = SHELF)`.

`containsUnitId` and `containsWorkUnitId` SHALL NOT be accepted together in the
same request in v1. A request that provides both filters SHALL fail with a
validation error rather than applying ambiguous AND or OR semantics.

#### Scenario: Exact release containment

- **WHEN** a client lists shelves with `containsUnitId = release-a`
- **THEN** the response SHALL include shelves that contain `ShelfUnit.unitId = release-a`
- **AND** it SHALL NOT include a shelf only because it contains sibling release `release-b`

#### Scenario: Work-domain shelf containment

- **GIVEN** release Units `release-a` and `release-b` belong to work `work-x`
- **AND** shelf `shelf-s` contains `release-b`
- **AND** `UnitWork(shelf-s, work-x, role = SHELF)` exists
- **WHEN** a client lists shelves with `containsWorkUnitId = work-x`
- **THEN** `shelf-s` SHALL be included
- **AND** the response MAY identify `release-b` as the matched contained release

#### Scenario: Ambiguous shelf filters rejected

- **WHEN** a client lists shelves with both `containsUnitId` and `containsWorkUnitId`
- **THEN** the API SHALL reject the request with a validation error
- **AND** it SHALL NOT silently choose one filter

### Requirement: Release-Aware Shelf Surfaces Default To Work-Domain Results

Book shelf previews, shelf counts, and shelf-by-book pages SHALL use
`containsWorkUnitId` when the current visible release has a canonical
`UnitWork(role = RELEASE)` work domain. These surfaces SHALL fall back to
`containsUnitId` when the current Unit has no work domain.

Where the UI offers a scope toggle, the exact-release option SHALL query
`containsUnitId` and the all-releases option SHALL query `containsWorkUnitId`.

#### Scenario: Book shelf preview for release with work

- **GIVEN** the current book release belongs to work `work-x`
- **WHEN** the app loads a shelf preview for that book page
- **THEN** the request SHALL use `containsWorkUnitId = work-x`
- **AND** it SHALL NOT rely on `containsUnitId` to expand sibling releases

#### Scenario: Book shelf preview for standalone unit

- **GIVEN** the current book Unit has no work-domain release membership
- **WHEN** the app loads a shelf preview for that book page
- **THEN** the request SHALL use `containsUnitId` with the current Unit id

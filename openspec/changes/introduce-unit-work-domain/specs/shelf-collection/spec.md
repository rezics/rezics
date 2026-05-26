## ADDED Requirements

### Requirement: Shelf Stores Visible Release Units By Default

For release-aware domains, shelf membership SHALL store the visible release Unit
that the user collected. The shelf system SHALL NOT require adding the hidden
work Unit as a separate invisible shelf item for normal collection behavior.

#### Scenario: User collects release

- **WHEN** a user collects book release `release-a`
- **THEN** `ShelfUnit.unitId` SHALL reference `release-a`
- **AND** the hidden work Unit SHALL NOT be inserted as an additional user-visible shelf item

#### Scenario: Work grouping available for rendering

- **GIVEN** `ShelfUnit(unitId = release-a)` exists
- **AND** `UnitWork(release-a, work-x)` exists
- **WHEN** the shelf is rendered in grouped mode
- **THEN** the item MAY be grouped under `work-x`
- **AND** the UI SHALL still expose that the collected concrete Unit is `release-a`

### Requirement: Shelf Rendering Groups Same-Work Releases By Default

The shelf UI SHALL group same-work releases by default.
When a shelf contains multiple releases from the same hidden work, the default
rendering SHALL collapse them into one work-grouped row with release chips or an
equivalent expansion affordance. A release-expanded view SHALL remain available
for users who need exact version rows.

#### Scenario: Multiple releases collapse

- **GIVEN** a shelf contains `release-a` and `release-b`
- **AND** both releases belong to `work-x`
- **WHEN** the shelf renders in default mode
- **THEN** the UI SHALL show one grouped work row
- **AND** the row SHALL indicate that multiple releases are collected

#### Scenario: Expanded mode shows release rows

- **WHEN** the user switches the shelf to release-expanded mode
- **THEN** the shelf SHALL show separate rows for `release-a` and `release-b`
- **AND** each row SHALL preserve its shelf position or a deterministic grouped ordering rule

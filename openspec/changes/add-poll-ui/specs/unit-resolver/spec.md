## ADDED Requirements

### Requirement: POLL units resolve to a typed poll route

`buildUnitUrl` SHALL compute a typed destination for `Unit(type=POLL)` —
`/poll/:unitId` — so the unit resolver redirects a poll to its standalone poll
page instead of falling back to the generic unit view. Unsupported `?view=unit`
and access-control behavior SHALL remain as defined for the resolver; only the
typed-destination mapping for `POLL` is added.

#### Scenario: Poll unit redirects to its typed route

- **GIVEN** a visible `Unit(type=POLL)`
- **WHEN** the viewer navigates to the unit resolver entry for that unit
- **THEN** `buildUnitUrl` SHALL produce the `/poll/:unitId` destination
- **AND** the resolver SHALL redirect there rather than rendering the generic unit view

#### Scenario: Generic unit view still available on request

- **GIVEN** a visible `Unit(type=POLL)`
- **WHEN** the resolver entry is requested with `?view=unit`
- **THEN** the generic unit view SHALL render as for any other unit type

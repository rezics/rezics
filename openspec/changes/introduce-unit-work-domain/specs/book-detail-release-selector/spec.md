## ADDED Requirements

### Requirement: Release Selector Is Work-Domain Aware

The book release selector SHALL list releases from the current release's
`UnitWork` work domain. It SHALL order primary language releases before
secondary releases and SHALL expose release role, language, rank, and display
policy where available.

#### Scenario: Selector lists same-work releases

- **GIVEN** current release `release-a` belongs to `work-x`
- **WHEN** the release selector opens
- **THEN** it SHALL list visible `UnitWork` members of `work-x`
- **AND** it SHALL NOT list releases from unrelated works

#### Scenario: Primary releases sorted first

- **GIVEN** `release-main-ja` is the Japanese language default for `work-x`
- **AND** `release-alt-ja` is a secondary Japanese release
- **WHEN** the selector renders the Japanese group
- **THEN** `release-main-ja` SHALL appear before `release-alt-ja`

### Requirement: Secondary Releases Are Available But Not Dominant

Secondary and hidden-by-default releases SHALL remain reachable for precise
reading/review needs, but they SHALL NOT dominate default selectors or search
surfaces.

#### Scenario: Hidden-by-default release is tucked away

- **GIVEN** `UnitWork(release-rare, work-x)` has `displayPolicy = HIDDEN_BY_DEFAULT`
- **WHEN** the default release selector renders
- **THEN** `release-rare` SHALL be hidden behind an expansion affordance or advanced filter
- **AND** direct links to `release-rare` SHALL still resolve

## ADDED Requirements

### Requirement: Releases Tab Lists Same-Work Releases

The book detail page SHALL provide a Releases tab that lists visible
`UnitWork(role = RELEASE)` members from the current release's work domain. It
SHALL expose release role, language, `position`, and display policy where
available.

#### Scenario: Releases tab lists same-work releases

- **GIVEN** current release `release-a` belongs to `work-x`
- **WHEN** the Releases tab opens
- **THEN** it SHALL list visible `UnitWork(role = RELEASE)` members of `work-x`
- **AND** it SHALL NOT list releases from unrelated works

#### Scenario: Releases are ordered by fractional position

- **GIVEN** `release-a` and `release-b` are same-work releases
- **AND** their `UnitWork.position` values define `release-b` before
  `release-a`
- **WHEN** the Releases tab renders matching releases
- **THEN** `release-b` SHALL appear before `release-a`
- **AND** ordering SHALL NOT use a numeric `rank` field

### Requirement: Releases Tab Supports Multi-Select Language Filtering

The Releases tab SHALL provide language filtering for same-work releases. The
filter SHALL support multiple selected languages, SHALL default to the viewer's
preferred languages when available, and SHALL include an All option that clears
language filtering.

#### Scenario: Preferred languages selected by default

- **GIVEN** the viewer prefers `zh-hant` and `ja`
- **WHEN** the Releases tab opens from a book detail page
- **THEN** `zh-hant` and `ja` SHALL be selected in the language filter by
  default
- **AND** releases in other languages SHALL be hidden until the filter changes

#### Scenario: All shows every same-work release

- **WHEN** the user selects All in the Releases tab language filter
- **THEN** the tab SHALL show all visible same-work releases regardless of
  language
- **AND** the results SHALL still be ordered by `UnitWork.position`

### Requirement: Secondary Releases Are Available But Not Dominant

Secondary and hidden-by-default releases SHALL remain reachable for precise
reading/review needs, but hidden-by-default releases SHALL NOT dominate default
selectors or search surfaces.

#### Scenario: Hidden-by-default release is tucked away

- **GIVEN** `UnitWork(release-rare, work-x, role = RELEASE)` has
  `displayPolicy = HIDDEN_BY_DEFAULT`
- **WHEN** the default Releases tab renders
- **THEN** `release-rare` SHALL be hidden behind an expansion affordance or
  advanced filter
- **AND** direct links to `release-rare` SHALL still resolve

### Requirement: Work Context Shows Release List And Tags

The system SHALL show release and tag context on surfaces that ask a user to
confirm or inspect a work domain. These surfaces include the
Releases tab and creation-time work matching panels, SHALL show existing
releases under the work and the work tag list or inherited tag summary. The work
context label SHALL be derived from release context rather than requiring a
separate public work title.

#### Scenario: Work context panel gives enough disambiguation

- **GIVEN** current work `work-x` has multiple releases and work-level tags
- **WHEN** the Releases tab or creation matching panel displays `work-x`
- **THEN** it SHALL show same-work releases
- **AND** it SHALL show work-level tags or inherited tag summary
- **AND** it SHALL not depend on a standalone public work title to disambiguate
  the work

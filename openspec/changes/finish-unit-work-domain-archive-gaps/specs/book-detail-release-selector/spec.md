## MODIFIED Requirements

### Requirement: Releases Tab Lists Same-Work Releases

The book detail UI SHALL provide a first-class Releases tab/route for
same-work release discovery. The Releases tab SHALL list `UnitWork(role =
RELEASE)` members for the current release's canonical work, not an overview-page
section reached through a hash.

#### Scenario: Missing-language affordance opens Releases tab

- **GIVEN** the current release lacks one of the viewer's desired languages
- **WHEN** the user activates the missing-language affordance
- **THEN** navigation SHALL open the Releases tab for the current release
- **AND** the Releases tab SHALL handle same-work language discovery

#### Scenario: Releases tab lists same-work releases

- **GIVEN** the current release belongs to work `work-x`
- **WHEN** the user opens the Releases tab
- **THEN** the UI SHALL list visible same-work releases from
  `UnitWork(workUnitId = work-x, role = RELEASE)`
- **AND** releases SHALL be ordered by `UnitWork.position` with display policy
  applied

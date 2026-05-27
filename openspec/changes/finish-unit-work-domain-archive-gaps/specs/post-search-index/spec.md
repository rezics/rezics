## MODIFIED Requirements

### Requirement: Work-Domain Feed Uses UnitWork Membership

Release community surfaces SHALL use `UnitWork` membership by default when the
current release belongs to a work domain. This includes review tabs, hero review
previews, review counts, and other public release community previews. Exact
release filters SHALL continue to use `targetUnitId = currentReleaseId` only
when the UI explicitly requests the current release.

#### Scenario: Release review tab defaults to work-domain reviews

- **GIVEN** releases `release-a` and `release-b` both belong to `work-x`
- **AND** a review targets `release-a` and has
  `UnitWork(reviewUnitId, work-x, role = REVIEW)`
- **WHEN** a user opens the review tab for `release-b`
- **THEN** the default review query SHALL include the review through work-domain
  membership
- **AND** the review card SHALL show that its precise target is `release-a`

#### Scenario: Hero review preview uses work-domain feed

- **GIVEN** the current release belongs to `work-x`
- **WHEN** the hero or summary area loads review preview/count data
- **THEN** those reads SHALL use the work-domain feed by default
- **AND** exact-release counts SHALL be used only by explicitly labelled
  current-release views

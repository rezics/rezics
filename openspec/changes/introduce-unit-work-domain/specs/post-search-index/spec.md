## ADDED Requirements

### Requirement: Post Search Documents Carry Target Work Unit

Post search documents SHALL include `targetWorkUnitId` when a post or review
targets a release that belongs to a hidden work through `UnitWork`. This field
SHALL be filterable in Meilisearch.

#### Scenario: Release-targeted review searchable by work

- **GIVEN** `UnitWork(release-a, work-x)` exists
- **AND** review post `post-r` has `targetUnitId = release-a`
- **WHEN** `post-r` is indexed for post search
- **THEN** the document SHALL include `targetWorkUnitId = work-x`

#### Scenario: Exact release target remains filterable

- **GIVEN** review post `post-r` has `targetUnitId = release-a`
- **WHEN** `post-r` is indexed
- **THEN** the document SHALL keep `targetUnitId = release-a`
- **AND** exact-release filters SHALL remain possible

### Requirement: Work-Domain Feed Uses Target Work Unit

Release pages SHALL be able to show a work-domain feed by querying posts where
`targetWorkUnitId` equals the current release's hidden work Unit. Exact-release
views SHALL filter by `targetUnitId`.

#### Scenario: Release page shows all work-domain reviews

- **GIVEN** releases `release-a` and `release-b` both belong to `work-x`
- **AND** each release has one review
- **WHEN** the user opens the community tab on `release-a` in default mode
- **THEN** the feed SHALL include reviews targeting both `release-a` and `release-b`
- **AND** each result SHALL display its precise target release context

#### Scenario: User filters to current release

- **WHEN** the user switches the community feed to exact-release mode on `release-a`
- **THEN** the feed SHALL include posts with `targetUnitId = release-a`
- **AND** it SHALL exclude posts targeting sibling releases unless they also directly target `release-a`

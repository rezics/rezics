## ADDED Requirements

### Requirement: Post Work Scope Comes From UnitWork Membership

Post and review work-domain scope SHALL be represented by `UnitWork`
membership for the post Unit. The system SHALL NOT require a post-specific
`targetWorkUnitId` projection as the canonical work-domain index. Precise
release targeting SHALL remain represented by `targetUnitId`.

#### Scenario: Release-targeted review enters work scope

- **GIVEN** `UnitWork(release-a, work-x, role = RELEASE)` exists
- **AND** review post `post-r` has `targetUnitId = release-a`
- **WHEN** `post-r` is created or indexed for work-domain search
- **THEN** `UnitWork(post-r, work-x, role = REVIEW)` SHALL exist
- **AND** the indexed/searchable representation MAY expose work membership
  derived from `UnitWork`

#### Scenario: Exact release target remains filterable

- **GIVEN** review post `post-r` has `targetUnitId = release-a`
- **WHEN** `post-r` is indexed
- **THEN** the document SHALL keep `targetUnitId = release-a`
- **AND** exact-release filters SHALL remain possible

### Requirement: Work-Domain Feed Uses UnitWork Membership

Release pages SHALL be able to show a work-domain feed by querying content
Units that have `UnitWork(workUnitId = currentWork, role in POST/REVIEW/...)`.
Exact-release views SHALL filter by `targetUnitId`.

#### Scenario: Release page shows all work-domain reviews

- **GIVEN** releases `release-a` and `release-b` both belong to `work-x`
- **AND** each release has one review registered in `UnitWork` under `work-x`
- **WHEN** the user opens the community tab on `release-a` in default mode
- **THEN** the feed SHALL include reviews targeting both `release-a` and
  `release-b`
- **AND** each result SHALL display its precise target release context

#### Scenario: User filters to current release

- **WHEN** the user switches the community feed to exact-release mode on
  `release-a`
- **THEN** the feed SHALL include posts with `targetUnitId = release-a`
- **AND** it SHALL exclude posts targeting sibling releases unless they also
  directly target `release-a`

### Requirement: Work Merge Repairs Post Work Membership

The system SHALL repair post work-domain membership when a source work is merged
into a target work. Post work-domain membership and work-domain feed queries
SHALL converge on the target canonical work. Existing precise `targetUnitId`
values SHALL remain unchanged.

#### Scenario: Review membership moves to target work

- **GIVEN** review `post-r` has `targetUnitId = release-a`
- **AND** `release-a` belonged to source work `work-old`
- **AND** `work-old` is merged into `work-new`
- **WHEN** post work-membership repair rebuilds `post-r`
- **THEN** `targetUnitId` SHALL remain `release-a`
- **AND** `UnitWork(post-r, work-new, role = REVIEW)` SHALL exist
- **AND** stale `UnitWork(post-r, work-old, role = REVIEW)` SHALL be removed
  unless another target still justifies it

## ADDED Requirements

### Requirement: Post List And Search Keep Exact Target Separate From Work Domain

Post list and post search APIs SHALL keep `targetUnitId` as an exact target
filter. Work-domain post aggregation SHALL use `workUnitId` and `workRoles`
derived from `UnitWork` membership.

Clients SHALL NOT pass a release id through `targetUnitId` when the intended
behavior is "any release in this work".

#### Scenario: Exact target list

- **WHEN** a client lists posts with `targetUnitId = release-a`
- **THEN** the service SHALL return posts whose exact target is `release-a`
- **AND** it SHALL NOT include posts whose exact target is sibling release `release-b`

#### Scenario: Work-domain review list

- **WHEN** a client lists posts with `workUnitId = work-x` and `workRoles = [REVIEW]`
- **THEN** the service SHALL return review posts registered under work `work-x`
- **AND** the post DTO SHALL preserve each post's precise `targetUnitId`

#### Scenario: Exact and work filters together

- **WHEN** a client lists posts with both `targetUnitId` and `workUnitId`
- **THEN** the service SHALL apply exact target filtering and work-domain membership filtering together
- **AND** this SHALL be treated as an intentional narrow query, not as automatic release expansion

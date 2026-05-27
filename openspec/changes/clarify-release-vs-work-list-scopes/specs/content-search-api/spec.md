## ADDED Requirements

### Requirement: Search Filters Preserve Exact Unit And Work-Domain Naming

Content and post search options SHALL preserve the project-wide naming rule:
Unit id filters such as `targetUnitId`, `rootTargetUnitId`, and
`containedUnitIds` are exact Unit filters, while `workUnitId`, `workUnitIds`,
and work-role filters are work-domain filters derived from `UnitWork`.

Search builders SHALL NOT silently resolve an exact release Unit id into a work
domain unless the request explicitly uses a work-domain option.

#### Scenario: Exact post search target

- **WHEN** a post search request includes `targetUnitId = release-a`
- **THEN** the search filter SHALL match posts whose exact target is `release-a`
- **AND** it SHALL NOT include posts targeting sibling release `release-b`

#### Scenario: Work-domain post search

- **WHEN** a post search request includes `workUnitId = work-x` and `workRoles = [REVIEW]`
- **THEN** the search filter SHALL match posts whose indexed `workUnitIds` include `work-x`
- **AND** whose indexed `workRoles` include `REVIEW`

#### Scenario: Exact shelf content search

- **WHEN** a content search request filters shelf documents by `containedUnitIds = release-a`
- **THEN** the search filter SHALL match shelves that directly contain `release-a`
- **AND** it SHALL NOT include shelves only because they participate in the same work domain

### Requirement: Rating Filters Apply To Visible Release Candidates

The system SHALL apply rating filters to visible release candidates for
release-aware work-domain searches.

When a work-domain release-aware search also applies content rating filters, the
rating constraint SHALL apply to visible release candidates or matched visible
content documents. Hidden work Units SHALL NOT be used as the rating authority
for public release-aware search results.

#### Scenario: Work-domain search with rating

- **GIVEN** releases `release-a` and `release-b` belong to work `work-x`
- **AND** only `release-b` has rating `GENERAL`
- **WHEN** a work-domain release-aware search filters by `workUnitId = work-x` and rating `GENERAL`
- **THEN** results SHALL be constrained to matches attributable to `release-b`
- **AND** hidden work Unit metadata SHALL NOT override the release rating

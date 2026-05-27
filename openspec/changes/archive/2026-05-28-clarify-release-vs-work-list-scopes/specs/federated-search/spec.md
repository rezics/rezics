## ADDED Requirements

### Requirement: Book-Scoped Federated Search Has Explicit Release Scope

Book-scoped federated search SHALL distinguish exact-release scope from
work-domain scope. Exact-release scope SHALL use the current route Unit id for
exact filters such as `containedUnitIds` and `rootTargetUnitId`. Work-domain
scope SHALL use the current release's canonical work id for work-domain filters
such as shelf `containsWorkUnitId` semantics and post `workUnitId`/`workRoles`.

For release-aware book routes, work-domain scope SHALL be the default when a
canonical work id exists. Standalone Units SHALL use exact-release scope.

#### Scenario: Book-scoped reviews default to work domain

- **GIVEN** route release `release-a` belongs to work `work-x`
- **WHEN** federated search runs in book scope for the reviews category
- **THEN** the post query SHALL filter by work-domain membership for `work-x`
- **AND** it SHALL include reviews targeting sibling releases that belong to `work-x`

#### Scenario: Exact-release scoped search remains available

- **GIVEN** route release `release-a` belongs to work `work-x`
- **WHEN** federated search runs with exact-release scope
- **THEN** shelf queries SHALL filter exact containment of `release-a`
- **AND** post queries SHALL filter exact root target `release-a`

#### Scenario: Standalone book scope

- **GIVEN** route Unit `unit-y` has no canonical work domain
- **WHEN** federated search runs in book scope
- **THEN** the search SHALL use exact Unit filters for `unit-y`

### Requirement: Federated Result Cards Identify Sibling Release Targets

Federated search results SHALL preserve precise sibling-release target metadata
for work-domain matches.

When book-scoped federated search returns a work-domain result whose precise
target or matched contained Unit is a sibling release, the result card data
SHALL preserve target metadata so the UI can identify that sibling release.

#### Scenario: Sibling review result

- **GIVEN** the current route release is `release-a`
- **AND** a returned review targets sibling release `release-b`
- **WHEN** the review card renders in a work-domain result list
- **THEN** the card SHALL be able to display metadata identifying `release-b`

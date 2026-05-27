# series-work-domain-projection Specification

## Purpose

Defines how Series Units enter work domains through derived `UnitWork(role = SERIES)` projection. The projection is derived from direct Series release member nodes and each release's canonical `UnitWork(role = RELEASE)` work domain. Work Units are not direct projection sources, nested Series does not project transitively, and the projection is derived and repairable rather than history-bearing, enabling work-domain surfaces to list related Series.

## Requirements

### Requirement: Series enters work domains through direct releases

The system SHALL project Series Units into work domains using `UnitWork(role =
SERIES)`. This projection SHALL be derived from direct Series release member
nodes and each release's canonical `UnitWork(role = RELEASE)` work domain.

#### Scenario: Direct release node projects Series into release work

- **GIVEN** a Series content node directly references release `release-a`
- **AND** `UnitWork(release-a, work-x, role = RELEASE)` exists
- **WHEN** Series work-domain projection is reconciled
- **THEN** `UnitWork(seriesUnitId, work-x, role = SERIES)` SHALL exist

### Requirement: Work Units are not direct projection sources

Series work-domain projection SHALL NOT require direct Work Unit membership in
Series content structure. Work-domain association SHALL be derived from direct
release nodes.

#### Scenario: Work-level add stores representative release

- **WHEN** an editor adds a work-level intent to a Series
- **THEN** the system SHALL store a representative release node
- **AND** the Series work-domain projection SHALL resolve the work from that representative release

### Requirement: Nested Series does not project transitively

Series work-domain projection SHALL NOT recursively expand nested Series Units.
If a parent Series should enter a work domain represented by a child Series'
content, the parent Series SHALL directly contain a representative release from
that work domain.

#### Scenario: Parent Series references child Series only

- **GIVEN** parent Series `A` references child Series `B`
- **AND** child Series `B` directly contains release `release-a` in work `work-x`
- **WHEN** Series work-domain projection for `A` is reconciled
- **THEN** `A` SHALL NOT receive `UnitWork(A, work-x, role = SERIES)` unless `A` also directly contains a release in `work-x`

### Requirement: Series work-domain projection is not history

`UnitWork(role = SERIES)` SHALL be a derived work-domain projection and SHALL NOT
be the history-bearing Series membership source. Series content-structure edits
SHALL be the history-bearing source.

#### Scenario: Projection repair after work merge

- **WHEN** a work merge changes the canonical work domain for a direct Series release node
- **THEN** repair SHALL update `UnitWork(role = SERIES)` projection rows
- **AND** the repair SHALL NOT create a Series structure history event unless the Series content structure changes

### Requirement: Work-domain surfaces can list related Series

A work-domain surface SHALL be able to list related Series by querying
`UnitWork(workUnitId = currentWork, role = SERIES)`. The result SHALL indicate
that the related Series came from direct release membership projection.

#### Scenario: Release page lists related Series

- **GIVEN** release `release-a` belongs to work `work-x`
- **AND** a Series has `UnitWork(seriesUnitId, work-x, role = SERIES)`
- **WHEN** the release page queries related work-domain Series
- **THEN** the response SHALL include that Series as related public knowledge

## ADDED Requirements

### Requirement: Factory Provides Unit Work Domain Scenario

The factory seed system SHALL provide a special scenario that creates a
multi-release work-domain fixture for release-aware books. The scenario SHALL
produce stable special target output for the hidden work, primary release,
translation release, secondary release, hidden-by-default release, and any key
admin merge target created by the scenario.

#### Scenario: Work domain targets are emitted

- **WHEN** the `unit-work-domain` special scenario completes
- **THEN** the special target report SHALL include the hidden work Unit id
- **AND** it SHALL include at least the primary release Unit id and one
  translation release Unit id

### Requirement: Work Domain Scenario Covers Inheritance And Grouping

The `unit-work-domain` scenario SHALL seed data sufficient to exercise inherited
work tags, release-local tags, language defaults, grouped content search,
release-specific reviews aggregated by work, and shelf grouping of same-work
releases.

#### Scenario: Inherited and local tags exist

- **WHEN** the scenario creates a hidden work and release members
- **THEN** at least one tag SHALL be attached to the hidden work
- **AND** at least one different tag SHALL be attached directly to a release

#### Scenario: Language defaults exist

- **WHEN** the scenario creates releases in multiple languages
- **THEN** it SHALL create `UnitWorkLanguageDefault` rows for at least two
  languages

#### Scenario: Work-domain reviews exist

- **WHEN** the scenario creates reviews
- **THEN** at least two reviews SHALL target different releases under the same
  work
- **AND** their work-domain projection SHALL allow a release page to show both
  in the same work feed

#### Scenario: Shelf contains same-work releases

- **WHEN** the scenario creates a shelf fixture
- **THEN** the shelf SHALL contain at least two releases belonging to the same
  hidden work
- **AND** the fixture SHALL be suitable for grouped and expanded shelf rendering

### Requirement: Work Domain Scenario Covers Source Identity

The `unit-work-domain` scenario SHOULD attach at least one ISBN and one source
site external reference to a visible release. ISBN and source references in this
scenario SHALL identify releases, not hidden works.

#### Scenario: External reference attaches to release

- **WHEN** the scenario creates a source-site reference for a book fixture
- **THEN** the `UnitExternalRef.unitId` SHALL reference a visible release Unit
- **AND** it SHALL NOT use the hidden work Unit as the external book identity by
  default

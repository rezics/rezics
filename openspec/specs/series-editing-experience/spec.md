# series-editing-experience Specification

## Purpose

Defines frontend/admin editing flows for Series, Work maintenance metadata, and release-to-Series additions. The library content editing experience includes Series management, abstract `work/:unitId` release-list inspection, and Work maintenance identity editing. Release edit flows support adding the current release or a representative release for the release's work, with explainable representative-release selection, while direct Work-targeted interaction requires explicit human-confirmed design.

## Requirements

### Requirement: Library content editing includes Series management

The library content editing experience SHALL include a dedicated Series
management surface for creating Series, editing Series metadata, and editing
Series content structure.

#### Scenario: Editor manages Series content

- **WHEN** an editor opens the Series management surface
- **THEN** the UI SHALL provide data integration for Series metadata and content-structure editing
- **AND** Series structure edits SHALL be submitted through Series APIs that record public history

### Requirement: Work abstract page supports release-list inspection

The editing and library management experience SHALL allow a Work page or route
to exist as `work/:unitId` for abstract release-list inspection, maintenance
history, and work-domain diagnostics. The route SHALL identify the Work by Unit
id and SHALL NOT require Work slug lookup scope.

#### Scenario: Editor opens Work abstract page

- **WHEN** an editor opens `work/:unitId`
- **THEN** the page SHALL show abstract Work maintenance context and release-list resolution
- **AND** the system SHALL NOT resolve the Work through normal public slug scope

### Requirement: Work maintenance editing supports UnitTranslation abstract identity

The editing experience SHALL provide a maintenance path for Work Unit title and
abstract identity metadata needed by work-domain grouping and admin review.
Work titles MAY use `UnitTranslation`, but those translations SHALL be treated
as Work abstract identity rather than ordinary release display metadata. This
maintenance path SHALL NOT make Work Units direct Series members or ordinary
search result cards.

#### Scenario: Editor updates Work maintenance title

- **WHEN** an editor updates a Work Unit's abstract title or identity metadata
- **THEN** the system SHALL save the Work maintenance identity
- **AND** Work `UnitTranslation` rows, when used, SHALL be interpreted as abstract Work identity
- **AND** the Work Unit SHALL remain hidden from ordinary library search results

### Requirement: Direct Work interaction requires explicit human-confirmed design

The system SHALL NOT introduce direct user interaction or direct relationship
targets for Work Units without a separate explicit design decision confirmed by
a human. This includes direct Work-targeted posts, reviews, shelves, ratings,
Series membership, follows, progress, or any future relation that targets a Work
Unit instead of a visible release.

#### Scenario: Feature proposes direct Work-targeted relation

- **WHEN** an implementation proposes a relation or interaction whose direct target is a Work Unit
- **THEN** the implementation SHALL stop and require explicit design review and human confirmation
- **AND** the design SHALL analyze release context loss, precision, history, search, and community aggregation before implementation

### Requirement: Release edit flow supports current release and work intent

A release editing surface SHALL support adding the current release to a Series
and adding the release's work to a Series through representative-release
selection. Both flows SHALL write a release node to Series content structure.

#### Scenario: Editor adds current release to Series

- **WHEN** an editor chooses to add the current release to a Series
- **THEN** the system SHALL create a Series content node referencing that release Unit
- **AND** the system SHALL reconcile direct Series content index and `UnitWork(role = SERIES)` projection

#### Scenario: Editor adds work through representative release

- **WHEN** an editor chooses to add the current release's work to a Series
- **THEN** the system SHALL select or ask for a representative release for that work
- **AND** the Series content node SHALL reference the representative release Unit rather than the hidden Work Unit

### Requirement: Representative release selection is explainable

Representative-release selection SHALL be explainable to editors. The system
SHALL prefer explicit editor selection, then primary/canonical release, then
translation coverage, source quality, display completeness, and deterministic
fallback ordering.

#### Scenario: System suggests representative release

- **WHEN** an editor starts a work-level Series add flow without selecting a specific release
- **THEN** the system SHALL suggest a representative release with a reason such as primary release, translation coverage, or source quality
- **AND** the editor SHALL be able to override the suggestion before saving where permissions allow

## ADDED Requirements

### Requirement: Content search documents project game and media metadata

Content search documents for GAME and MEDIA release Units SHALL include typed
metadata needed for filtering and result rendering. At minimum, GAME documents
SHALL expose platform Entity ids, age-rating Entity ids, release date,
version label, and system-requirement summary fields when available. MEDIA
documents SHALL expose kind key, age-rating Entity ids, release date, runtime
summary, and content-structure availability fields when available.

#### Scenario: Game document includes platform Entity ids

- **WHEN** a GAME release is indexed
- **THEN** its content search document SHALL include the Entity ids for supported platforms
- **AND** platform filters SHALL NOT depend on legacy string platform keys

#### Scenario: Media document includes kind and rating ids

- **WHEN** a MEDIA release is indexed
- **THEN** its content search document SHALL include `kindKey` and age-rating Entity ids when available
- **AND** clients SHALL be able to render or filter from those projected fields

### Requirement: Search options support Entity-backed platform and age-rating filters

The content search contract SHALL provide filters for platform Entity ids and
age-rating Entity ids. These filters SHALL apply to GAME and MEDIA documents as
appropriate and SHALL be expressed in terms of Unit/Entity ids, not raw labels
or legacy string keys.

#### Scenario: Filter games by platform Entity

- **WHEN** a client submits a content search with a PlayStation 5 platform Entity id
- **THEN** the request SHALL be valid
- **AND** the server SHALL be able to filter GAME documents by that Entity id

#### Scenario: Filter media by age-rating Entity

- **WHEN** a client submits a content search with an age-rating Entity id
- **THEN** the request SHALL be valid
- **AND** the server SHALL be able to filter MEDIA documents by that Entity id

### Requirement: Search documents preserve work grouping for game and media

GAME and MEDIA search documents SHALL preserve the work-grouping fields defined
by the work-domain search contract. Grouping SHALL use the canonical
`UnitWork(role = RELEASE)` work id when present, and standalone releases SHALL
group by their own Unit id.

#### Scenario: Same-work game releases group together

- **GIVEN** two GAME releases belong to the same hidden work through `UnitWork`
- **WHEN** both releases are indexed
- **THEN** their search documents SHALL share the same search group id
- **AND** ordinary search result assembly MAY collapse them into one grouped result

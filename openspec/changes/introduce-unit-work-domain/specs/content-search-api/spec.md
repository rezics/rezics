## ADDED Requirements

### Requirement: Content Search Filters Use Inherited Work Tags

When a content search request filters by tags, the server SHALL apply the tag
filter against the document's inherited-aware tag field (`allTagIds` or its
successor), not only release-local `ownTagIds`.

#### Scenario: Work tag finds release

- **GIVEN** hidden work `work-x` has tag `tag-fantasy`
- **AND** release `release-a` belongs to `work-x` through `UnitWork`
- **WHEN** a user searches for content with `tag-fantasy`
- **THEN** `release-a` SHALL be eligible to appear even if it has no release-local `UnitTag(tag-fantasy)` row

#### Scenario: Release-local tag also matches

- **GIVEN** release `release-a` has local tag `tag-translation-quality`
- **WHEN** a user searches for content with `tag-translation-quality`
- **THEN** `release-a` SHALL be eligible to appear through its release-local tag projection

### Requirement: Content Search Groups Same-Work Releases By Default

The content search API SHALL group ordinary release search results by
`searchGroupId` by default. For each group, the API SHALL choose a primary
visible result using release-specific match quality, language preference,
`primaryForLanguages`, `releaseRank`, and `displayPolicy`.

#### Scenario: Same work has many tag matches

- **GIVEN** 20 releases belong to `work-x`
- **AND** all 20 inherit the same work tag
- **WHEN** a user searches by that tag
- **THEN** the default response SHALL NOT render all 20 releases as independent top-ranked results
- **AND** it SHALL return a grouped result with collapsed alternatives

#### Scenario: Precise release field expands matches

- **WHEN** a search query includes an explicit release-specific constraint such as publisher, ISBN, source site, format, or exact language mode
- **THEN** the API MAY return multiple release rows from the same work group
- **AND** those rows SHALL remain associated with their `searchGroupId`

### Requirement: Search Projection Drift Is Repairable

The search API and admin diagnostics SHALL tolerate eventual consistency after
work-domain mutations and SHALL provide a repair path that rebuilds inherited
work projections for affected releases.

#### Scenario: Work tag projection is temporarily stale

- **WHEN** a work tag is changed and the release fan-out job has not completed
- **THEN** content search MAY temporarily reflect the old tag projection
- **AND** the queued repair job SHALL eventually rebuild affected release documents

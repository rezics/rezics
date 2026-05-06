## MODIFIED Requirements

### Requirement: Content tab displays chapter index with release selection

The Content tab SHALL render a release selector dropdown above the chapter tree. The chapter tree SHALL load data from `bookQueries.contentStructure(releaseUnitId)` where `releaseUnitId` is determined by the selected release. See `book-detail-release-selector` spec for selector behavior.

#### Scenario: Content tab renders chapter tree

- **WHEN** the Content tab is active
- **THEN** a release selector SHALL appear above the chapter tree
- **AND** the chapter tree SHALL display the content structure for the selected release

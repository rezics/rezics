## MODIFIED Requirements

### Requirement: Content tab displays a release selector above the chapter tree

The Content tab SHALL render a dropdown selector above the chapter tree that lists all releases under the book's parent work. Selecting a release SHALL load that release's content structure via `bookQueries.contentStructure(releaseUnitId)`.

#### Scenario: Release selector is visible

- **WHEN** the Content tab is active
- **THEN** a release selector dropdown SHALL be rendered above the chapter tree

#### Scenario: Selecting a release loads its content structure

- **WHEN** the user selects a different release from the dropdown
- **THEN** the chapter tree SHALL reload with the selected release's content structure

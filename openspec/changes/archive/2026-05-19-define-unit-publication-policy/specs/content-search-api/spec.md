## ADDED Requirements

### Requirement: Public content search is public-only
Public content search filters SHALL require `visibility=PUBLIC` and SHALL rely on indexes that contain only public published content.

#### Scenario: Search includes shelves
- **WHEN** public content search includes shelf results
- **THEN** private system shelves SHALL NOT appear

#### Scenario: Search is scoped to a book
- **WHEN** public content search is scoped to a book and requests shelves
- **THEN** returned shelf documents SHALL be public shelves whose `containedUnitIds` include the book Unit ID

### Requirement: License filter keeps existing isLicensed behavior
The content search `isLicensed` filter SHALL continue to filter by licensed-work metadata, not Unit publication license.

#### Scenario: Search filters licensed works
- **WHEN** a search query sets `isLicensed=true`
- **THEN** the filter SHALL match the existing `isLicensed` indexed field
- **AND** it SHALL NOT match by license slug

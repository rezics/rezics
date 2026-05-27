## MODIFIED Requirements

### Requirement: Translation Records Do Not Select Releases

Release selection SHALL be handled by same-work release browsing and explicit
source controls. Sibling-release lookup UI SHALL resolve the canonical work from
`workMembership.workUnitId` first, with legacy `workUnitId` only as migration
fallback.

#### Scenario: Translation source picker uses canonical work membership

- **GIVEN** a release DTO has `workMembership.workUnitId = "work-x"`
- **WHEN** the editor opens a translation source picker
- **THEN** sibling release lookup SHALL query releases for `work-x`
- **AND** it SHALL NOT depend only on legacy `BookDTO.workUnitId`

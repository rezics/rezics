## ADDED Requirements

### Requirement: Public shelf lists include only public published shelves
Public shelf list and discovery endpoints SHALL include only shelves whose backing Unit is `PUBLISHED` and `PUBLIC`.

#### Scenario: Public caller lists shelves
- **WHEN** a public caller requests the shelf list
- **THEN** shelves whose backing Unit visibility is `PRIVATE` SHALL NOT appear

#### Scenario: Public caller lists shelves containing a book
- **WHEN** a public caller requests shelves containing a target Unit
- **THEN** every returned shelf SHALL be public published
- **AND** every returned shelf SHALL contain the target Unit

### Requirement: Owner-scoped shelf reads may include private shelves
Owner-authorized shelf reads SHALL be the only ordinary shelf reads that can include the owner's private shelves.

#### Scenario: Owner lists own shelves
- **WHEN** an authenticated user requests their own shelf collection
- **THEN** the response MAY include private system shelves such as Favorites

#### Scenario: Public caller views another user's shelves
- **WHEN** a public caller requests shelves owned by another user
- **THEN** private shelves SHALL NOT appear

## MODIFIED Requirements

### Requirement: Profile overview is a complete identity surface

Profile overview SHALL show public bio, shelves/reading/reviews/realms/activity tabs, follow/DM/report actions, and privacy-aware empty states.

#### Scenario: Viewer opens private-empty profile section

- **WHEN** a profile section is hidden by privacy or has no content
- **THEN** the UI SHALL render the appropriate privacy or empty state without leaking hidden counts

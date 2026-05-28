## MODIFIED Requirements

### Requirement: Profile overview is a complete identity surface

Profile overview SHALL show public bio, shelves/reading/reviews/realms/activity tabs, follow/DM/report actions, and privacy-aware empty states.

#### Scenario: Viewer opens private-empty profile section

- **WHEN** a profile section is hidden by privacy or has no content
- **THEN** the UI SHALL render the appropriate privacy or empty state without leaking hidden counts

### Requirement: Profile exposes follower and following lists

Profile SHALL expose dedicated follower and following list sub-pages reached from the profile, backed by the existing subscription API, with pagination and privacy gating.

#### Scenario: Viewer opens following list

- **WHEN** a viewer activates the following count on a profile
- **THEN** the app SHALL navigate to a list sub-page
- **AND** SHALL render entries respecting the target user's privacy settings

### Requirement: Profile shows an activity timeline

Profile SHALL provide an activity timeline aggregating the user's public reactions, posts, reviews, remarks, and shelf updates, ordered by time, respecting privacy and content lifecycle.

#### Scenario: Removed content is hidden from timeline

- **WHEN** a user's past content has been removed or hidden by moderation
- **THEN** the timeline SHALL omit those entries
- **AND** SHALL NOT leak the deletion as a gap or count discrepancy

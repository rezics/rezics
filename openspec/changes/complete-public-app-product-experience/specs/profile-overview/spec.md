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

### Requirement: Profile reading tab reflects per-node completion fact source

The profile reading tab SHALL render the target user's reading state from server-aggregated DTOs that join `UserUnitProgress` (status, `lastReadNodeId`, `lastReadAnchor`) with `UserContentNodeProgress` (per-book `chaptersCompleted` aggregation) and the per-book non-deleted node count (`chaptersTotal`). The tab SHALL NOT scatter per-book client roundtrips to fetch TOC or raw node-completion rows. Privacy gating SHALL apply at the DTO layer; entries about books or chapters hidden by privacy or moderation SHALL be omitted server-side rather than filtered client-side.

#### Scenario: Reading tab shows in-progress books with chapter counters

- **GIVEN** the target user has `UserUnitProgress` rows in `ACTIVE` status for several books, each with non-zero `UserContentNodeProgress` rows
- **WHEN** a viewer with permission opens the target user's reading tab
- **THEN** the tab SHALL list each active book with its `chaptersCompleted/chaptersTotal` counter and the `lastReadNodeId`-resolved chapter title
- **AND** activating an entry SHALL navigate to `/book/:bookId/node/:nodeId` using the target user's `lastReadNodeId` (read-only context: viewing where they left off, not writing the viewer's own progress)

#### Scenario: Privacy-hidden books are omitted server-side

- **GIVEN** the target user has marked some shelf entries private
- **WHEN** a non-privileged viewer opens the target user's reading tab
- **THEN** the server-aggregated DTO SHALL omit the private entries entirely
- **AND** the visible chapter-completion counters SHALL NOT include the hidden entries' contributions

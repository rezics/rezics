## ADDED Requirements

### Requirement: User can complete library collection flow

The app SHALL let a user discover a content item, add it to a shelf/library collection, view it from their library, update status/progress, and remove it.

#### Scenario: User shelves a book

- **WHEN** a signed-in user adds a book release to a shelf from a detail page
- **THEN** the shelf action SHALL persist through typed API mutation
- **AND** the item SHALL appear in the user's library/shelf view

### Requirement: Reading progress is visible and actionable

Reading/progress surfaces SHALL show status, percentage/count, last position, and continuation action where data exists.

#### Scenario: Progress updates dashboard

- **WHEN** a user updates reading progress
- **THEN** the dashboard and profile/library views SHALL reflect the updated progress after cache invalidation

### Requirement: Work/release browsing is user-understandable

Release-aware pages SHALL show exact release context and work-wide alternatives without making hidden work Units ordinary public detail pages.

#### Scenario: User browses same-work releases

- **WHEN** a release has same-work alternatives
- **THEN** the detail page SHALL expose a releases area with language and edition filters

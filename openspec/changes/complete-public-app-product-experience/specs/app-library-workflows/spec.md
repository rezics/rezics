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

### Requirement: Library surfaces support a readable-content filter

Library and shelf surfaces SHALL support filtering to items the platform can serve for reading. For books, the filter SHALL be `isLicensed === true`; without a license the platform cannot present the full text and users can only review or discuss the item. The dashboard library section SHALL apply this filter by default, while standalone shelf pages SHALL expose it as an opt-in toggle so users can still see their full collection.

#### Scenario: User toggles readable filter on shelf page

- **GIVEN** a shelf with a mix of licensed and unlicensed books
- **WHEN** the user enables the readable filter on the shelf page
- **THEN** only books with `isLicensed === true` SHALL render
- **AND** disabling the filter SHALL restore the full list

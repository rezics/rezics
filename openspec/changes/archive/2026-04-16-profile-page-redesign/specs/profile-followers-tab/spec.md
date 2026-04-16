## ADDED Requirements

### Requirement: Followers and Following sub-filters
The Followers tab SHALL render L2 chips: "Followers (N)" and "Following (N)" where N is the count from the user profile data. The active filter SHALL be persisted in the URL search param `filter`.

#### Scenario: Default to Followers
- **WHEN** a user navigates to the Followers tab without a `filter` param
- **THEN** the "Followers" chip is active and the user's followers are listed

#### Scenario: Switch to Following
- **WHEN** a user clicks the "Following" chip
- **THEN** the users that this profile user follows are listed and the URL updates to `?filter=following`

### Requirement: User list display
Each user entry SHALL display: avatar, display name, slug, and bio snippet. For the current user's own profile, each entry SHALL also show a Follow/Unfollow button reflecting the current follow status.

#### Scenario: Follower entry renders
- **WHEN** followers are loaded
- **THEN** each follower shows avatar, name, @slug, and bio snippet

#### Scenario: Follow button on own followers
- **WHEN** the current user views their own followers list
- **THEN** each follower entry shows a Follow/Unfollow button based on whether the current user follows them back

### Requirement: Paginated follower list
The Followers tab SHALL support pagination with 20 items per page.

#### Scenario: Pagination works
- **WHEN** the user has more than 20 followers
- **THEN** pagination controls allow navigating between pages

### Requirement: Empty state
When the user has no followers or followings, an appropriate empty state SHALL be shown.

#### Scenario: No followers
- **WHEN** the user has zero followers
- **THEN** a message "No followers yet" is displayed

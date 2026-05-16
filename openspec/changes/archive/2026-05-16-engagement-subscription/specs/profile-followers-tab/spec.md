## MODIFIED Requirements

### Requirement: Followers and Following sub-filters

The Followers tab SHALL render L2 chips: "Followers (N)" and "Following (N)" where N is the count from the user profile data, sourced from `User.followersCount` and `User.followingsCount` (both backed by aggregates over `Subscription` filtered to USER subscriber/target). The active filter SHALL be persisted in the URL search param `filter`.

#### Scenario: Default to Followers

- **WHEN** a user navigates to the Followers tab without a `filter` param
- **THEN** the "Followers" chip is active and the user's followers (subscribers whose target is this profile USER unit) are listed

#### Scenario: Switch to Following

- **WHEN** a user clicks the "Following" chip
- **THEN** the USER units that this profile user subscribes to are listed and the URL updates to `?filter=following`

### Requirement: User list display

Each user entry SHALL display: avatar, display name, slug, and bio snippet. For the current user's own profile, each entry SHALL also show a Follow/Unfollow button reflecting the current follow status, where "follow" is implemented as `Subscription(subscriber=viewer, target=otherUser, channels=['*'])` and "unfollow" deletes that row.

#### Scenario: Follower entry renders

- **WHEN** followers are loaded
- **THEN** each follower shows avatar, name, @slug, and bio snippet

#### Scenario: Follow button on own followers

- **WHEN** the current user views their own followers list
- **THEN** each follower entry shows a Follow/Unfollow button based on whether a `Subscription(subscriber=viewer, target=follower, channels contains '*')` row exists

## ADDED Requirements

### Requirement: Data source migration to Subscription

The Followers and Following lists SHALL be served by the subscription service. Followers of profile user P are the set of `Subscription` rows where `targetUnitId = P.unitId` and the subscriber's `Unit.type = USER`. Followings of P are the set where `subscriberUnitId = P.unitId` and the target's `Unit.type = USER`. The legacy `Follow`-table-backed reads SHALL no longer exist.

#### Scenario: Followers query hits Subscription

- **GIVEN** profile user P has 3 USER-typed subscribers and 0 non-USER subscribers
- **WHEN** the Followers list loads
- **THEN** 3 entries are rendered, each corresponding to one of those USER subscribers

# profile-tabs Specification

## Purpose

Owns the five L2 tab views that hang off the profile shell:
Content (post-kind chips with body-search, status/visibility, sort,
pagination), Followers (Followers/Following over the `Subscription`
table with paginated user list and Follow/Unfollow on the owner's
own view), Realms (Joined/Created chips with realm cards), Shelves
(kindKey chips, title search, sort, and the system-shelf label
rule that switches between i18n keys for the owner and DB titles
for non-owners), and Reactions (Given/Received infinite lists
backed by `/profile/:userId/reactions/*` with shared row rendering
and private-profile handling). All filter state lives in URL
search params so tabs deep-link and reload predictably.

## Content tab

### Requirement: L2 chip sub-filters for post kinds
The Content tab SHALL render a row of chip-style filters for post kinds: Reviews, Remarks, Quotes, Posts. The active chip SHALL be visually filled; inactive chips SHALL be outlined. Selecting a chip SHALL update the URL search param `kind` and refetch content.

#### Scenario: Default to Reviews
- **WHEN** a user navigates to the Content tab without a `kind` param
- **THEN** the Reviews chip is active and review posts are displayed

#### Scenario: Switch to Quotes
- **WHEN** a user clicks the "Quotes" chip
- **THEN** the URL updates to `?kind=QUOTE`, the Quotes chip becomes active, and quote posts are fetched

### Requirement: Filter bar with search, status, visibility, and sort
The Content tab SHALL render a filter bar below the L2 chips with:
- A text search input (searches post body text)
- A status dropdown (All, Draft, Published, Archived) — visible only for current user's own profile
- A visibility dropdown (All, Public, Unlisted, Private) — visible only for current user's own profile
- A sort dropdown (Newest, Oldest, Most Replies)

All filter values SHALL be persisted in URL search params.

#### Scenario: Search filters content
- **WHEN** a user types "Dune" in the search input
- **THEN** only posts whose body contains "Dune" are displayed

#### Scenario: Status filter on own profile
- **WHEN** the current user views their own Content tab and selects "Draft" from the status dropdown
- **THEN** only draft posts are shown

#### Scenario: Status filter hidden on other profiles
- **WHEN** a user views another user's Content tab
- **THEN** the status and visibility dropdowns are not rendered (only published public content is shown)

### Requirement: Paginated content list
The Content tab SHALL display posts in a paginated list using the existing `UniversalPaginator` or equivalent. Each list item SHALL show the post body preview, target unit title (if applicable), reaction summary, reply count, and creation date.

#### Scenario: Pagination loads next page
- **WHEN** the user reaches the end of the current page
- **THEN** a pagination control allows navigating to the next page of results

### Requirement: Empty state
When no posts match the current filters, the Content tab SHALL display an empty state message appropriate to the context (e.g., "No reviews yet" or "No results match your filters").

#### Scenario: No content for kind
- **WHEN** the user has no published quotes and the Quotes chip is active
- **THEN** a message "No quotes yet" is displayed

#### Scenario: No search results
- **WHEN** a search query returns zero results
- **THEN** a message "No results match your search" is displayed

## Followers tab

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

### Requirement: Data source migration to Subscription

The Followers and Following lists SHALL be served by the subscription service. Followers of profile user P are the set of `Subscription` rows where `targetUnitId = P.unitId` and the subscriber's `Unit.type = USER`. Followings of P are the set where `subscriberUnitId = P.unitId` and the target's `Unit.type = USER`. The legacy `Follow`-table-backed reads SHALL no longer exist.

#### Scenario: Followers query hits Subscription

- **GIVEN** profile user P has 3 USER-typed subscribers and 0 non-USER subscribers
- **WHEN** the Followers list loads
- **THEN** 3 entries are rendered, each corresponding to one of those USER subscribers

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

## Realms tab

### Requirement: Joined and Created realm filters
The Realms tab SHALL render L2 chips: "Joined" and "Created". "Joined" shows realms where the user is a member. "Created" shows realms owned by the user (`userId` filter). The active filter SHALL be persisted in the URL search param `filter`.

#### Scenario: Default to Joined
- **WHEN** a user navigates to the Realms tab without a `filter` param
- **THEN** the "Joined" chip is active and realms the user has joined are displayed

#### Scenario: Switch to Created
- **WHEN** a user clicks the "Created" chip
- **THEN** realms owned by the user are displayed and the URL updates to `?filter=created`

### Requirement: Realm list display
Each realm entry SHALL display: realm name (from translation), description snippet, member count, and badges for public/official status. Clicking a realm navigates to `/realm/:realmId`.

#### Scenario: Realm entry renders
- **WHEN** realms are loaded
- **THEN** each realm shows name, description, member count, and status badges

### Requirement: Empty state
When the user has no realms for the selected filter, an appropriate empty state SHALL be shown.

#### Scenario: No joined realms
- **WHEN** the user is not a member of any realms and the "Joined" chip is active
- **THEN** a message "Not a member of any realms yet" is displayed

#### Scenario: No created realms
- **WHEN** the user has not created any realms and the "Created" chip is active
- **THEN** a message "No realms created yet" is displayed

## Shelves tab

### Requirement: Shelf grid with kind filter
The Shelves tab SHALL display the user's shelves in a responsive card grid (2 columns mobile, 3-4 columns desktop). An L2 chip row SHALL allow filtering by shelf kind — an "All" chip plus one chip per distinct `kindKey` found in the user's shelves. The active kind filter SHALL be persisted in the URL search param `kindKey`.

#### Scenario: All shelves displayed by default
- **WHEN** a user navigates to the Shelves tab without a `kindKey` param
- **THEN** the "All" chip is active and all shelves belonging to the user are displayed

#### Scenario: Filter by kind
- **WHEN** a user clicks a kind chip (e.g., "reading-list")
- **THEN** only shelves with that `kindKey` are displayed and the URL updates to `?kindKey=reading-list`

### Requirement: Shelf card display
Each shelf card SHALL display: cover image (if available), shelf title (from translation), item count, and the shelf's `kindKey` as a subtle label. Clicking a shelf card navigates to the shelf detail page.

#### Scenario: Shelf card renders
- **WHEN** shelves are loaded
- **THEN** each shelf renders as a card with cover, title, item count, and kind label

### Requirement: Shelf search and sort
The Shelves tab SHALL include a search input to filter shelves by title and a sort dropdown (Newest, Oldest). These SHALL be persisted in URL search params.

#### Scenario: Search shelves by title
- **WHEN** a user types "sci-fi" in the search input
- **THEN** only shelves whose title contains "sci-fi" are displayed

### Requirement: Paginated shelf list
The Shelves tab SHALL support pagination for users with many shelves.

#### Scenario: Pagination controls
- **WHEN** the user has more shelves than fit on one page
- **THEN** pagination controls are rendered to navigate between pages

### Requirement: Empty state
When the user has no shelves (or no shelves matching the filter), an empty state message SHALL be shown.

#### Scenario: No shelves
- **WHEN** the user has zero shelves
- **THEN** a message "No shelves yet" is displayed

### Requirement: System shelf labels render by viewer role

When the Shelves tab renders cards or tab labels for shelves whose `kindKey` ∈ `SYSTEM_SHELF_KIND_KEYS` (`favorites`, `backlog`, `active`, `completed`), the displayed label SHALL be selected according to viewer role:

- **Owner-self view** (the authenticated viewer is the profile owner): the label SHALL be resolved via the application's i18n table keyed on `kindKey` (e.g., `t('shelf.system.favorites')`). The DB-stored shelf title (typically `${slug}'s ${Label}`) SHALL NOT be displayed in this view.
- **Non-owner view** (the viewer is a different user or unauthenticated): the label SHALL be the DB-stored `Unit.translations[viewerLang].title` if present, falling back to the `en` translation (e.g., `alice's Favorites`).

User-created (non-system) shelves SHALL render their DB-stored title regardless of viewer role and SHALL NOT consult the i18n table.

#### Scenario: Owner viewing their own profile sees i18n system shelf labels

- **GIVEN** alice has the four system shelves with DB titles `alice's Favorites`, `alice's Backlog`, `alice's Active`, `alice's Completed`
- **AND** alice's app locale is `zh`
- **WHEN** alice navigates to her own profile's Shelves tab
- **THEN** the four system shelf cards SHALL display the zh i18n results for `shelf.system.favorites`, `shelf.system.backlog`, `shelf.system.active`, and `shelf.system.completed`
- **AND** the literal string `alice's Favorites` (and the three siblings) SHALL NOT appear on the cards

#### Scenario: Non-owner viewing alice's profile sees DB titles

- **GIVEN** alice has the four system shelves with DB titles `alice's Favorites`, `alice's Backlog`, `alice's Active`, `alice's Completed`
- **WHEN** bob navigates to alice's profile's Shelves tab
- **THEN** the visible system shelf cards (subject to shelf visibility filters) SHALL display the DB-stored titles
- **AND** bob's locale-specific i18n keys for `shelf.system.*` SHALL NOT be applied

#### Scenario: User-created shelves render DB title in both views

- **GIVEN** alice has a user-created shelf with DB title `Vintage Sci-Fi`
- **WHEN** alice (owner) or bob (non-owner) navigates to alice's Shelves tab
- **THEN** the shelf card SHALL display `Vintage Sci-Fi`
- **AND** no i18n lookup SHALL apply

## Reactions tab

### Requirement: Reactions tab renders Given and Received list views

The Reactions tab SHALL provide two list views, switchable via the existing InnerFilterPanel chips:

- **Given**: events placed by the profile owner. Backed by `GET /profile/:userId/reactions/given`.
- **Received**: events placed by others on the profile owner's units. Backed by `GET /profile/:userId/reactions/received`.

The default chip on tab open SHALL be "Given". Switching chips SHALL reset scroll position and start the alternate list at its first page.

#### Scenario: Default view is Given
- **WHEN** a user navigates to the Reactions tab on a profile
- **THEN** the "Given" chip is active and the Given list renders

#### Scenario: Switching to Received
- **WHEN** the user clicks the "Received" chip
- **THEN** the active list switches to Received
- **AND** the previous list's scroll position is reset

#### Scenario: Empty Given
- **WHEN** the profile owner has placed no reactions
- **THEN** the Given list renders an empty-state message

#### Scenario: Empty Received
- **WHEN** no other user has reacted to the profile owner's units
- **THEN** the Received list renders an empty-state message

### Requirement: Lists use cursor-paginated infinite scroll

Each list SHALL fetch pages of up to 20 rows via `useGivenReactionsInfinite` or `useReceivedReactionsInfinite`. As the user scrolls near the end of the loaded data, the next page SHALL fetch automatically. The end-of-list state SHALL be visible (e.g. "No more reactions") when `nextCursor` is `null`.

#### Scenario: Auto-fetch next page
- **WHEN** the user scrolls within a configurable threshold of the bottom of the loaded list
- **THEN** the next page query fires automatically and rows append
- **AND** scroll position is preserved across the append

#### Scenario: End-of-list signal
- **WHEN** the most recent response has `nextCursor: null`
- **THEN** an end-of-list indicator renders below the last row

### Requirement: Each row renders via a shared ReactionHistoryItem component

Each row SHALL render via `ReactionHistoryItem` with a `mode: "given" | "received"` prop. The row SHALL display:

- **Always**: the reaction icon/emoji, a relative timestamp, the target's title or snippet, and a `<SafeLink>` to the target's detail page.
- **When `mode = "received"`**: the actor's avatar and display name, with a `<SafeLink>` to the actor's profile.

When `target` is `null` (deleted unit), the row SHALL render with a "[deleted content]" placeholder in place of the target snippet, no link, and otherwise the same metadata.

#### Scenario: Given row renders target
- **WHEN** a Given row renders for a `like` reaction on a post titled "Hello"
- **THEN** the row shows the like icon, the post title, a timestamp, and links to the post detail page

#### Scenario: Received row renders actor and target
- **WHEN** a Received row renders for actor "alice" who liked the profile owner's review
- **THEN** the row shows alice's avatar + display name, a like icon, the review snippet, a timestamp, and links

#### Scenario: Deleted target
- **WHEN** a row's `target` field is `null`
- **THEN** the row renders with a "[deleted content]" placeholder, no target link, and the rest of the row remains intact

### Requirement: Tab respects profile visibility

If the main-server endpoint returns 403 (private profile, unauthorized viewer), the tab SHALL render a "private profile" message rather than a list shell. If the endpoint returns a transient error, the tab SHALL show an error state with a retry control.

#### Scenario: Private profile blocks the tab
- **WHEN** the viewer cannot access the requested profile and the endpoint returns 403
- **THEN** the tab renders a "this profile is private" message

#### Scenario: Transient error
- **WHEN** the endpoint returns a 5xx error
- **THEN** the tab renders a retry control that re-fires the active list query

### Requirement: No MOCK annotations remain

All `// MOCK:` annotations previously in `ReactionsTabSection.tsx` SHALL be removed. The placeholder text "Reaction history is coming soon" SHALL no longer appear.

#### Scenario: Source contains no mock markers
- **WHEN** a developer inspects `package/app/src/user/sections/ReactionsTabSection.tsx`
- **THEN** `rg "// MOCK:" package/app/src/user/sections/ReactionsTabSection.tsx` returns zero matches
- **AND** the string "Reaction history is coming soon" is not present

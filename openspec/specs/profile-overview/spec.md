## ADDED Requirements

### Requirement: Two-column overview layout
The Overview tab SHALL use a two-column layout on desktop (sidebar left, main right) and a single-column stacked layout on mobile (sidebar content first, then main content below the full user info header).

#### Scenario: Desktop renders two columns
- **WHEN** the viewport is `md` or larger
- **THEN** the Overview tab renders a sidebar (~280px) on the left and the main content area on the right

#### Scenario: Mobile renders single column
- **WHEN** the viewport is below `md`
- **THEN** the sidebar content renders below the full user info, followed by the main content

### Requirement: Sidebar stats card
The Overview sidebar SHALL display a stats card showing counts for the user's content: number of shelves, reviews, books, remarks, and quotes. Each count SHALL be a clickable link that navigates to the corresponding profile tab.

#### Scenario: Stats card shows counts
- **WHEN** the Overview tab loads
- **THEN** a stats card displays counts for shelves, reviews, books, remarks, and quotes

#### Scenario: Clicking a stat navigates to tab
- **WHEN** a user clicks the "Reviews: 12" stat
- **THEN** the app navigates to the Content tab with the Reviews chip active

### Requirement: Sidebar keywords display
The Overview sidebar SHALL display the user's keywords (from `GET /users/me/keywords`) as a list or cloud. If the user has no keywords, this section SHALL be hidden.

#### Scenario: Keywords are displayed
- **WHEN** the user has keywords set
- **THEN** the sidebar displays them as chips or a tag cloud

#### Scenario: No keywords hides section
- **WHEN** the user has zero keywords
- **THEN** the keywords section is not rendered

### Requirement: Sidebar realm memberships
The Overview sidebar SHALL display the user's realm memberships as a compact list (realm name, member count). Clicking a realm navigates to `/realm/:realmId`.

#### Scenario: Realm list displays
- **WHEN** the user is a member of realms
- **THEN** the sidebar shows each realm with its name and member count

### Requirement: Main area pinned items
The Overview main area SHALL display a "Pinned" section showing up to 6 content items in a responsive grid (2 columns mobile, 3 columns desktop). Each item shows its type icon, title, and brief metadata.

#### Scenario: Pinned items render
- **WHEN** the Overview tab loads
- **THEN** up to 6 pinned items are displayed in a grid
- **NOTE** This is initially MOCK data (first 6 published units from the user)

### Requirement: Main area recent activity
The Overview main area SHALL display a "Recent Activity" section showing the user's most recent content actions (published units, reviews, scores) in a chronological list.

#### Scenario: Recent activity renders
- **WHEN** the Overview tab loads
- **THEN** a list of recent activities is displayed, ordered by date descending
- **NOTE** This is initially MOCK (derived from recent published units sorted by publishedAt)

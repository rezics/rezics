# profile-overview Specification

## Purpose

Defines the profile Overview tab in `@rezics/app`: its two-column responsive
layout, sidebar stats/keywords/realm surfaces, main-area pinned items and recent
activity, the DESCRIPTION.md box, and the canonical card surfaces used across
these regions.

## Requirements

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

### Requirement: DESCRIPTION.md box in main column
The Overview tab's main column SHALL render a DESCRIPTION.md box above the Pinned section when the user has a description. The box SHALL have a bordered container with a "DESCRIPTION.md" label in the top-left corner. The content SHALL be rendered as markdown via `MarkdownContent`.

#### Scenario: Description box renders above pinned
- **WHEN** the Overview tab loads for a user with a non-empty description
- **THEN** a bordered box labeled "DESCRIPTION.md" appears above the Pinned section, containing the rendered markdown

#### Scenario: No description skips the box
- **WHEN** the Overview tab loads for a user with no description
- **THEN** the DESCRIPTION.md box is not rendered; Pinned is the first main column item

#### Scenario: Markdown styling
- **WHEN** the description contains markdown syntax
- **THEN** it is rendered with `github-markdown-css` styling inside the box

### Requirement: Profile overview uses canonical card surfaces

The profile overview SHALL use Card/token-aligned surfaces for pinned items,
recent activity previews, and compact stats. These surfaces SHALL consume
`@rezics/ui/shadcn` Card directly or through feature-local app components.

#### Scenario: Pinned items render as card surfaces

- **WHEN** the Overview tab renders pinned content items
- **THEN** each pinned item SHALL render as an interactive card-backed preview
  or an equivalent app card component
- **AND** the pinned section itself SHALL remain an unframed layout section

#### Scenario: Recent activity uses token-aligned previews

- **WHEN** the Overview tab renders recent activity items
- **THEN** each activity preview SHALL use Rezics text, surface, spacing, and
  hover tokens
- **AND** it SHALL NOT use raw gray utility classes or ad hoc border colors

#### Scenario: Profile stats use consistent surfaces

- **WHEN** profile stats render in the sidebar or mobile overview area
- **THEN** the stat links SHALL use a shared Card/token-aligned visual pattern
- **AND** each stat SHALL remain keyboard-accessible and navigate to the
  corresponding profile tab or filtered profile view

### Requirement: Profile card surfaces preserve profile behavior

Profile card surface refactors SHALL preserve existing profile routing, current
user detection, follow/edit actions, and mock overview data behavior.

#### Scenario: Existing profile navigation remains unchanged

- **WHEN** a user clicks a profile stat, edit action, follow action, pinned item,
  or tab link after the refactor
- **THEN** the navigation target or action semantics SHALL match the behavior
  before the card surface refactor

#### Scenario: Mock overview data remains display-only

- **WHEN** the Overview tab renders pinned items or recent activity from existing
  mock-derived content search queries
- **THEN** the card surface refactor SHALL NOT introduce persistence claims,
  pin/unpin controls, or activity-stream API behavior

## MODIFIED Requirements

### Requirement: Realm detail exposes mature community tabs

The realm detail page SHALL expose community tabs for feed, tags, members, about, and moderator-only moderation entry when policy allows. The feed tab SHALL be the default entry and SHALL include the pinboard carousel, required rules/update prompts, feed controls, and the discussion stream where available. The about tab SHALL include rules/about, community stats, join policy, and moderator notices where available.

#### Scenario: Moderator sees moderation entry

- **WHEN** a realm moderator opens the realm detail page
- **THEN** the UI SHALL show a Moderation tab or entry for that realm
- **AND** regular members SHALL NOT see that entry

#### Scenario: Visitor opens realm feed

- **WHEN** a visitor opens a realm detail page
- **THEN** the initial tab SHALL present the realm feed
- **AND** the feed SHALL include the pinboard carousel when pinned Units exist
- **AND** the feed SHALL show a required rule or rule-update prompt when the viewer must acknowledge rules before participating

### Requirement: Realm page may use a desktop summary sidebar

Realm detail tabs MAY render a desktop right sidebar for persistent community summary content, but rules/about SHALL remain available in the about tab and rule prompts SHALL remain available from the feed when required. Mobile layouts SHALL render the same content inline without relying on a sidebar.

#### Scenario: Feed page keeps rule summary visible on desktop

- **WHEN** a desktop user opens the feed tab
- **THEN** the page MAY show rule/about/join summary in a right sidebar
- **AND** the about tab SHALL still contain the full rule/about entry points

### Requirement: Pinboard renders as a carousel rail

The public realm pinboard SHALL render as a horizontal carousel or rail using the existing Rezics carousel primitives on the default feed tab. Pinboard cards SHALL support fixed card dimensions, clamped titles, optional cover imagery, author/avatar metadata when available, and stable empty/loading/error states.

#### Scenario: Realm has pinned posts

- **GIVEN** a realm has four visible Unit ids in `Realm.extra.pinboard`
- **WHEN** the feed tab renders
- **THEN** the UI SHALL show a named Pinboard section
- **AND** pinned entries SHALL appear in a horizontal carousel/rail rather than a vertical list

### Requirement: Realm manage route expands beyond metadata

Realm management routes SHALL support rules, members, moderation, pins, tag curation, settings, and ownership flows rather than only metadata editing.

#### Scenario: Admin manages members

- **WHEN** a realm admin opens the members management section
- **THEN** they SHALL be able to filter members by role/state and perform policy-allowed role or state changes

## ADDED Requirements

### Requirement: Public app navigation is organized by user intent

The public app SHALL organize navigation into discovery, library, community, create, and personal areas, with signed-in/out visibility rules.

#### Scenario: Signed-out user sees discovery-first navigation

- **WHEN** an unauthenticated user opens the app
- **THEN** navigation SHALL expose discovery routes and authentication entry points
- **AND** personal-only routes SHALL not appear as active options

### Requirement: Production navigation excludes test routes

Routes used only for diagnostics, experiments, or test pages SHALL NOT appear in production navigation.

#### Scenario: Test route not shown

- **WHEN** a user opens the main sidebar or create menu
- **THEN** entries such as test/demo routes SHALL not be listed

### Requirement: Realm navigation follows the realm product IA

Realm detail navigation SHALL default to Feed, expose About for stable community information, and expose Moderation only to authorized moderators/staff. Queue, reports, sanctions, and audit are subviews of Moderation rather than top-level public tabs.

#### Scenario: Visitor opens a realm from navigation

- **WHEN** a visitor navigates to a realm
- **THEN** the Feed tab SHALL be the initial active tab
- **AND** moderator-only Moderation entries SHALL be hidden

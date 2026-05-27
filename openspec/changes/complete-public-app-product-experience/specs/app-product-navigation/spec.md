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

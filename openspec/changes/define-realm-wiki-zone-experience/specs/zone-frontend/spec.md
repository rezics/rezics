## ADDED Requirements

### Requirement: Zone frontend renders wiki templates
The app SHALL render wiki Zone templates based on the Zone template slug and wiki configuration. Supported wiki templates SHALL include `wiki-classic`, `wiki-media`, `wiki-database`, and `wiki-minimal`, with fallback to a safe wiki default for unknown wiki template slugs.

#### Scenario: Render wiki classic template
- **GIVEN** a Zone DTO has `template = "wiki-classic"`
- **WHEN** a viewer opens the Zone route
- **THEN** the app SHALL render the wiki classic template using Zone wiki configuration

### Requirement: Wiki Zone frontend resolves homepage data
Wiki Zone templates SHALL hydrate homepage sections through typed data loaders or hooks that respect realm scope, viewer permissions, language preferences, and section-specific limits.

#### Scenario: Homepage hydrates translation groups
- **GIVEN** a wiki Zone homepage includes a translation group section
- **WHEN** the Zone page loads
- **THEN** the frontend SHALL request or receive the best-language wiki page data for the configured groups

### Requirement: Wiki Zone frontend applies theme tokens safely
The frontend SHALL apply validated wiki theme tokens inside the Zone page boundary only. It SHALL provide fallback rendering when optional tokens or media are absent.

#### Scenario: Theme scoped to Zone
- **WHEN** a wiki Zone page renders with custom accent and banner tokens
- **THEN** those tokens SHALL style the Zone page content
- **AND** global app chrome SHALL remain unaffected

### Requirement: Wiki Zone navigation is accessible
Wiki Zone navigation SHALL be keyboard accessible, expose meaningful link names after i18n resolution, and avoid hiding core wiki access behind hover-only interactions.

#### Scenario: Keyboard navigation
- **WHEN** a keyboard user tabs through wiki Zone navigation
- **THEN** every visible navigation item SHALL be reachable and activatable

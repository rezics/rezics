# wiki-zone-theme Specification

## Purpose
TBD - created by archiving change define-realm-wiki-zone-experience. Update Purpose after archive.
## Requirements
### Requirement: Wiki Zone theme uses restricted tokens
Wiki Zone visual customization SHALL be expressed through restricted theme tokens. Supported token groups SHALL include palette, media, chrome, and wiki layout settings. Arbitrary CSS, script injection, and unvalidated style objects SHALL NOT be accepted.

#### Scenario: Theme tokens accepted
- **WHEN** a manager saves a wiki Zone theme with supported palette and media tokens
- **THEN** the server SHALL validate and persist the tokens

#### Scenario: Arbitrary CSS rejected
- **WHEN** a manager submits a theme config containing raw CSS
- **THEN** the server SHALL reject the configuration

### Requirement: Built-in wiki templates interpret theme tokens
The frontend SHALL provide built-in wiki Zone templates including `wiki-classic`, `wiki-media`, `wiki-database`, and `wiki-minimal`. Each template SHALL interpret the same validated theme token contract according to its layout.

#### Scenario: Media template renders banner
- **GIVEN** a Zone uses `template = "wiki-media"` and provides a `bannerImage`
- **WHEN** the Zone page renders
- **THEN** the media template SHALL render the banner according to its safe layout rules

### Requirement: Wiki theme applies only to Zone pages
Wiki theme tokens SHALL apply to wiki Zone pages and SHALL NOT alter the realm detail page shell, realm Wiki tab shell, release detail shell, global navigation, or unrelated app routes.

#### Scenario: Realm Wiki tab remains uniform
- **GIVEN** realm `realm-fate` has a wiki Zone with custom theme tokens
- **WHEN** a viewer opens the realm Wiki tab
- **THEN** the tab SHALL use the uniform Rezics app theme
- **AND** the custom tokens SHALL apply only after navigating to the Zone page

### Requirement: Theme validation preserves accessibility
Theme validation SHALL reject or adjust unsafe values that would make core text unreadable or primary actions inaccessible. Templates SHALL provide safe fallbacks for missing or invalid media.

#### Scenario: Low contrast rejected
- **WHEN** a manager submits palette tokens that fail the configured contrast rule for primary text
- **THEN** the server or client validation SHALL reject the save or require correction

#### Scenario: Missing image falls back
- **WHEN** a theme references a missing banner image
- **THEN** the template SHALL render a safe fallback layout without breaking page content

### Requirement: Theme presets are seedable
The system SHALL provide seedable theme presets for the built-in wiki templates so development and demos can exercise classic, media-rich, database, and minimal wiki experiences.

#### Scenario: Seed creates preset wiki zones
- **WHEN** seed fixtures create demo wiki realms
- **THEN** they SHALL include examples using the built-in wiki templates and valid theme tokens


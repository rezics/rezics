# app-header-search Specification

## Purpose

Defines the app header search entry point and the
header-vs-content height contract. Owns the 56px desktop / 49px
mobile fixed header height with matching content offset, the
inline desktop search input with the rezics-logo leading
adornment, the mobile search icon button (suppressed on the home
page in favor of the page-level box), and the presentation-only
`r/{title}` / `u/{slug}` scope badges on realm and user routes.

## Requirements

### Requirement: Responsive Header Height

The app header SHALL use a fixed visual height of 56px on desktop layouts and
49px on mobile layouts. The main content offset SHALL match the active header
height so page content is not hidden under the fixed header and does not leave a
visible gap.

#### Scenario: Desktop header offset

- **GIVEN** the viewport is desktop width
- **WHEN** the main app layout renders
- **THEN** the header SHALL occupy 56px of vertical space
- **AND** the main content SHALL start below a 56px top offset

#### Scenario: Mobile header offset

- **GIVEN** the viewport is mobile width
- **WHEN** the main app layout renders
- **THEN** the header SHALL occupy 49px of vertical space
- **AND** the main content SHALL start below a 49px top offset

### Requirement: Header Search Entry Presentation

The app header SHALL render a route-aware search entry. On desktop, the search
entry SHALL render as an inline search input. On mobile, the search entry SHALL
render as a search icon button except on the home page.

#### Scenario: Desktop global search entry

- **GIVEN** a desktop user is on a normal app route outside realm/user scope
- **WHEN** the header renders
- **THEN** it SHALL show an inline search input
- **AND** the input SHALL use the rezics logo as the leading adornment
- **AND** submitting the input SHALL navigate to the existing global search route

#### Scenario: Mobile home keeps page-level search

- **GIVEN** a mobile user is on the home page
- **WHEN** the header renders
- **THEN** the header SHALL NOT show a search icon button
- **AND** the home page SHALL keep rendering its page-level search box

#### Scenario: Mobile non-home search icon

- **GIVEN** a mobile user is on a normal app route other than home
- **WHEN** the header renders
- **THEN** it SHALL show a compact search icon button
- **AND** activating the button SHALL navigate to the existing global search
  route

### Requirement: Header Search Scope Badges

The desktop header search input SHALL show a scoped badge on realm and user
routes. The badge is presentation-only for this change and SHALL NOT imply that
new scoped/federated search result semantics have been implemented.

#### Scenario: Realm route badge

- **GIVEN** a desktop user is on a realm route with an available localized realm
  title
- **WHEN** the header search entry renders
- **THEN** it SHALL show a search icon leading affordance
- **AND** it SHALL show a badge labeled `r/{localizedTitle}`

#### Scenario: User route badge

- **GIVEN** a desktop user is on a user route with an available username or slug
- **WHEN** the header search entry renders
- **THEN** it SHALL show a search icon leading affordance
- **AND** it SHALL show a badge labeled `u/{usernameOrSlug}`

#### Scenario: Basic search behavior retained

- **GIVEN** the user submits a realm or user header search
- **WHEN** this change is the only implemented search change
- **THEN** the app SHALL use the existing global/basic search navigation
- **AND** it SHALL NOT require backend, Meili, or federated search changes

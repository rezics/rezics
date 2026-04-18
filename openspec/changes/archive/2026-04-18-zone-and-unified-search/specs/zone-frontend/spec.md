## ADDED Requirements

### Requirement: Zone routes

The app SHALL register the following routes:
- `/zone/:slug` — zone homepage
- `/zone/:slug/search` — zone search page
- `/z/:slug` — short alias, redirects to `/zone/:slug`
- `/z/:slug/search` — short alias, redirects to `/zone/:slug/search`

#### Scenario: Navigate to zone homepage

- **WHEN** a user navigates to `/zone/light-novel`
- **THEN** the app SHALL fetch the zone by slug and render the zone homepage

#### Scenario: Short alias redirects

- **WHEN** a user navigates to `/z/light-novel`
- **THEN** the app SHALL redirect to `/zone/light-novel`

#### Scenario: Zone not found

- **WHEN** a user navigates to `/zone/nonexistent-slug`
- **THEN** the app SHALL display a 404 page

#### Scenario: Zone outside lifecycle

- **WHEN** a user navigates to a zone that has not started or has ended
- **THEN** the app SHALL display an appropriate status page (not yet open / ended)

### Requirement: Zone homepage renders via template system

The zone homepage SHALL select a template component based on the `zone.template` field. Template components are located in the `zone/template/` folder, each named by its slug (e.g., `book.tsx`, `default.tsx`). The selected template SHALL receive the zone's `filters`, `styling`, and translated metadata as props.

#### Scenario: Zone with book template

- **GIVEN** a zone with `template: "book"`
- **WHEN** the zone homepage renders
- **THEN** the `book.tsx` template SHALL be used
- **AND** the template SHALL display content queried with the zone's filters applied

#### Scenario: Zone with styling overrides

- **GIVEN** a zone with `styling: { bgImage: "https://...", accentColor: "#ff6b6b" }`
- **WHEN** the zone homepage renders
- **THEN** the template SHALL apply the background image and accent color

#### Scenario: Unknown template falls back to default

- **GIVEN** a zone with `template: "unknown-slug"`
- **WHEN** the zone homepage renders
- **THEN** the `default.tsx` template SHALL be used as fallback

### Requirement: Zone templates compose existing sections

Zone templates SHALL import and compose sections from existing features (`book-library`, `home`, etc.) via their public `index.ts` exports. Templates SHALL NOT duplicate section logic — they assemble existing building blocks with zone-specific configuration.

#### Scenario: Book template reuses book-library sections

- **GIVEN** the `book.tsx` zone template
- **WHEN** it renders
- **THEN** it SHALL use sections exported from `book-library` and/or `home` features (e.g., trending books, new books)
- **AND** data queries within those sections SHALL include the zone's `filters` as base conditions

### Requirement: Zone search page integrates shared search feature

The zone search page (`/zone/:slug/search`) SHALL use the shared search feature components (`BasicSearch`, `AdvancedSearch`) with the zone's `filters` as pre-applied conditions. Users SHALL be able to add additional filters on top of the zone's base filters.

#### Scenario: Zone search with pre-applied filters

- **GIVEN** a zone with `filters: { type: ["BOOK"], tags: [{ slug: "light-novel" }] }`
- **WHEN** a user opens `/zone/light-novel/search`
- **THEN** the search SHALL execute with `type: ["BOOK"]` and the light-novel tag pre-applied
- **AND** the user MAY add additional keyword or filter criteria

#### Scenario: Advanced search shows zone filters as applied conditions

- **WHEN** a user opens advanced search from a zone context
- **THEN** the zone's pre-applied filters SHALL be visible as applied condition chips
- **AND** the user MAY remove these conditions to broaden the search scope

### Requirement: Zone feature folder structure

The zone feature SHALL reside in `package/app/src/zone/` and follow the standard feature layering with an additional `template/` layer:

| Layer        | Purpose                                              |
|--------------|------------------------------------------------------|
| `models/`      | ZoneDTO types, filter merge utilities                |
| `hooks/`       | useZone, useZoneFilters                              |
| `states/`      | Zone config state                                    |
| `components/`  | Zone-specific UI atoms                               |
| `sections/`    | Zone-specific business blocks                        |
| `templates/`   | Homepage templates, named by slug                    |
| `pages/`       | ZoneHomePage, ZoneSearchPage (thin route entries)     |
| `index.ts`   | Public exports                                       |

#### Scenario: External consumer imports from zone feature

- **GIVEN** another feature needs zone-related types or components
- **WHEN** it imports from the zone feature
- **THEN** it SHALL import from `@/zone` (the `index.ts` barrel export)

## ADDED Requirements

### Requirement: Admin content operations cover all Unit domains

The admin panel SHALL provide operator views for Unit, book, media, game, entity, tag, shelf, realm, source-site attribution, work/release, and history-related content operations.

Admin content operations SHALL preserve shared metadata boundaries. Localized
titles, summaries, descriptions, and covers SHALL continue to flow through
UnitTranslation/editor patterns; admin pages SHALL NOT introduce admin-only
localized title fields or bypass normal UnitTranslation resolution.

#### Scenario: Admin searches all Units

- **WHEN** an admin searches by unit id, slug, title, type, owner, status, or visibility
- **THEN** the admin panel SHALL return matching Units across all supported types

### Requirement: Content operations distinguish repair from contribution

Admin content mutations SHALL be framed as authority or repair operations and SHALL not replace normal public contribution/editor workflows.

#### Scenario: Admin edits verified entity slug

- **WHEN** an admin edits an entity slug
- **THEN** the action SHALL use the authority API, validate slug rules, and write audit metadata

### Requirement: Work/release repair is supported

Admin content operations SHALL expose work/release grouping, merge/move previews, projection repair, and drift diagnostics when `introduce-unit-work-domain` is active.

#### Scenario: Admin previews work merge

- **WHEN** an admin previews a work merge
- **THEN** the UI SHALL show affected releases, content memberships, search repair scope, and revert eligibility

## MODIFIED Requirements

### Requirement: Homepage connects discovery and personal continuation

The homepage SHALL be a usable discovery surface, not a marketing-only landing page. It SHALL show discovery modules to all users and MAY show signed-in continuation modules such as continue reading, shelves, joined realms, and notifications. Private continuity-heavy surfaces MAY link to or route into the signed-in dashboard, but the public homepage SHALL remain useful without authentication.

#### Scenario: Signed-in homepage includes continuation

- **WHEN** a signed-in user with reading progress opens the homepage
- **THEN** the page SHALL include a continue reading module that links to the current release/reader context

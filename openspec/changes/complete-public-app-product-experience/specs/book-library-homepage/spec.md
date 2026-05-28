## MODIFIED Requirements

### Requirement: Homepage connects discovery and personal continuation

The homepage SHALL be a usable discovery surface, not a marketing-only landing page. It SHALL show discovery modules to all users and MAY show signed-in continuation modules such as continue reading, shelves, joined realms, and notifications. Private continuity-heavy surfaces MAY link to or route into the signed-in dashboard, but the public homepage SHALL remain useful without authentication.

#### Scenario: Signed-in homepage includes continuation

- **GIVEN** a signed-in user whose `UserUnitProgress` row for a book has a non-null `lastReadNodeId`
- **WHEN** they open the homepage
- **THEN** the page SHALL include a continue reading module showing the book, the chapter title resolved from the loaded TOC for `lastReadNodeId`, and (when present) a short preview of `lastReadAnchor.text`
- **AND** activating the module SHALL navigate to `/book/:bookId/node/:nodeId` using `lastReadNodeId`, preserving multi-link TOC identity
- **AND** when the book Unit has no TOC (legacy chapter-only Unit), the module MAY fall back to `/book/:bookId/read/:chapterId`

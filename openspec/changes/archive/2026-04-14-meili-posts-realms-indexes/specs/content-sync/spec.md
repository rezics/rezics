## ADDED Requirements

### Requirement: Author profile change triggers bulk post re-sync
When a user's profile (name, slug, avatar) is updated via `user.service`, the system SHALL re-sync all posts authored by that user to update denormalized author fields in the posts index.

#### Scenario: Author name change re-syncs posts
- **GIVEN** user "Alice" has 50 posts in the posts index
- **WHEN** Alice updates her name to "Alice W."
- **THEN** all 50 post documents SHALL be updated with `authorName: "Alice W."`

#### Scenario: Author avatar change re-syncs posts
- **GIVEN** user "Bob" has 20 posts in the posts index
- **WHEN** Bob updates his avatar
- **THEN** all 20 post documents SHALL be updated with the new `authorAvatar`

### Requirement: Target unit translation change triggers post re-sync
When a target unit's UnitTranslation is updated, the system SHALL re-sync all posts that reference that target unit to update denormalized `targetTitles` in the posts index.

#### Scenario: Book title change re-syncs related reviews
- **GIVEN** a book "Old Title" with 10 review posts targeting it
- **WHEN** the book's title is updated to "New Title"
- **THEN** all 10 post documents SHALL be updated with `targetTitles` reflecting "New Title"

### Requirement: Admin init/sync/delete endpoints for posts and realms indexes
The server SHALL expose admin-only (root role) endpoints for the posts and realms indexes following the same pattern as the existing content index admin endpoints:
- `POST /meili/posts/init` — initialize index settings
- `POST /meili/posts/sync` — full reindex from database
- `DELETE /meili/posts/deleteAll` — delete all documents
- `POST /meili/realms/init` — initialize index settings
- `POST /meili/realms/sync` — full reindex from database
- `DELETE /meili/realms/deleteAll` — delete all documents

#### Scenario: Root user initializes posts index
- **GIVEN** an authenticated user with role `ROOT`
- **WHEN** they call `POST /meili/posts/init`
- **THEN** the posts index SHALL be created/updated with the correct settings

#### Scenario: Root user triggers full realm reindex
- **GIVEN** an authenticated user with role `ROOT`
- **WHEN** they call `POST /meili/realms/sync`
- **THEN** all qualifying realms SHALL be synced to the realms index

#### Scenario: Non-root user denied admin endpoints
- **GIVEN** an authenticated user with role `USER`
- **WHEN** they call any posts or realms admin endpoint
- **THEN** they SHALL receive a 403 response

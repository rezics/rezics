## MODIFIED Requirements

### Requirement: Settings is the user control center

Settings SHALL include profile, account, preferences, security, connections, notification/privacy, tokens, and safety/moderation status sections where relevant.

#### Scenario: User updates notification preference

- **WHEN** a user changes a notification preference
- **THEN** the change SHALL persist through typed API mutation
- **AND** notification behavior SHALL reflect the saved preference

### Requirement: Settings exposes library display preferences

Settings SHALL expose a library-display preference panel that lets the user edit the `BookshelfViewConfig` stored in `userSettings.library.bookshelf` — including responsive `breakpoints` (minWidthPx + columns) and `showTitle` — and SHALL provide a reset action that clears the stored preference so subsequent rendering falls back to `DEFAULT_BOOKSHELF_CONFIG` from `@rezics/contract`.

#### Scenario: User updates bookshelf columns

- **WHEN** a user changes their bookshelf preference to 6 columns at the largest breakpoint
- **THEN** the change SHALL persist through the typed `userSettings` mutation
- **AND** subsequent bookshelf views without a URL override SHALL render at 6 columns at that breakpoint

#### Scenario: User resets to contract default

- **WHEN** the user activates the reset action on the library-display preference panel
- **THEN** `userSettings.library.bookshelf` SHALL be cleared
- **AND** bookshelf views without URL override SHALL fall back to `DEFAULT_BOOKSHELF_CONFIG`

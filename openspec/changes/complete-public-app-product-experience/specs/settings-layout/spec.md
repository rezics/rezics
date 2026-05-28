## MODIFIED Requirements

### Requirement: Settings is the user control center

Settings SHALL include profile, account, preferences, security, connections, notification/privacy, tokens, and safety/moderation status sections where relevant.

#### Scenario: User updates notification preference

- **WHEN** a user changes a notification preference
- **THEN** the change SHALL persist through typed API mutation
- **AND** notification behavior SHALL reflect the saved preference

### Requirement: Notification preference UI is per-kind

Notification settings SHALL expose per-kind toggles (reply, follow, DM, moderation outcome, realm event, system notice) so the user can opt in or out of each notification category independently.

#### Scenario: User disables follow notifications

- **WHEN** a user disables the follow-notification toggle
- **THEN** new follow notifications SHALL NOT appear in the user's feed or push channels
- **AND** other categories SHALL continue to deliver

### Requirement: Settings exposes blocked-users management

Settings SHALL provide a blocked-users sub-page where a user can view, add, and remove blocked users. Blocking SHALL hide content and prevent DM from the blocked user, scoped by the foundation's policy engine.

#### Scenario: User unblocks a peer

- **WHEN** a user removes a peer from the blocked list
- **THEN** the change SHALL persist through typed API mutation
- **AND** the peer's content SHALL become visible to the user on next fetch

### Requirement: Settings exposes data export and account deletion

Settings SHALL provide entry points for user data export and account deletion, each backed by typed API endpoints with explicit confirmation. Deletion SHALL describe what is removed, anonymized, or retained for safety/audit reasons before the user confirms.

#### Scenario: User initiates account deletion

- **WHEN** a user activates account deletion
- **THEN** the UI SHALL present a confirmation step describing data handling
- **AND** SHALL NOT proceed without explicit confirmation

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

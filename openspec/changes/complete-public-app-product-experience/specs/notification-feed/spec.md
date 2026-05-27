## MODIFIED Requirements

### Requirement: Notification feed supports actionable workflow entries

Notification feed items SHALL include target routing metadata, safe actor/target summaries, read/unread controls, and action-specific states for replies, follows, DMs, moderation, realm events, and system notices.

#### Scenario: Moderation notification opens case-safe detail

- **WHEN** a user activates a moderation outcome notification
- **THEN** the app SHALL navigate to a safe detail or status surface appropriate to that user's authorization

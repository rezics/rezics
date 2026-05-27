## MODIFIED Requirements

### Requirement: Settings is the user control center

Settings SHALL include profile, account, preferences, security, connections, notification/privacy, tokens, and safety/moderation status sections where relevant.

#### Scenario: User updates notification preference

- **WHEN** a user changes a notification preference
- **THEN** the change SHALL persist through typed API mutation
- **AND** notification behavior SHALL reflect the saved preference

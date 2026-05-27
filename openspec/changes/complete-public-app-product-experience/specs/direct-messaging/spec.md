## MODIFIED Requirements

### Requirement: Direct messaging integrates with profile and notification flows

DM surfaces SHALL connect from profile actions, notification entries, and inbox routes while respecting subscription/channel permission and account enforcement.

#### Scenario: User opens DM from profile

- **WHEN** a user activates DM on a profile where permission allows messaging
- **THEN** the app SHALL open or create the conversation and route to the inbox context

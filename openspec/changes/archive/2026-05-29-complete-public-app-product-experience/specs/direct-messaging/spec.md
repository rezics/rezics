## MODIFIED Requirements

### Requirement: Direct messaging integrates with profile and notification flows

DM surfaces SHALL connect from profile actions, notification entries, and inbox routes while respecting subscription/channel permission and account enforcement.

#### Scenario: User opens DM from profile

- **WHEN** a user activates DM on a profile where permission allows messaging
- **THEN** the app SHALL open or create the conversation and route to the inbox context

### Requirement: DM thread shows read receipts and typing indicator

DM threads SHALL show per-message read receipts when both peers have receipts enabled, and a transient typing indicator when the peer is actively composing. Both signals SHALL be permission-gated and SHALL respect the user's privacy preference.

#### Scenario: Peer reads a message

- **WHEN** the peer opens the conversation and the message becomes read
- **THEN** the sender's message SHALL display a read receipt with the read timestamp
- **AND** the indicator SHALL NOT appear if either side has disabled receipts

### Requirement: User can block and unblock a DM peer

DM SHALL provide block and unblock controls reachable from the profile DM action and from the conversation header. Blocking SHALL prevent the blocked peer from sending further messages and SHALL hide their existing thread from the inbox per the foundation's policy.

#### Scenario: User blocks a peer from the conversation header

- **WHEN** a user activates block on a conversation header
- **THEN** the block SHALL persist through typed mutation
- **AND** subsequent messages from the peer SHALL be rejected by the server

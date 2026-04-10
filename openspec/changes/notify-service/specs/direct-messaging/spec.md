## ADDED Requirements

### Requirement: Bilateral conversations
The system SHALL support bilateral (two-party) conversations. Participants SHALL be stored in lexicographic order to ensure the unique constraint `(participantA, participantB)` is order-independent.

#### Scenario: Conversation created on first message
- **WHEN** user A sends a message to user B for the first time (via server-mediated flow)
- **THEN** a conversation is created with `participantA=min(A,B)`, `participantB=max(A,B)`
- **AND** the message is persisted in that conversation

#### Scenario: Existing conversation reused
- **WHEN** user B sends a message to user A and a conversation already exists between them
- **THEN** the message is added to the existing conversation (no duplicate created)

### Requirement: Server-mediated DM sends
All DM send operations SHALL route through the server (`POST /dm/send`). The server validates permissions (follow status, blocks, org membership) before forwarding to Notify's `POST /internal/dm`. The frontend SHALL NOT send messages directly to Notify.

#### Scenario: Authorized send
- **WHEN** user A sends a DM to user B via `POST /dm/send` on the server
- **AND** the server confirms A is allowed to message B
- **THEN** the server forwards to Notify's `POST /internal/dm`
- **AND** the message is persisted and pushed to B via WebSocket

#### Scenario: Unauthorized send rejected
- **WHEN** user A sends a DM to user B via `POST /dm/send` on the server
- **AND** the server determines A is blocked by B
- **THEN** the server rejects the request with 403 and does NOT call Notify

### Requirement: WebSocket receive-only delivery
The system SHALL provide `WS /dm?token=<jwt>` for real-time message delivery. This channel is receive-only from the frontend's perspective — clients connect and receive incoming messages but do not send messages over the WebSocket.

#### Scenario: Recipient receives message in real-time
- **WHEN** user B has an active WebSocket connection
- **AND** a message from user A is persisted for their conversation
- **THEN** user B receives the message on their WebSocket connection

#### Scenario: WebSocket authentication via query parameter
- **WHEN** a client connects to `WS /dm?token=<jwt>`
- **THEN** the JWT is validated immediately on connection open
- **AND** connections that fail validation are closed with code 4001

### Requirement: Conversation list
The system SHALL provide `GET /dm/conversations` returning all conversations the authenticated user participates in, sorted by most recent activity (`updatedAt` descending).

#### Scenario: List user's conversations
- **WHEN** user A requests `GET /dm/conversations`
- **THEN** the response contains all conversations where A is participantA or participantB
- **AND** results are sorted by `updatedAt` descending

### Requirement: Message history
The system SHALL provide `GET /dm/conversations/:id/messages` with pagination, returning messages in reverse chronological order. The endpoint SHALL verify the authenticated user is a participant of the conversation.

#### Scenario: Fetch message history
- **WHEN** user A requests messages for a conversation they participate in
- **THEN** the response contains paginated messages sorted by `createdAt` descending

#### Scenario: Non-participant denied access
- **WHEN** user C requests messages for a conversation between A and B
- **THEN** the request is rejected with 404

### Requirement: Message read tracking
Each message SHALL have a `readAt` timestamp, set when the recipient reads the message. The sender's own messages are not tracked for read status.

#### Scenario: Mark messages as read
- **WHEN** user B opens a conversation with user A
- **THEN** all unread messages from A in that conversation are marked with `readAt=now()`

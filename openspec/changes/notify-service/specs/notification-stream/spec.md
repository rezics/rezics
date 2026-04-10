## ADDED Requirements

### Requirement: SSE notification stream
The system SHALL provide `GET /stream` as a Server-Sent Events endpoint that pushes real-time notification events to authenticated users.

#### Scenario: Connected user receives live notification
- **WHEN** recipient R has an active SSE connection on `GET /stream`
- **AND** a new LIKE event is emitted for recipient R
- **THEN** the raw notification event is pushed to R's SSE stream immediately

#### Scenario: Disconnected user receives notification on next load
- **WHEN** recipient R has no active SSE connection
- **AND** a new LIKE event is emitted for recipient R
- **THEN** the notification is persisted and R retrieves it via `GET /notifications` on next load

### Requirement: SSE pushes raw events
The SSE stream SHALL push individual raw events (same shape as a single notification row). The frontend is responsible for merging raw events into its local aggregated state.

#### Scenario: Raw event shape
- **WHEN** a LIKE event is pushed via SSE
- **THEN** the event data contains `id`, `type`, `actorId`, `entityType`, `entityId`, `meta`, `createdAt` — not an aggregated group

### Requirement: Heartbeat keep-alive
The SSE stream SHALL emit a comment frame (`:heartbeat`) every 30 seconds to prevent proxy/load-balancer idle timeouts.

#### Scenario: Idle connection kept alive
- **WHEN** no events are emitted for 30 seconds on an active SSE connection
- **THEN** a `:heartbeat` comment frame is sent to the client

### Requirement: Multi-connection support
The system SHALL support multiple concurrent SSE connections per user (e.g., multiple browser tabs). Each connection SHALL receive all events for that user.

#### Scenario: Two tabs receive same event
- **WHEN** user R has SSE connections from tab A and tab B
- **AND** a notification event is emitted for R
- **THEN** both tab A and tab B receive the event

### Requirement: In-process fan-out
SSE subscriber state SHALL be held in-process as a map from `userId` to `Set<connection>`. This is a single-instance design.

#### Scenario: Connection cleanup on disconnect
- **WHEN** a client disconnects from the SSE stream
- **THEN** the connection is removed from the subscriber map for that userId

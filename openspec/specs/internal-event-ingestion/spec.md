## ADDED Requirements

### Requirement: Internal notification event endpoint
The system SHALL provide `POST /internal/event` for trusted backend services to emit notification events. The endpoint SHALL accept: `recipientId`, `type`, `actorId` (optional), `entityType`, `entityId`, and `meta` (JSON snapshot).

#### Scenario: Server emits like notification
- **WHEN** the server calls `POST /internal/event` with `{ recipientId: R, type: LIKE, actorId: A, entityType: book, entityId: 123, meta: { entityTitle: "..." } }`
- **THEN** Notify persists the notification row and pushes to SSE if R is connected

#### Scenario: Auth emits invitation notification
- **WHEN** the auth service calls `POST /internal/event` with `{ recipientId: R, type: INVITATION, actorId: null, entityType: organization, entityId: org1, meta: { orgName: "..." } }`
- **THEN** Notify persists the notification row as a SYSTEM-like event

### Requirement: Internal DM endpoint
The system SHALL provide `POST /internal/dm` for the server to forward validated DM sends. The endpoint SHALL accept: `senderId`, `recipientId`, and `content`. Notify SHALL upsert the conversation (lexicographic participant ordering) and persist the message.

#### Scenario: Server forwards DM
- **WHEN** the server calls `POST /internal/dm` with `{ senderId: A, recipientId: B, content: "hello" }`
- **THEN** Notify upserts a conversation between A and B, inserts the message, and pushes to B via WebSocket

### Requirement: Shared secret authentication
Internal endpoints SHALL require the `x-internal-secret` header matching `NOTIFY_INTERNAL_SECRET`. Requests without a valid secret SHALL be rejected with 401.

#### Scenario: Valid secret accepted
- **WHEN** a request to `/internal/event` includes `x-internal-secret` matching `NOTIFY_INTERNAL_SECRET`
- **THEN** the request is processed

#### Scenario: Missing or invalid secret rejected
- **WHEN** a request to `/internal/event` is missing the `x-internal-secret` header or the value does not match
- **THEN** the request is rejected with 401

### Requirement: Synchronous best-effort delivery
Event ingestion SHALL be synchronous — persist the notification/message and attempt real-time push (SSE or WebSocket) in the same request cycle. If the recipient is not connected, the event is persisted only. There is no retry or queue.

#### Scenario: Recipient not connected
- **WHEN** a notification event is emitted for recipient R who has no active SSE connection
- **THEN** the notification is persisted successfully
- **AND** no error is returned to the emitting service

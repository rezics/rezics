# internal-event-ingestion Specification

## Purpose

Defines the `POST /internal/event` and `POST /internal/dm` boundaries
between the server and the notify service. Recipient resolution stays
on the server (notify never queries the Subscription table itself);
notify batches one notification row per recipient via `createMany` and
attempts SSE push in the same request cycle. The `kind` field is
validated against the contract `KIND_REGISTRY`. Endpoints are gated on
the `x-internal-secret` shared secret. Delivery is synchronous and
best-effort — SSE push failures are logged but never fail the
persistence batch.

## Requirements

### Requirement: Internal notification event endpoint

The system SHALL provide `POST /internal/event` for trusted backend services to emit notification events. The endpoint SHALL accept a broadcast-shaped body: `{ kind: string, sourceUnitId: string, recipientIds: string[], actorId?: string, extra?: Json }`. Recipient resolution SHALL be performed by the caller (the server) before the request — notify SHALL NOT compute recipients itself, since the substrate that determines recipients (the `Subscription` table introduced by `engagement-subscription`) lives in the server database. Notify SHALL persist one notification row per recipient via a single batched insert (`prisma.notification.createMany`) and SSE-push to each connected recipient in the same request cycle.

The legacy single-recipient body shape `{ recipientId, type, entityType, entityId, meta }` SHALL be removed. The closed `NotificationType` enum SHALL be dropped from notify's Prisma schema; `kind` is a free-form `String` validated against the `KIND_REGISTRY` declared in `@rezics/contract`.

#### Scenario: Server emits broadcast event for multiple recipients

- **WHEN** the server calls `POST /internal/event` with `{ kind: 'reaction.like', sourceUnitId: U, recipientIds: [R1, R2, R3], actorId: A, extra: { unitTitle: '...' } }`
- **THEN** notify persists three notification rows (one per recipient) via a single `createMany` insert and pushes the raw event to each of R1, R2, R3 over their SSE connections if connected

#### Scenario: Server emits direct-addressed event

- **WHEN** the server calls `POST /internal/event` with `{ kind: 'mention.new', sourceUnitId: P, recipientIds: [M], actorId: A, extra: { postExcerpt: '...' } }`
- **THEN** notify persists one notification row for M and pushes the raw event to M's SSE connections if connected

#### Scenario: Empty recipientIds short-circuits

- **WHEN** notify receives `POST /internal/event` with `recipientIds: []`
- **THEN** no rows are persisted, no SSE pushes occur, and the response is `{ success: true, persisted: 0 }`

#### Scenario: Unknown kind rejected

- **WHEN** notify receives `POST /internal/event` with a `kind` that is not in `KIND_REGISTRY` (e.g., `kind: 'totally-made-up'`)
- **THEN** the request is rejected with 400 and no rows are persisted

#### Scenario: Auth emits invitation notification

- **WHEN** the auth service calls `POST /internal/event` with `{ kind: 'invitation.new', sourceUnitId: orgUnitId, recipientIds: [R], extra: { orgName: '...' } }`
- **THEN** notify persists the notification row and pushes via SSE if R is connected

### Requirement: Internal DM endpoint

The system SHALL provide `POST /internal/dm` for the server to forward validated DM sends. The endpoint SHALL accept: `senderId`, `recipientId`, and `content`. Notify SHALL upsert the conversation (lexicographic participant ordering) and persist the message. Permission gating (whether the sender is allowed to message the recipient) is the server's responsibility and is unchanged by this capability change.

#### Scenario: Server forwards DM

- **WHEN** the server calls `POST /internal/dm` with `{ senderId: A, recipientId: B, content: "hello" }`
- **THEN** notify upserts a conversation between A and B, inserts the message, and pushes to B via WebSocket

### Requirement: Shared secret authentication

Internal endpoints SHALL require the `x-internal-secret` header matching `NOTIFY_INTERNAL_SECRET`. Requests without a valid secret SHALL be rejected with 401.

#### Scenario: Valid secret accepted

- **WHEN** a request to `/internal/event` includes `x-internal-secret` matching `NOTIFY_INTERNAL_SECRET`
- **THEN** the request is processed

#### Scenario: Missing or invalid secret rejected

- **WHEN** a request to `/internal/event` is missing the `x-internal-secret` header or the value does not match
- **THEN** the request is rejected with 401

### Requirement: Synchronous best-effort delivery

Event ingestion SHALL be synchronous — persist the notification rows and attempt real-time push (SSE) in the same request cycle. If a recipient is not connected, that recipient's row is persisted only. There is no retry or queue. The persistence path SHALL succeed for the entire batch even if SSE push to one or more recipients fails (SSE failures are logged but do not fail the request).

#### Scenario: Recipient not connected

- **WHEN** a broadcast event is emitted with `recipientIds: [R1, R2]` and only R1 has an active SSE connection
- **THEN** rows are persisted for both R1 and R2, R1 receives the SSE push, R2 does not, and no error is returned

#### Scenario: SSE push failure does not fail persistence

- **WHEN** a broadcast event's SSE push to R1 throws (e.g., connection closed mid-iteration)
- **THEN** the failure is logged, the persistence batch remains committed, and the response remains `{ success: true, persisted: N }`

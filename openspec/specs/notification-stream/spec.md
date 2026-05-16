## ADDED Requirements

### Requirement: SSE notification stream with cookie auth

The system SHALL provide `GET /stream` as a Server-Sent Events endpoint that pushes real-time notification events to authenticated users. Authentication SHALL be performed via the `rezics-session-token` cookie sent on the SSE handshake (under `subdomain-trust-boundary`'s `Domain=.rezics.com` cookie scope). The frontend SHALL open the stream with `new EventSource(url, { withCredentials: true })` so the browser includes the cookie on the cross-origin handshake within the same registrable domain.

#### Scenario: Connected user receives live notification

- **WHEN** recipient R has an active SSE connection on `GET /stream` (authenticated via cookie)
- **AND** a new event is emitted with R in `recipientIds`
- **THEN** the raw notification event is pushed to R's SSE stream immediately

#### Scenario: SSE handshake authenticates via cookie

- **WHEN** the frontend opens `new EventSource('https://notify.rezics.com/stream', { withCredentials: true })` from `https://book.rezics.com`
- **THEN** the browser includes the `rezics-session-token` cookie on the handshake, notify verifies it via the `requireUser` macro, and the stream is established

#### Scenario: Missing cookie rejected

- **WHEN** an SSE handshake to `GET /stream` arrives with no `rezics-session-token` cookie and no `Authorization` header
- **THEN** the request is rejected with 401 (no stream established)

#### Scenario: Disconnected user receives notification on next load

- **WHEN** recipient R has no active SSE connection
- **AND** a new event is emitted with R in `recipientIds`
- **THEN** the notification is persisted and R retrieves it via `GET /notification/list` on next load

### Requirement: SSE pushes raw events

The SSE stream SHALL push individual raw events (same shape as a single notification row, including `kind`, `sourceUnitId`, `actorId`, `extra`, `createdAt`). The frontend is responsible for merging raw events into its local aggregated state (typically via TanStack Query cache invalidation).

#### Scenario: Raw event shape

- **WHEN** a `reaction.like` event is pushed via SSE
- **THEN** the event data contains `id`, `kind`, `sourceUnitId`, `actorId`, `extra`, `createdAt` — not an aggregated group

### Requirement: Heartbeat keep-alive

The SSE stream SHALL emit a comment frame (`:heartbeat`) every 30 seconds to prevent proxy/load-balancer idle timeouts. Behavior unchanged.

#### Scenario: Idle connection kept alive

- **WHEN** no events are emitted for 30 seconds on an active SSE connection
- **THEN** a `:heartbeat` comment frame is sent to the client

### Requirement: Multi-connection support

The system SHALL support multiple concurrent SSE connections per user (e.g., multiple browser tabs). Each connection SHALL receive all events for that user. Behavior unchanged.

#### Scenario: Two tabs receive same event

- **WHEN** user R has SSE connections from tab A and tab B
- **AND** a notification event is emitted for R
- **THEN** both tab A and tab B receive the event

### Requirement: In-process fan-out

SSE subscriber state SHALL be held in-process as a map from `userId` to `Set<connection>`. This is a single-instance design. Behavior unchanged.

#### Scenario: Connection cleanup on disconnect

- **WHEN** a client disconnects from the SSE stream
- **THEN** the connection is removed from the subscriber map for that userId

### Requirement: Frontend reconnect and backfill

On SSE reconnect after a transient disconnection, the frontend SHALL re-fetch `GET /notification/list` and `GET /notification/unread-count` to backfill any events missed during the gap. The reconnect itself is handled by the browser's built-in `EventSource` auto-reconnect; the backfill SHALL be triggered by the open event of the reconnected stream or by query-cache invalidation on each incoming event.

#### Scenario: Auto-reconnect after notify restart

- **WHEN** notify restarts and existing SSE connections drop
- **THEN** browsers auto-reconnect within their default backoff (~3 seconds), the cookie is re-sent on the new handshake, and the frontend re-fetches the list and unread-count queries to ensure no events are missed

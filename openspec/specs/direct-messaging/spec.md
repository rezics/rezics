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

### Requirement: Server-mediated DM sends gated on Subscription

All DM send operations SHALL route through the server (`POST /dm/send`). The server SHALL validate sender permission by looking up `Subscription(subscriberUnitId=senderUnitId, targetUnitId=recipientUnitId)` and accepting the send if and only if the subscription's `channels` array includes `'*'`, `'dm.*'`, or the exact event `'dm.message'`. The legacy "sender must follow recipient" check (`prisma.follow.findUnique`) SHALL be removed (`Follow` retires in this change). On accept, the server forwards to notify's `POST /internal/dm`. The frontend SHALL NOT send messages directly to notify.

The CHANNEL_REGISTRY for `UnitType=USER` SHALL include `dm` in `categories` and `dm.message` in `events` so that `'dm.*'` and `'dm.message'` are valid channel entries on a USER→USER subscription.

#### Scenario: Authorized send via subscription with wildcard channels

- **WHEN** user A has `Subscription(subscriberUnitId=A, targetUnitId=B, channels=['*'])` and sends a DM to B via `POST /dm/send`
- **THEN** the server confirms the subscription permits DM and forwards to notify's `POST /internal/dm`

#### Scenario: Authorized send via dm-specific channel

- **WHEN** user A has `Subscription(subscriberUnitId=A, targetUnitId=B, channels=['dm.message'])` and sends a DM to B
- **THEN** the server accepts the send because `'dm.message'` matches the required event

#### Scenario: Subscriber without DM channel rejected

- **WHEN** user A has `Subscription(subscriberUnitId=A, targetUnitId=B, channels=['post.new'])` (subscribed but DM not enabled) and attempts to send a DM to B
- **THEN** the server rejects with 403 and does NOT call notify

#### Scenario: Non-subscriber rejected

- **WHEN** user A has no `Subscription` row targeting B and attempts to send a DM to B
- **THEN** the server rejects with 403 and does NOT call notify

#### Scenario: Mutual subscription not required for v1

- **WHEN** user A is subscribed to B with DM-permitting channels and sends a DM to B
- **THEN** the send is accepted regardless of whether B is subscribed to A (one-way subscription is sufficient, mirroring the previous one-way follow semantics)

#### Scenario: Backfilled follow continues to permit DM

- **WHEN** a pre-cutover `Follow(followerId=A, followingId=B)` row was migrated to `Subscription(subscriberUnitId=A, targetUnitId=B, channels=['*'])` per the migration plan
- **THEN** A retains the ability to DM B post-cutover with no user action required

### Requirement: DM inbox UI

The frontend SHALL provide a DM inbox UI under `/inbox/dm/*` rendering the conversations and message threads accessible via notify's existing DM endpoints, gated by the subscription-based send permission established above.

The inbox SHALL include:

- A conversation list view at `/inbox/dm` consuming `GET notify/dm/conversations`, sorted by `updatedAt` descending
- A conversation thread view at `/inbox/dm/:conversationId` consuming `GET notify/dm/conversations/:id/messages` with pagination, sorted oldest-to-newest in the rendered viewport
- A message send composer that calls server's `POST /dm/send`, applies optimistic append on success, and surfaces 403 (subscription/DM not permitted) as an inline error
- A WebSocket client (`useDmStream`) that opens notify's `WS /dm` cookie-authenticated per `notify-broadcast-boundary`, mounted post-login, that invalidates the conversation list and active-thread queries on incoming messages

#### Scenario: Conversation list renders

- **WHEN** the authenticated user navigates to `/inbox/dm`
- **THEN** the page calls `useConversations()` and renders one row per conversation, sorted by `updatedAt` descending, each row showing the peer's display name and last message preview

#### Scenario: Real-time message append

- **WHEN** the authenticated user is on the conversation thread for `:conversationId`
- **AND** a new message arrives over `WS /dm` for that conversation
- **THEN** the new message appears in the thread without manual refresh (via cache invalidation or optimistic prepend triggered by the stream hook)

#### Scenario: Send blocked by subscription gate

- **WHEN** the authenticated user composes a DM to a recipient they are not subscribed to (or whose subscription does not include DM channels)
- **AND** clicks send
- **THEN** the server returns 403 and the UI surfaces an inline error explaining that subscribing to the recipient with DM enabled is required

#### Scenario: Inbox tabs co-exist with notifications

- **WHEN** the authenticated user opens the inbox surface
- **THEN** the inbox provides tabs for Notifications (the `NotificationTabSection` from `notify-broadcast-boundary`) and DM (the new conversation list); switching between them is local navigation, not a full page transition

### Requirement: WebSocket receive-only delivery

The system SHALL provide `WS /dm` for real-time message delivery. This channel is receive-only from the frontend's perspective — clients connect and receive incoming messages but do not send messages over the WebSocket. Authentication SHALL be performed via the `rezics-session-token` cookie sent on the WebSocket upgrade request (under `subdomain-trust-boundary`'s `Domain=.rezics.com` cookie scope). The legacy `?token=<jwt>` query parameter authentication path SHALL be removed.

#### Scenario: Recipient receives message in real-time

- **WHEN** user B has an active WebSocket connection
- **AND** a message from user A is persisted for their conversation
- **THEN** user B receives the message on their WebSocket connection

#### Scenario: WebSocket authentication via cookie on handshake

- **WHEN** a browser opens a WebSocket connection to `WS /dm` from a `*.rezics.com` origin (or `localhost` in dev) with the `rezics-session-token` cookie set
- **THEN** the browser includes the cookie on the upgrade request, notify verifies the JWT, and the connection is established

#### Scenario: Missing cookie closes connection

- **WHEN** a WebSocket upgrade request to `WS /dm` arrives with no `rezics-session-token` cookie
- **THEN** the connection is closed with code 4001

#### Scenario: Query-parameter token no longer accepted

- **WHEN** a WebSocket upgrade request to `WS /dm?token=<jwt>` arrives with a query parameter but no cookie
- **THEN** the connection is closed with code 4001 (the query parameter path is removed; query-param tokens land in access logs and HTTP referrers, removing them is a security improvement)

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

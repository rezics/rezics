## MODIFIED Requirements

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

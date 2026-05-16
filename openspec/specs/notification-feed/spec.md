## ADDED Requirements

### Requirement: Notification persistence

The system SHALL persist every notification event as an individual row with `recipientId`, `actorId` (nullable for system-issued events), `kind` (dot-namespaced string, registry-validated), `sourceUnitId` (the Unit the event is "about"), `extra` (JSON, renamed from `meta` to align with server-side `extra Json?` schema convention), `read` (boolean), `readAt`, and `createdAt`. The closed `NotificationType` enum is dropped; the `entityType` and `entityId` columns are dropped and replaced by the single `sourceUnitId` column.

#### Scenario: Reaction notification stored

- **WHEN** a `reaction.like` event is emitted for recipients [R] with actor A and `sourceUnitId=U` and `extra={ unitTitle: "..." }`
- **THEN** a notification row is created with `recipientId=R`, `actorId=A`, `kind='reaction.like'`, `sourceUnitId=U`, `extra={ unitTitle: "..." }`, `read=false`

#### Scenario: System notification stored without actor

- **WHEN** a `system.notice` event is emitted for recipient R with no actor
- **THEN** a notification row is created with `recipientId=R`, `actorId=null`, `kind='system.notice'`, `sourceUnitId=<system-unit-id-or-target>`, `read=false`

#### Scenario: Broadcast event persists one row per recipient

- **WHEN** a `chapter.new` event (kind added by `engagement-subscription`) is emitted with `recipientIds=[R1, R2, R3]` and `sourceUnitId=B`
- **THEN** three notification rows are created, one per recipient, all with `kind='chapter.new'`, `sourceUnitId=B`

### Requirement: Query-time aggregation by kind

The system SHALL aggregate notifications at query time by grouping on `(recipientId, kind, sourceUnitId)`. Whether a kind is aggregatable SHALL be determined by `KIND_REGISTRY[kind].aggregatable` from `@rezics/contract`. Aggregatable kinds (e.g., `reaction.like`, `reaction.favorite`, `follow.new`) are returned as grouped items with `actorIds[]` and `count`. Non-aggregatable kinds (e.g., `comment.new`, `mention.new`, `system.notice`, `invitation.new`) are returned as individual items.

The hardcoded `AGGREGATABLE_TYPES` constant SHALL be removed; aggregatability is registry-driven.

#### Scenario: Multiple likes on same source aggregated

- **WHEN** recipient R has 3 `reaction.like` notifications with `sourceUnitId=U` from actors A, B, C
- **AND** the frontend requests `GET /notification/list`
- **THEN** the response contains one aggregated item with `kind='reaction.like'`, `sourceUnitId=U`, `actorIds=[C, B, A]` (most recent first), `count=3`

#### Scenario: Comments shown individually

- **WHEN** recipient R has 2 `comment.new` notifications for `sourceUnitId=P` from actors A and B
- **AND** the frontend requests `GET /notification/list`
- **THEN** the response contains 2 separate notification items, each with their own `actorIds` array of length 1

#### Scenario: New aggregatable kind registered

- **WHEN** a new kind is added to `KIND_REGISTRY` with `aggregatable: true`
- **THEN** the aggregation query automatically includes it without code changes; rows of that kind for the same `(recipientId, sourceUnitId)` are grouped

### Requirement: Paginated notification list

The system SHALL provide `GET /notification/list` with offset pagination. Results SHALL be sorted by `latestAt` descending (most recent activity first). Each item SHALL carry `kind`, `sourceUnitId`, `actorIds[]` (length 1 for non-aggregatable items), `count`, `latestAt`, `extra`, and a `read` flag (`true` if all underlying rows for the aggregated group are read).

#### Scenario: Paginated fetch

- **WHEN** recipient R requests `GET /notification/list?page=1&limit=20`
- **THEN** the response contains up to 20 aggregated notification items sorted by latest activity

### Requirement: Unread count

The system SHALL provide `GET /notification/unread-count` returning the count of distinct aggregated groups that contain at least one unread row. The count is computed using the same `(kind, sourceUnitId)` grouping as the list query, plus individual unread rows for non-aggregatable kinds.

#### Scenario: Aggregated unread count

- **WHEN** recipient R has 5 unread `reaction.like` rows for `sourceUnitId=U` and 1 unread `comment.new` row for `sourceUnitId=P`
- **THEN** `GET /notification/unread-count` returns `{ count: 2 }`

### Requirement: Mark notifications as read by aggregation key

The system SHALL provide `POST /notification/read` accepting an aggregation key `{ kind, sourceUnitId }` to mark all matching unread rows as read for the authenticated user. The body shape changes from the legacy `{ type, entityType, entityId }` to `{ kind, sourceUnitId }`.

#### Scenario: Mark aggregated group as read

- **WHEN** recipient R marks the `reaction.like` group for `sourceUnitId=U` as read
- **THEN** all `reaction.like` notification rows for `recipientId=R, sourceUnitId=U` are updated with `read=true` and `readAt=now()`

### Requirement: Mark all notifications as read

The system SHALL provide `POST /notification/read-all` to mark all unread notifications as read for the authenticated user. Behavior unchanged.

#### Scenario: Mark all as read

- **WHEN** recipient R calls `POST /notification/read-all`
- **THEN** all notification rows with `recipientId=R` and `read=false` are updated to `read=true`

### Requirement: Delete notification

The system SHALL provide `DELETE /notification/:id` to delete a specific notification row owned by the authenticated user. Behavior unchanged.

#### Scenario: Delete own notification

- **WHEN** recipient R deletes notification with id=N where `recipientId=R`
- **THEN** the notification row is removed

#### Scenario: Cannot delete another user's notification

- **WHEN** user X attempts to delete notification with id=N where `recipientId=R` (R ≠ X)
- **THEN** the request is rejected with 404

### Requirement: Renderer payload in extra

Notification rows SHALL store renderer-payload data (entity title snapshot, cover URL, deep-link target, etc.) in the `extra Json?` column and store `actorId` as an ID reference only. The frontend SHALL resolve actor display data via a separate batch endpoint. The column rename from `meta` to `extra` aligns with the server-side schema convention (eleven `extra Json?` columns across the server schema, zero `meta`).

#### Scenario: Extra contains entity snapshot

- **WHEN** a `reaction.like` event is emitted with `extra: { unitTitle: "The Great Gatsby", unitCover: "/covers/abc.jpg" }`
- **THEN** the notification row stores this `extra` as-is for self-contained entity rendering

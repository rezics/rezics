## ADDED Requirements

### Requirement: Notification persistence
The system SHALL persist every notification event as an individual row with `recipientId`, `actorId` (nullable for SYSTEM), `type`, `entityType`, `entityId`, `meta` (JSON), `read` (boolean), `readAt`, and `createdAt`.

#### Scenario: User-attributed notification stored
- **WHEN** a LIKE event is emitted for recipient R with actor A on entity book:123
- **THEN** a notification row is created with `recipientId=R`, `actorId=A`, `type=LIKE`, `entityType=book`, `entityId=123`, `read=false`

#### Scenario: System notification stored without actor
- **WHEN** a SYSTEM event is emitted for recipient R with no actor
- **THEN** a notification row is created with `recipientId=R`, `actorId=null`, `type=SYSTEM`

### Requirement: Query-time aggregation
The system SHALL aggregate notifications at query time by grouping on `(recipientId, type, entityType, entityId)` for aggregatable types (`LIKE`, `FAVORITE`, `FOLLOW`). Non-aggregatable types (`COMMENT`, `MENTION`, `SYSTEM`, `INVITATION`) SHALL be returned as individual items.

#### Scenario: Multiple likes on same entity aggregated
- **WHEN** recipient R has 3 LIKE notifications for book:123 from actors A, B, C
- **AND** the frontend requests `GET /notifications`
- **THEN** the response contains one aggregated item with `type=LIKE`, `entityId=123`, `actorIds=[C, B, A]` (ordered by most recent), `count=3`

#### Scenario: Comments shown individually
- **WHEN** recipient R has 2 COMMENT notifications for book:123 from actors A and B
- **AND** the frontend requests `GET /notifications`
- **THEN** the response contains 2 separate notification items, each with their own `actorIds` array of length 1

### Requirement: Paginated notification list
The system SHALL provide `GET /notifications` with cursor-based or offset pagination. Results SHALL be sorted by `latestAt` descending (most recent activity first).

#### Scenario: Paginated fetch
- **WHEN** recipient R requests `GET /notifications?page=1&limit=20`
- **THEN** the response contains up to 20 aggregated notification items sorted by latest activity

### Requirement: Unread count
The system SHALL provide `GET /notifications/unread-count` returning the count of distinct aggregated groups that contain at least one unread row.

#### Scenario: Aggregated unread count
- **WHEN** recipient R has 5 unread LIKE rows for book:123 and 1 unread COMMENT row for book:456
- **THEN** `GET /notifications/unread-count` returns `{ count: 2 }`

### Requirement: Mark notifications as read
The system SHALL provide `POST /notifications/read` accepting an aggregation key `(type, entityType, entityId)` to mark all matching unread rows as read for the authenticated user.

#### Scenario: Mark aggregated group as read
- **WHEN** recipient R marks the LIKE group for book:123 as read
- **THEN** all LIKE notification rows for recipientId=R, entityType=book, entityId=123 are updated with `read=true` and `readAt=now()`

### Requirement: Mark all notifications as read
The system SHALL provide `POST /notifications/read-all` to mark all unread notifications as read for the authenticated user.

#### Scenario: Mark all as read
- **WHEN** recipient R calls `POST /notifications/read-all`
- **THEN** all notification rows with `recipientId=R` and `read=false` are updated to `read=true`

### Requirement: Delete notification
The system SHALL provide `DELETE /notifications/:id` to delete a specific notification row owned by the authenticated user.

#### Scenario: Delete own notification
- **WHEN** recipient R deletes notification with id=N where recipientId=R
- **THEN** the notification row is removed

#### Scenario: Cannot delete another user's notification
- **WHEN** user X attempts to delete notification with id=N where recipientId=R (R != X)
- **THEN** the request is rejected with 404

### Requirement: Hybrid metadata
Notification rows SHALL store entity snapshots (title, cover) in `meta` JSON and store `actorId` as an ID reference only. The frontend SHALL resolve actor display data via a separate batch endpoint.

#### Scenario: Meta contains entity snapshot
- **WHEN** a LIKE event is emitted with `meta: { entityTitle: "The Great Gatsby", entityCover: "/covers/abc.jpg" }`
- **THEN** the notification row stores this meta as-is for self-contained entity rendering

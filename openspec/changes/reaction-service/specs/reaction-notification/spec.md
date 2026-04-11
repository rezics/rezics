## ADDED Requirements

### Requirement: Emit notification on reaction create
When a new reaction is created (not an idempotent hit), the reaction service SHALL emit a notification event to the Notify service via `POST /internal/event`. The notification SHALL only be sent if the reaction target's owner differs from the reactor.

#### Scenario: Like notification sent
- **WHEN** user A creates a `like` reaction on a unit owned by user B
- **THEN** the reaction service resolves the owner via `GET /internal/units/owner?id=<targetId>` on the server, confirms owner (B) differs from actor (A), and sends `POST /internal/event` to Notify with `{ recipientId: B, type: "LIKE", actorId: A, entityType: "unit", entityId: <targetId>, meta: {} }`

#### Scenario: No self-notification
- **WHEN** user A creates a `like` reaction on a unit they own
- **THEN** the reaction service resolves the owner, finds it matches the actor, and does NOT send a notification

#### Scenario: Owner resolution failure
- **WHEN** the reaction service cannot reach the server's owner resolution endpoint (network error, timeout, 404)
- **THEN** the reaction is still created successfully, but no notification is sent. The error is logged.

### Requirement: Notification is fire-and-forget
Notification emission SHALL NOT block the reaction response. If the Notify service is unavailable, the reaction succeeds and the notification is silently dropped.

#### Scenario: Notify service unavailable
- **WHEN** a user creates a reaction and the Notify service is unreachable
- **THEN** the reaction is created and returned successfully. The notification failure is logged but not surfaced to the client.

### Requirement: No reaction-type-to-notification-type mapping complexity
The reaction service SHALL map all sentiment reactions to the `LIKE` notification type. The reaction service SHALL NOT maintain a mapping table between reaction types and notification types.

#### Scenario: Dislike emits LIKE notification
- **WHEN** user A creates a `dislike` reaction on a unit owned by user B
- **THEN** the notification is sent with `type: "LIKE"` (not "DISLIKE"). Notify aggregates all reaction notifications under the same type.

### Requirement: No notification on reaction delete
The reaction service SHALL NOT emit any notification when a reaction is deleted.

#### Scenario: Delete does not notify
- **WHEN** a user deletes their `like` reaction
- **THEN** no notification event is sent to Notify

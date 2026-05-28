# reaction-notification Specification

## Purpose

Defines reaction-driven notification dispatch. The main server (not the
reaction service) emits a single `LIKE`-typed event to notify via
`POST /internal/event` on newly-created reactions only, suppressing
self-notifications by resolving the target Unit's owner first. All
sentiment reactions collapse to `LIKE` — there is no per-type mapping.
Notification calls are fire-and-forget and never block the reaction
response. Reaction deletes never notify. The reaction service stays a
pure data layer with no outbound side-effects.

## Requirements

### Requirement: Server dispatches notification on reaction create
When a reaction write is proxied through the main server and the reaction is newly created (not an idempotent hit), the **main server** SHALL dispatch a notification event to the Notify service via `POST /internal/event`. The notification SHALL only be sent if the reaction target's owner differs from the reactor. The reaction service itself has no notification logic.

#### Scenario: Like notification sent
- **WHEN** user A creates a `like` reaction on a unit owned by user B (via `POST /reactions` on the main server)
- **THEN** the server proxies the write to the reaction service's `POST /internal/create`, receives `{ created: true }`, resolves the owner via `prisma.unit.findUnique`, confirms owner (B) differs from actor (A), and sends `POST /internal/event` to Notify with `{ recipientId: B, type: "LIKE", actorId: A, entityType: "unit", entityId: <targetId>, meta: {} }`

#### Scenario: No self-notification
- **WHEN** user A creates a `like` reaction on a unit they own
- **THEN** the server resolves the owner, finds it matches the actor, and does NOT send a notification

#### Scenario: Idempotent create does not notify
- **WHEN** user A creates a `like` reaction that already exists
- **THEN** the reaction service returns `{ created: false }` and the server does NOT dispatch a notification

### Requirement: Notification is fire-and-forget
Notification dispatch SHALL NOT block the reaction response. If the Notify service is unavailable, the reaction write succeeds and the notification is silently dropped.

#### Scenario: Notify service unavailable
- **WHEN** a user creates a reaction and the Notify service is unreachable
- **THEN** the reaction is created and returned successfully. The notification failure is logged but not surfaced to the client.

### Requirement: No reaction-type-to-notification-type mapping complexity
The server SHALL map all sentiment reactions to the `LIKE` notification type. There is no mapping table between reaction types and notification types.

#### Scenario: Dislike emits LIKE notification
- **WHEN** user A creates a `dislike` reaction on a unit owned by user B
- **THEN** the notification is sent with `type: "LIKE"` (not "DISLIKE"). Notify aggregates all reaction notifications under the same type.

### Requirement: No notification on reaction delete
The system SHALL NOT emit any notification when a reaction is deleted.

#### Scenario: Delete does not notify
- **WHEN** a user deletes their `like` reaction
- **THEN** no notification event is sent to Notify

### Requirement: Reaction service has no notification logic
The reaction service SHALL NOT contain any notification client, outbound calls to Notify, or outbound calls to the main server for owner resolution. It is a pure data layer.

#### Scenario: Reaction service independence
- **WHEN** the reaction service processes an internal create or remove request
- **THEN** it performs only the database transaction and returns the result. No side-effects are triggered.

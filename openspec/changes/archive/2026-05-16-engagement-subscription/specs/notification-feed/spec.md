## ADDED Requirements

### Requirement: Broadcast recipient resolution from Subscription

For broadcast event types — events whose recipients are "everyone watching the source Unit" rather than a specific addressee — the system SHALL compute the recipient set by querying the `Subscription` table where `targetUnitId = event.sourceUnitId` and the row's `channels` matches the event by any of the three wildcard tiers (`'*'`, `'<category>.*'`, exact event). Hardcoded per-domain recipient resolution SHALL be removed for broadcast events.

#### Scenario: New chapter broadcast

- **GIVEN** users U1, U2, U3 all have `Subscription(target=B, channels=['chapter.*'])`
- **WHEN** event `{ kind: 'chapter.new', sourceUnitId: B }` is emitted
- **THEN** notification rows are persisted with `recipientId` = U1, U2, U3 respectively

#### Scenario: Filtered subscriber excluded

- **GIVEN** user U has `Subscription(target=B, channels=['review.new'])`
- **WHEN** event `{ kind: 'chapter.new', sourceUnitId: B }` is emitted
- **THEN** no notification row is persisted with `recipientId=U`

### Requirement: Direct recipient path preserved for addressed events

For event types whose recipient is known to the producer (mention target, reply parent author, DM peer, system-addressed), the producer SHALL pass `directRecipients` on the event and the system SHALL persist a notification row for each direct recipient regardless of `Subscription` state. Direct and broadcast recipients for the same event SHALL be unioned, with each recipient receiving at most one notification row per event.

#### Scenario: Mention notification ignores subscription

- **GIVEN** user U has no subscription to post P
- **WHEN** event `{ kind: 'mention.new', sourceUnitId: P, directRecipients: [U.unitId] }` is emitted
- **THEN** a notification row is persisted with `recipientId=U`

#### Scenario: Direct + broadcast deduplicated

- **GIVEN** user U has `Subscription(target=P, channels=['*'])` AND is the parent of a reply
- **WHEN** event `{ kind: 'reply.new', sourceUnitId: P, directRecipients: [U.unitId] }` is emitted
- **THEN** exactly one notification row is persisted with `recipientId=U`

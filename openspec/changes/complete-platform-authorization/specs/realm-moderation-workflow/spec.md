## ADDED Requirements

### Requirement: Realm reports enter a realm queue

Reports for realm content, realm members, or realm rules SHALL create realm moderation queue items linked to the target realm.

#### Scenario: Member reports a realm post

- **WHEN** a realm member reports a post from the realm feed
- **THEN** the realm moderation queue SHALL receive a new item
- **AND** authorized realm moderators SHALL be able to review it

### Requirement: Realm decisions support local sanctions

Realm moderators SHALL be able to hide from realm, remove from realm feed, lock, archive, warn, mute in realm, remove member, ban from realm, reject, duplicate, or escalate according to policy.

#### Scenario: Moderator bans member from realm

- **WHEN** a moderator bans a member from a realm
- **THEN** the member state SHALL become `banned`
- **AND** the user SHALL lose realm posting and membership actions for that realm
- **AND** global account state SHALL remain unchanged unless escalated

### Requirement: Realm queue can escalate to site case

A realm moderator SHALL be able to escalate a queue item to site staff, creating or linking a site-wide moderation case.

#### Scenario: Realm report escalates

- **WHEN** a moderator escalates a harassment report
- **THEN** the system SHALL link the realm queue item to a site moderation case
- **AND** subsequent site decisions SHALL be visible to authorized realm staff as safe summaries

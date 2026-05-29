# app-community-engagement Specification

## Purpose

Defines how engagement actions (reaction, reply/comment, shelf/save,
follow/subscribe, share, report, DM) behave consistently across the public
app's content surfaces — detail pages, cards, and notifications — and how those
actions respect auth state, privacy, account enforcement, realm membership,
content lifecycle, and server policy.

## Requirements

### Requirement: Engagement actions are consistent across content surfaces

Detail pages and cards SHALL expose context-appropriate actions for reaction, reply/comment, shelf/save, follow/subscribe, share, report, and DM.

#### Scenario: User reports content from detail page

- **WHEN** a user activates report on a post/detail surface
- **THEN** the app SHALL open a report flow backed by typed moderation/report APIs

### Requirement: Notifications are actionable

Notification entries SHALL navigate to the relevant content, profile, realm, message, moderation, or settings surface when activated.

#### Scenario: Reply notification opens thread

- **WHEN** a user activates a reply notification
- **THEN** the app SHALL navigate to the relevant thread and highlight or position the reply when possible

### Requirement: Engagement respects privacy and safety

Engagement actions SHALL hide or disable actions based on auth state, DM permission, account enforcement, realm membership, content lifecycle, and server policy.

#### Scenario: DM action hidden by permission

- **WHEN** the current user cannot DM a profile
- **THEN** the DM action SHALL not be offered or SHALL show a safe disabled reason

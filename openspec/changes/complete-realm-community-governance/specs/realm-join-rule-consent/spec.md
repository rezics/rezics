## MODIFIED Requirements

### Requirement: Join consent supports rules and approval states

Realm join flows SHALL support rules acknowledgement, optional membership approval, and pending state for private or approval-required realms.

#### Scenario: Approval-required realm creates pending membership

- **WHEN** a user requests to join an approval-required realm
- **THEN** the system SHALL create a pending membership request
- **AND** moderators SHALL be able to approve or reject it from the realm console

## MODIFIED Requirements

### Requirement: Join consent supports rules and approval states

Realm join flows SHALL support UnitTranslation-aware rules acknowledgement, optional membership approval, and pending state for private or approval-required realms. Acknowledgement SHALL be recorded against the current rule Unit and required version before membership activation when the realm requires rules for joining.

#### Scenario: Approval-required realm creates pending membership

- **WHEN** a user requests to join an approval-required realm
- **THEN** the system SHALL create a pending membership request
- **AND** moderators SHALL be able to approve or reject it from the realm console

#### Scenario: Join requires current localized rules

- **GIVEN** a realm requires rule acknowledgement before joining
- **WHEN** a user joins while browsing in Traditional Chinese
- **THEN** the join flow SHALL present the localized rule content resolved from the current rule Unit
- **AND** successful consent SHALL store acknowledgement for the current rule Unit and version

## ADDED Requirements

### Requirement: Credit attribution link validates Entity eligibility

Credit attribution link writes SHALL validate that the target Entity's `eligibleCreditRoles` contains the requested registered credit role. The validation SHALL run in the service layer after request schema validation and before creating the `CreditAttribution` row. Existing credit attribution reads SHALL continue to return stored rows even if the linked Entity's eligibility is later narrowed.

#### Scenario: Eligible Entity can be linked as author

- **GIVEN** Entity "entity-1" has `eligibleCreditRoles = ["author"]`
- **WHEN** a caller creates `CreditAttribution(unitId = "book-1", entityId = "entity-1", role = "author")`
- **THEN** the link SHALL be persisted

#### Scenario: Character Entity cannot be linked as author without eligibility

- **GIVEN** Entity "character-1" has `eligibleCreditRoles = []`
- **WHEN** a caller creates `CreditAttribution(unitId = "book-1", entityId = "character-1", role = "author")`
- **THEN** the service SHALL reject the write with a typed eligibility error
- **AND** no CreditAttribution row SHALL be created

#### Scenario: Existing ineligible credit remains readable

- **GIVEN** an existing CreditAttribution row has `role = "author"`
- **AND** the linked Entity no longer contains `"author"` in `eligibleCreditRoles`
- **WHEN** a client lists credits for the Unit
- **THEN** the existing row SHALL still be returned
- **AND** only new link writes SHALL be blocked by eligibility validation

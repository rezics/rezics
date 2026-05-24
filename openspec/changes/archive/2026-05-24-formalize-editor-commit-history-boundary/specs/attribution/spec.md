## ADDED Requirements

### Requirement: Credit attribution batch reconciliation

The system SHALL support batch reconciliation of credit attribution rows through the unit-scoped entity attribution batch endpoint. A `setCredits` batch operation SHALL validate the submitted credit role key, validate every referenced Entity's credit-role eligibility, and reconcile the target Unit's `CreditAttribution` rows for that role to the submitted final ordered set.

#### Scenario: Reconcile author credits

- **GIVEN** Unit `book-1` has existing author credits `[entity-a, entity-b]`
- **WHEN** a batch request submits `setCredits(role = "author", entries = [entity-b, entity-c])`
- **THEN** the system SHALL remove the author credit for `entity-a`
- **AND** it SHALL keep or update the author credit for `entity-b`
- **AND** it SHALL create the author credit for `entity-c`

#### Scenario: Batch validates credit eligibility

- **GIVEN** Entity `entity-x` does not include `author` in `eligibleCreditRoles`
- **WHEN** a batch request submits `setCredits(role = "author", entries = [entity-x])`
- **THEN** the system SHALL reject the batch with an eligibility error
- **AND** no credit attribution rows from that batch SHALL be committed

### Requirement: Credit batch history stores final role state

Credit attribution changes made through entity attribution batch editing SHALL produce at most one editorial history revision for a successful canonical commit. The revision patch SHALL contain the final sparse credit state for changed roles and SHALL NOT contain the client's local add/remove/reorder operation log.

#### Scenario: Multiple author changes produce one history revision

- **WHEN** a user locally removes one author, adds another author, reorders the author list, and saves once
- **THEN** the server SHALL write one editorial history revision for `credits.author` or `credits.authors` according to the canonical path vocabulary
- **AND** the revision content SHALL represent the final ordered author set

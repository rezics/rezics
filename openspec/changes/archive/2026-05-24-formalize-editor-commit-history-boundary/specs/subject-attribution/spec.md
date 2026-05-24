## ADDED Requirements

### Requirement: Subject attribution batch reconciliation

The system SHALL support batch reconciliation of subject attribution rows through the unit-scoped entity attribution batch endpoint. A `setSubjects` batch operation SHALL validate the submitted subject role key, validate every referenced Entity's subject-role eligibility, and reconcile the target Unit's `SubjectAttribution` rows for that role to the submitted final ordered set.

#### Scenario: Reconcile primary character subjects

- **GIVEN** Unit `post-1` has existing primary character subjects `[entity-a, entity-b]`
- **WHEN** a batch request submits `setSubjects(role = "primary_character", entries = [entity-b, entity-c])`
- **THEN** the system SHALL remove the primary character subject for `entity-a`
- **AND** it SHALL keep or update the primary character subject for `entity-b`
- **AND** it SHALL create the primary character subject for `entity-c`

#### Scenario: Batch validates subject eligibility

- **GIVEN** Entity `entity-x` does not include `primary_character` in `eligibleSubjectRoles`
- **WHEN** a batch request submits `setSubjects(role = "primary_character", entries = [entity-x])`
- **THEN** the system SHALL reject the batch with an eligibility error
- **AND** no subject attribution rows from that batch SHALL be committed

### Requirement: Subject batch history stores final role state

Subject attribution changes made through entity attribution batch editing SHALL produce at most one editorial history revision for a successful canonical commit. The revision patch SHALL contain the final sparse subject state for changed roles and SHALL NOT contain the client's local add/remove/reorder operation log.

#### Scenario: Multiple subject changes produce one history revision

- **WHEN** a user locally removes one character, adds another character, reorders the character list, and saves once
- **THEN** the server SHALL write one editorial history revision for the changed subject role path
- **AND** the revision content SHALL represent the final ordered subject set including any submitted weights

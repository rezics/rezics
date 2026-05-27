## ADDED Requirements

### Requirement: Content rating is independent from AI disclosure

The system SHALL keep `ContentRating` semantics independent from AI disclosure
semantics. `ContentRating` SHALL continue to represent audience suitability at
the catalog/discovery layer, while `AiDisclosureMode` SHALL represent declared
AI involvement/provenance.

No system component SHALL derive, modify, broaden, restrict, or validate a
Unit's `rating` based solely on its `aiDisclosureMode`. Allowed-rating set
derivation SHALL remain based only on baseline ratings and user rating opt-ins.

#### Scenario: AI disclosure does not affect rating persistence

- **GIVEN** a Unit with `rating = GENERAL`
- **WHEN** the maintainer updates `aiDisclosureMode = MACHINE_GENERATED`
- **THEN** the Unit's `rating` SHALL remain `GENERAL`
- **AND** the system SHALL NOT require a rating update

#### Scenario: Rating filters ignore AI disclosure unless explicitly requested

- **GIVEN** a caller whose allowed rating set is `{GENERAL, R_15}`
- **AND** a Unit with `rating = GENERAL` and `aiDisclosureMode = MACHINE_GENERATED`
- **WHEN** the caller performs a discovery query without an AI disclosure filter
- **THEN** the Unit SHALL be evaluated against the allowed rating set as `GENERAL`
- **AND** the Unit SHALL NOT be excluded because it is machine-generated

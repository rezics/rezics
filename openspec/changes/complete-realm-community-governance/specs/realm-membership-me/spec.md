## MODIFIED Requirements

### Requirement: Current membership includes state and capability hints

`GET /realms/:unitId/members/me` SHALL return membership role, member state, accepted rule identity/version metadata, muted/banned status, and server-derived capability hints for realm UI rendering. Rule acknowledgement metadata SHALL identify at least the current rule Unit id, required rule version, accepted rule version when present, and whether acknowledgement is currently required.

#### Scenario: Muted member fetches membership

- **GIVEN** the current user is muted in the realm
- **WHEN** they call `GET /realms/:unitId/members/me`
- **THEN** the response SHALL include `state: "muted"` and posting capability hints set to false

#### Scenario: Member has not accepted current rule unit

- **GIVEN** a realm requires rule Unit `R2` at version 1
- **AND** the current user previously accepted old rule Unit `R1` at version 4
- **WHEN** they call `GET /realms/:unitId/members/me`
- **THEN** the response SHALL report current rule Unit `R2`
- **AND** acknowledgementRequired SHALL be true

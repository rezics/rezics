## MODIFIED Requirements

### Requirement: Current membership includes state and capability hints

`GET /realms/:unitId/members/me` SHALL return membership role, member state, accepted rules version, muted/banned status, and server-derived capability hints for realm UI rendering.

#### Scenario: Muted member fetches membership

- **GIVEN** the current user is muted in the realm
- **WHEN** they call `GET /realms/:unitId/members/me`
- **THEN** the response SHALL include `state: "muted"` and posting capability hints set to false

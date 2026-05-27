## ADDED Requirements

### Requirement: Frontend exposes staff capability hints only

Frontend auth state MAY expose global staff capability hints for navigation and UI visibility, but all privileged data fetches and mutations SHALL be authorized by server policy.

#### Scenario: Hidden button does not imply authorization

- **WHEN** a user tampers with the client to call a hidden staff mutation
- **THEN** the server SHALL still reject the request unless policy allows it

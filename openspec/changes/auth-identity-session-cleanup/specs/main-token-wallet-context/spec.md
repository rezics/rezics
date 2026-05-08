## ADDED Requirements

### Requirement: Wallet context flows through cookie boundary, not header JWT

When auth-owned flows require main token wallet context, main SHALL provide that context through internal service-to-service calls authorized by the cookie-boundary mechanism (or other internal channels), not through a browser-presented `auth-session-token` JWT carried in `x-auth-session-token`. The wallet boundary SHALL NOT depend on, accept, or trust any header-based session JWT for cross-service context propagation.

#### Scenario: Auth flow needs wallet context

- **WHEN** an auth-owned flow needs information about a main-owned external token
- **THEN** main SHALL supply only the required context via an internal call
- **AND** auth SHALL NOT receive that context through a browser-supplied `auth-session-token` JWT

#### Scenario: No header-based JWT consumption

- **WHEN** any wallet-related service evaluates inbound credentials
- **THEN** it SHALL NOT honor `x-auth-session-token` as an authorization signal

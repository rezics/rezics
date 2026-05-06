## ADDED Requirements

### Requirement: Main owns external token wallet state

The main server SHALL own storage and authorization for future external/resource API token wallet entries. Auth SHALL NOT be the system of record for general-purpose external service access tokens.

#### Scenario: External token is stored
- **WHEN** a user connects an external service that requires a reusable resource token
- **THEN** the token wallet entry SHALL be stored and authorized by main
- **AND** auth SHALL NOT store that external resource token as its own wallet state

### Requirement: Auth receives token context only through main-controlled calls

When an auth-owned flow requires token wallet context, main SHALL provide that context through a controlled internal call or service context. Auth SHALL NOT directly read or mutate main token wallet storage.

#### Scenario: Auth flow needs wallet context
- **WHEN** an auth-owned flow needs information about a main-owned external token
- **THEN** main SHALL supply only the required context to auth internally
- **AND** auth SHALL NOT bypass main authorization to access the wallet

### Requirement: Auth DB remains responsible for identity and OAuth configuration

Auth SHALL continue to own auth identity data, sessions, account links, organizations, auth roles, OAuth provider configuration, and OAuth client registration data unless a route explicitly mutates main-owned wallet or resource state.

#### Scenario: OAuth client is registered
- **WHEN** an auth admin registers an OAuth client that only changes auth OAuth configuration
- **THEN** auth SHALL persist and authorize that change in auth-owned storage
- **AND** main SHALL proxy the request without adding auth-role checks

### Requirement: Non-browser clients can use appropriate local token storage

Native applications and non-browser clients MAY use local token wallet mechanisms appropriate to their platform, but server-side external/resource token wallet state for Rezics-owned services SHALL remain main-owned.

#### Scenario: Native app stores local token
- **WHEN** a native application stores a device-local access token for its own runtime
- **THEN** that local storage choice SHALL NOT move the main server token wallet responsibility into auth

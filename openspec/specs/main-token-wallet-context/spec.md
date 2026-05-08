# main-token-wallet-context Specification

## Purpose

Defines the ownership boundary between the main server's external/resource API token wallet and auth-owned identity, session, and OAuth configuration data. The main server is the system of record for external/resource access tokens used by Rezics services, and auth receives wallet context only through main-controlled internal calls. Auth retains ownership of identity, sessions, account links, organizations, OAuth provider configuration, and OAuth client registration.

## Requirements

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

### Requirement: Wallet context flows through cookie boundary, not header JWT

When auth-owned flows require main token wallet context, main SHALL provide that context through internal service-to-service calls authorized by the cookie-boundary mechanism (or other internal channels), not through a browser-presented `auth-session-token` JWT carried in `x-auth-session-token`. The wallet boundary SHALL NOT depend on, accept, or trust any header-based session JWT for cross-service context propagation.

#### Scenario: Auth flow needs wallet context

- **WHEN** an auth-owned flow needs information about a main-owned external token
- **THEN** main SHALL supply only the required context via an internal call
- **AND** auth SHALL NOT receive that context through a browser-supplied `auth-session-token` JWT

#### Scenario: No header-based JWT consumption

- **WHEN** any wallet-related service evaluates inbound credentials
- **THEN** it SHALL NOT honor `x-auth-session-token` as an authorization signal

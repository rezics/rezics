## ADDED Requirements

### Requirement: Frontend stores auth identity and main-server session tokens separately

The frontend SHALL model `auth_identity_token` and `rezics_session_token` as separate concerns with normalized names, distinct transport rules, independent readiness selectors, and configurable token-key inputs supplied by consuming apps.

#### Scenario: Auth identity is sent with the bearer contract

- **WHEN** the frontend calls auth-backed identity or ensure endpoints that require the auth-server token
- **THEN** it SHALL send `auth_identity_token` as `Authorization: Bearer <auth_identity_token>`
- **AND** it SHALL NOT alias that token under a server-session name

#### Scenario: Main-server session token is sent with the dedicated header

- **WHEN** the frontend calls a main-server endpoint that requires main-server session authorization
- **THEN** it SHALL send `rezics_session_token` as `x-rezics_session_token: <rezics_session_token>`
- **AND** it SHALL keep that token distinct from bearer-token persistence and parsing logic

#### Scenario: Shared frontend packages accept token-key configuration

- **WHEN** a consuming app configures the frontend token strategy
- **THEN** shared package surfaces such as `jwt.ts` and `AuthProvider` SHALL accept configurable token-key inputs rather than hardcoding app-specific env policy
- **AND** the app-level env configuration SHALL provide safe defaults while preserving the existing `auth-store` key

#### Scenario: Auth identity token refresh runs before any downstream token refresh

- **WHEN** the frontend determines that tokens should be refreshed proactively or reactively
- **THEN** it SHALL refresh or confirm `auth_identity_token` before attempting to refresh `rezics_session_token`
- **AND** it SHALL NOT attempt any non-auth token refresh if `auth_identity_token` is unavailable

#### Scenario: Pending verification state exists without main-server session token

- **WHEN** the browser has authenticated auth-session state but has not yet obtained `rezics_session_token`
- **THEN** frontend readiness selectors SHALL report that the user is authenticated but not member-ready
- **AND** the UI SHALL be able to render pending-verification account chrome without assuming business-session availability

#### Scenario: Logout clears both token contexts

- **WHEN** the user logs out
- **THEN** the frontend SHALL clear both `auth_identity_token` and `rezics_session_token`
- **AND** it SHALL clear any derived readiness or permission snapshot state associated with those tokens

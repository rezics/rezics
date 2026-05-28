# token-refresh-registry Specification

## Purpose

Defines the frontend token refresh registry consumed by
`AuthProvider`. Owns the rule that the registry holds exactly one
entry — `REZICS_SESSION` — refreshed via the
`POST /auth/session/refresh` cookie boundary, the prohibition on
`AUTH_SESSION`, `NOTIFICATION_SESSION`, and `SEARCH_SESSION`
entries, the refresh-function contract returning `{ token }` and
throwing on failure, and the non-retryable transition to
anonymous state when the auth session cookie is rejected.

## Requirements

### Requirement: Registry is extensible via factory function

System MAY retain `createTokenRefreshRegistry()` as an extensible factory. The registry SHALL manage exactly one token entry: `REZICS_SESSION` (refreshed via the cookie boundary `POST /auth/session/refresh`). The legacy `AUTH_SESSION` registry entry SHALL NOT exist — auth session validity is conveyed by the auth session httpOnly cookie, not by a frontend-managed JWT in localStorage. `NOTIFICATION_SESSION` and `SEARCH_SESSION` entries SHALL NOT exist.

#### Scenario: Registry manages only REZICS_SESSION

- **WHEN** `AuthProvider` initializes the token refresh registry
- **THEN** exactly one entry exists: `REZICS_SESSION` (refresh via the cookie boundary)
- **AND** no `AUTH_SESSION` entry SHALL be present

#### Scenario: REZICS_SESSION refresh uses cookie boundary

- **WHEN** the `REZICS_SESSION` token needs refreshing
- **THEN** the refresh function calls `POST /auth/session/refresh` with credentials-included so the auth session httpOnly cookie is forwarded
- **AND** the response sets a fresh `rezics-session-token` httpOnly cookie (and may return the token body for non-browser callers)
- **AND** the refresh function SHALL NOT read or send any `auth-session-token` JWT

### Requirement: Refresh function contract

Each refresh function in the registry SHALL be an async function returning `{ token: string }` on success and throwing on failure. AuthProvider classifies errors as retryable or non-retryable. The `REZICS_SESSION` refresh function depends on the auth session cookie remaining valid; if the cookie is missing or rejected, the refresh fails non-retryably and the user must re-authenticate.

#### Scenario: REZICS_SESSION refresh fails when auth session is invalid

- **WHEN** the `REZICS_SESSION` refresh call returns 401 from `/auth/session/refresh`
- **THEN** the failure is classified as non-retryable
- **AND** AuthProvider transitions to anonymous state


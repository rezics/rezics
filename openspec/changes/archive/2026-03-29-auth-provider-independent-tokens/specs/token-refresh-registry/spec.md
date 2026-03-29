## ADDED Requirements

### Requirement: Token refresh registry maps token names to refresh functions

The system SHALL provide a `TokenRefreshRegistry` type and a default registry instance in `@package/api`. Each entry maps a `NormalizedTokenName` to an async function that obtains a fresh token from the corresponding service endpoint.

#### Scenario: Registry contains entry for REZICS_SESSION

- **WHEN** the default registry is loaded
- **THEN** it SHALL contain an entry for `NormalizedTokenName.REZICS_SESSION`
- **AND** calling that entry SHALL invoke `POST /session/token` and return `{token: string}`

#### Scenario: Registry entry performs token-specific side effects

- **WHEN** the `REZICS_SESSION` refresh function is called
- **THEN** it SHALL call `userApi.issueSessionToken()` to obtain the token
- **AND** it SHALL call `useAuthSessionStore.getState().syncBusinessToken(token)` before returning
- **AND** it SHALL return `{token}` to the caller

### Requirement: Registry is extensible via factory function

The system SHALL export a `createTokenRefreshRegistry()` factory that merges custom entries with the defaults. Consuming apps use this to add or override refresh functions for their token sets.

#### Scenario: App adds a future notification token refresh

- **WHEN** an app calls `createTokenRefreshRegistry({[NOTIFICATION_SESSION]: refreshFn})`
- **THEN** the returned registry SHALL contain the custom `NOTIFICATION_SESSION` entry
- **AND** it SHALL retain all default entries (e.g., `REZICS_SESSION`)

#### Scenario: App overrides a default entry

- **WHEN** an app calls `createTokenRefreshRegistry({[REZICS_SESSION]: customFn})`
- **THEN** the returned registry SHALL use `customFn` for `REZICS_SESSION`
- **AND** the default function SHALL NOT be called

### Requirement: Missing registry entry is treated as non-retryable

When AuthProvider attempts to refresh a service token that has no registry entry, the refresh SHALL fail with a non-retryable result, causing the token to enter dormant state.

#### Scenario: Unknown token type has no registry entry

- **WHEN** AuthProvider tries to refresh `SEARCH_SESSION` but no registry entry exists
- **THEN** the refresh SHALL return a non-retryable result
- **AND** `SEARCH_SESSION` SHALL enter dormant state
- **AND** other service tokens SHALL NOT be affected

### Requirement: Refresh function contract

Each refresh function in the registry SHALL be an async function that returns `{token: string}` on success and throws on failure. AuthProvider classifies errors as retryable or non-retryable using the same heuristic as the current implementation (message-based detection).

#### Scenario: Refresh function succeeds

- **WHEN** a registry refresh function resolves with `{token: "jwt..."}`
- **THEN** AuthProvider SHALL write the token to localStorage via `setToken()`
- **AND** it SHALL dispatch the `AUTH_TOKEN_STORAGE_EVENT`

#### Scenario: Refresh function throws a retryable error

- **WHEN** a registry refresh function throws with a network error message
- **THEN** AuthProvider SHALL classify it as retryable
- **AND** it SHALL schedule a retry with exponential backoff for that token only

#### Scenario: Refresh function throws a non-retryable error

- **WHEN** a registry refresh function throws with a "not found" or "Forbidden" message
- **THEN** AuthProvider SHALL classify it as non-retryable
- **AND** the token SHALL enter dormant state

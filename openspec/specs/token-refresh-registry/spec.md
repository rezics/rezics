## Requirements

### Requirement: Registry is extensible via factory function

The system MAY retain `createTokenRefreshRegistry()` as an extensible factory for future service tokens. The factory SHALL have no default entries. Consuming apps MAY add entries for future tokens (e.g., `NOTIFICATION_SESSION`).

#### Scenario: Empty default registry

- **WHEN** the default registry is loaded
- **THEN** it SHALL contain no entries
- **AND** no service token refresh SHALL be attempted by default

#### Scenario: App adds a custom token refresh

- **WHEN** an app calls `createTokenRefreshRegistry({[NOTIFICATION_SESSION]: refreshFn})`
- **THEN** the returned registry SHALL contain only the `NOTIFICATION_SESSION` entry

### Requirement: Missing registry entry is treated as non-retryable

When AuthProvider attempts to refresh a service token that has no registry entry, the refresh SHALL fail with a non-retryable result, causing the token to enter dormant state.

#### Scenario: Unknown token type has no registry entry

- **WHEN** AuthProvider tries to refresh a token with no registry entry
- **THEN** the refresh SHALL return a non-retryable result
- **AND** the token SHALL enter dormant state

### Requirement: Refresh function contract

Each refresh function in the registry SHALL be an async function that returns `{token: string}` on success and throws on failure. AuthProvider classifies errors as retryable or non-retryable using the same heuristic as the current implementation.

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

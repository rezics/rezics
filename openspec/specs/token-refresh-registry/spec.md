## MODIFIED Requirements

### Requirement: Registry is extensible via factory function

System MAY retain `createTokenRefreshRegistry()` as extensible factory. The registry SHALL manage two token entries: `AUTH_SESSION` (refreshed via session cookie using `GET /api/auth/token`) and `REZICS_SESSION` (refreshed via exchange using `POST /session/exchange` with `auth-session-token`). `NOTIFICATION_SESSION` and `SEARCH_SESSION` entries SHALL be removed.

#### Scenario: Registry manages two tokens

- **WHEN** `AuthProvider` initializes the token refresh registry
- **THEN** two entries exist: `AUTH_SESSION` (refresh via session cookie) and `REZICS_SESSION` (refresh via exchange endpoint)

#### Scenario: REZICS_SESSION refresh uses auth-session-token

- **WHEN** the `REZICS_SESSION` token needs refreshing
- **THEN** the refresh function reads the current `AUTH_SESSION` token from storage, sends it via `x-auth-session-token` to `POST /session/exchange`, and stores the returned `rezics-session-token`

### Requirement: Refresh function contract

Each refresh function in registry SHALL be async function returning `{ token: string }` on success, throw on failure. AuthProvider classifies errors as retryable or non-retryable. The `REZICS_SESSION` refresh function SHALL treat `AUTH_SESSION` token absence as a dependency — if `AUTH_SESSION` is missing or expired, the `REZICS_SESSION` refresh SHALL be deferred until `AUTH_SESSION` is refreshed.

#### Scenario: REZICS_SESSION refresh defers when AUTH_SESSION is missing

- **WHEN** the `REZICS_SESSION` token needs refreshing but no valid `AUTH_SESSION` token exists in storage
- **THEN** the refresh is deferred; `AUTH_SESSION` is refreshed first, then `REZICS_SESSION` refresh proceeds

## REMOVED Requirements

### Requirement: Missing registry entry is treated as non-retryable

**Reason**: With only two fixed entries in the registry, the concept of a missing entry is no longer meaningful. The registry is not dynamically populated.
**Migration**: Remove the missing-entry error path. The two entries are always present.

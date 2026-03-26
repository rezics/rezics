## ADDED Requirements

### Requirement: AuthProvider accepts a configurable token array

AuthProvider SHALL accept a `tokens` parameter specifying which token names to manage (e.g., `[AUTH_IDENTITY, REZICS_SESSION]`). The ordering of the array SHALL define the dependency chain — tokens later in the array depend on tokens earlier in the array.

#### Scenario: App frontend configures identity and session tokens

- **WHEN** AuthProvider is mounted with `tokens={[AUTH_IDENTITY, REZICS_SESSION]}`
- **THEN** it SHALL manage refresh lifecycle for both AUTH_IDENTITY and REZICS_SESSION
- **AND** it SHALL refresh AUTH_IDENTITY before attempting REZICS_SESSION

#### Scenario: Admin frontend configures identity token only

- **WHEN** AuthProvider is mounted with `tokens={[AUTH_IDENTITY]}`
- **THEN** it SHALL manage refresh lifecycle for AUTH_IDENTITY only
- **AND** it SHALL NOT attempt to obtain or refresh REZICS_SESSION

### Requirement: AuthProvider is stateless and side-effect free to consumers

AuthProvider SHALL NOT maintain Zustand, Jotai, or React context state for token values or claims. It SHALL NOT expose any context provider that consumers read from. Its sole observable effect SHALL be writing tokens to localStorage and dispatching storage events.

#### Scenario: No consumer-facing state

- **WHEN** AuthProvider is mounted and actively managing tokens
- **THEN** no React context, Zustand store, or global state SHALL be written by AuthProvider
- **AND** tokens SHALL exist only in localStorage

#### Scenario: Token write dispatches storage events

- **WHEN** AuthProvider writes or removes a token in localStorage
- **THEN** it SHALL dispatch the `AUTH_TOKEN_STORAGE_EVENT` custom event for same-tab listeners
- **AND** the standard `StorageEvent` SHALL propagate to other tabs

### Requirement: AuthProvider refreshes tokens proactively before expiry

AuthProvider SHALL schedule token refresh before the token's JWT expiration. The refresh buffer SHALL be configurable with a sensible default (e.g., 60 seconds).

#### Scenario: Token refreshed before expiry

- **WHEN** AUTH_IDENTITY has 45 seconds remaining and the refresh buffer is 60 seconds
- **THEN** AuthProvider SHALL initiate a refresh for AUTH_IDENTITY
- **AND** upon success, it SHALL write the new token to localStorage and reschedule

#### Scenario: Dependency chain respected during refresh

- **WHEN** both AUTH_IDENTITY and REZICS_SESSION need refresh
- **THEN** AuthProvider SHALL refresh AUTH_IDENTITY first
- **AND** only after AUTH_IDENTITY succeeds SHALL it refresh REZICS_SESSION

### Requirement: AuthProvider reacts to failure type

AuthProvider SHALL distinguish between retryable and non-retryable failures when obtaining or refreshing a token.

#### Scenario: Retryable error triggers backoff

- **WHEN** a token refresh fails due to a network error or 5xx response
- **THEN** AuthProvider SHALL retry with exponential backoff
- **AND** it SHALL NOT enter dormant state for that token

#### Scenario: Non-retryable error triggers dormant state

- **WHEN** a token refresh for REZICS_SESSION fails because the user does not exist on the business server (e.g., 404 or a specific error code indicating "user not found")
- **THEN** AuthProvider SHALL stop retrying for REZICS_SESSION
- **AND** it SHALL enter dormant state for that token

#### Scenario: Auth session expired clears all managed tokens

- **WHEN** AUTH_IDENTITY refresh fails because the auth session no longer exists (cookie invalid/expired)
- **THEN** AuthProvider SHALL clear all managed tokens from localStorage
- **AND** downstream tokens (REZICS_SESSION) SHALL NOT be attempted

### Requirement: Dormant tokens reactivate on localStorage observation

When a managed token is in dormant state, AuthProvider SHALL observe localStorage for external writes to that token's key. Upon detection, it SHALL exit dormant state and begin managing that token's refresh lifecycle.

#### Scenario: Login flow writes token, AuthProvider resumes

- **WHEN** REZICS_SESSION is dormant because the user was not provisioned
- **AND** the login flow calls `issueSessionToken()` which writes REZICS_SESSION to localStorage
- **THEN** AuthProvider SHALL detect the write via `AUTH_TOKEN_STORAGE_EVENT` or `StorageEvent`
- **AND** it SHALL exit dormant state and schedule refresh based on the token's expiry

#### Scenario: Cross-tab login activates dormant token

- **WHEN** REZICS_SESSION is dormant in Tab A
- **AND** Tab B completes login and writes REZICS_SESSION to localStorage
- **THEN** Tab A's AuthProvider SHALL detect the `StorageEvent`
- **AND** it SHALL exit dormant state and begin managing refresh

### Requirement: AuthProvider recovers on visibility change

When the document becomes visible after being hidden, AuthProvider SHALL check all managed tokens and refresh any that are expired or missing.

#### Scenario: Tab returns from background with expired token

- **WHEN** the user returns to a tab that has been in the background
- **AND** AUTH_IDENTITY has expired during the background period
- **THEN** AuthProvider SHALL refresh AUTH_IDENTITY immediately
- **AND** upon success, proceed to refresh REZICS_SESSION if needed

### Requirement: AuthProvider does not perform user provisioning

AuthProvider SHALL NOT call `ensure()`, `userApi.ensure()`, or any user provisioning endpoint. Provisioning is the responsibility of the login flow.

#### Scenario: First-time user with no business session

- **WHEN** AuthProvider attempts to obtain REZICS_SESSION for a user who has not been provisioned
- **AND** the server returns a "user not found" error
- **THEN** AuthProvider SHALL enter dormant state for REZICS_SESSION
- **AND** it SHALL NOT attempt to provision the user

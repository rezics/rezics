## MODIFIED Requirements

### Requirement: AuthProvider accepts a configurable token array

AuthProvider SHALL accept a `tokens` parameter specifying which token names to manage (e.g., `[AUTH_IDENTITY, REZICS_SESSION]`). The first token in the array SHALL always be `AUTH_IDENTITY` (the gateway). All subsequent tokens are independent service tokens with no ordering dependency on each other. When `tokens` is omitted or `undefined`, AuthProvider SHALL default to managing `[AUTH_IDENTITY]` only.

#### Scenario: App frontend configures identity and session tokens

- **WHEN** AuthProvider is mounted with `tokens={[AUTH_IDENTITY, REZICS_SESSION]}`
- **THEN** it SHALL manage refresh lifecycle for both AUTH_IDENTITY and REZICS_SESSION
- **AND** it SHALL refresh AUTH_IDENTITY before attempting REZICS_SESSION

#### Scenario: Admin frontend configures identity and session tokens

- **WHEN** AuthProvider is mounted with `tokens={[AUTH_IDENTITY, REZICS_SESSION]}`
- **THEN** it SHALL manage both tokens
- **AND** it SHALL behave identically to the app frontend configuration

#### Scenario: AuthProvider mounted without tokens prop

- **WHEN** AuthProvider is mounted without a `tokens` prop
- **THEN** it SHALL default to managing `[AUTH_IDENTITY]` only
- **AND** it SHALL NOT attempt to refresh any service tokens

### Requirement: AuthProvider uses gateway + fan-out refresh model

AuthProvider SHALL treat `AUTH_IDENTITY` as the gateway token. All other tokens in the array are service tokens that refresh independently and in parallel. If the gateway fails non-retryably, all service tokens stop. If a service token fails, other service tokens are unaffected.

#### Scenario: Gateway succeeds, service tokens refresh in parallel

- **WHEN** AUTH_IDENTITY is refreshed successfully
- **AND** both REZICS_SESSION and NOTIFICATION_SESSION need refresh
- **THEN** AuthProvider SHALL refresh REZICS_SESSION and NOTIFICATION_SESSION in parallel via `Promise.allSettled()`
- **AND** neither token's result SHALL block the other

#### Scenario: One service token fails, others continue

- **WHEN** REZICS_SESSION refresh fails with a non-retryable error
- **AND** NOTIFICATION_SESSION refresh succeeds
- **THEN** REZICS_SESSION SHALL enter dormant state
- **AND** NOTIFICATION_SESSION SHALL enter managing state
- **AND** AuthProvider SHALL continue scheduling refresh for NOTIFICATION_SESSION

#### Scenario: Gateway failure stops all service tokens

- **WHEN** AUTH_IDENTITY refresh fails non-retryably (session expired)
- **THEN** AuthProvider SHALL clear all managed tokens from localStorage
- **AND** no service token refresh SHALL be attempted

### Requirement: AuthProvider delegates refresh to token refresh registry

AuthProvider SHALL NOT contain hardcoded refresh logic for service tokens. It SHALL accept a `registry` prop of type `TokenRefreshRegistry` and look up the refresh function for each service token. AUTH_IDENTITY refresh remains handled directly via `queryAccessToken()`.

#### Scenario: Service token refreshed via registry

- **WHEN** REZICS_SESSION needs refresh
- **THEN** AuthProvider SHALL call `registry[REZICS_SESSION]()`
- **AND** on success, it SHALL write the returned token to localStorage

#### Scenario: No registry entry for a token

- **WHEN** a token in the `tokens` array has no entry in the registry
- **THEN** AuthProvider SHALL treat it as a non-retryable failure
- **AND** the token SHALL enter dormant state immediately

### Requirement: AuthProvider has no direct imports of service-specific modules

AuthProvider SHALL NOT import `userApi`, `notificationApi`, or any other service-specific API module. All service-specific logic SHALL be encapsulated in the token refresh registry entries.

#### Scenario: AuthProvider import graph

- **WHEN** AuthProvider's import statements are inspected
- **THEN** it SHALL NOT contain imports from `@package/api/user/*`, `@package/api/notification/*`, or similar service-specific paths
- **AND** it SHALL only import from `@package/api/react-query/*` (token utilities) and `@package/contract` (token types)

### Requirement: AuthProvider reacts to failure type

AuthProvider SHALL distinguish between retryable and non-retryable failures when refreshing a service token.

#### Scenario: Retryable error triggers backoff for that token only

- **WHEN** a service token refresh fails due to a network error or 5xx response
- **THEN** AuthProvider SHALL retry with exponential backoff for that token
- **AND** other service tokens SHALL NOT be affected
- **AND** the next refresh cycle SHALL still process healthy tokens normally

#### Scenario: Non-retryable error triggers dormant state for that token only

- **WHEN** a service token refresh fails because the user does not exist on that service
- **THEN** AuthProvider SHALL enter dormant state for that token only
- **AND** other service tokens SHALL continue refreshing normally

#### Scenario: Auth session expired clears all managed tokens

- **WHEN** AUTH_IDENTITY refresh fails because the auth session no longer exists
- **THEN** AuthProvider SHALL clear all managed tokens from localStorage
- **AND** no service tokens SHALL be attempted

### Requirement: AuthProvider refreshes tokens proactively before expiry

AuthProvider SHALL schedule token refresh before the token's JWT expiration. The refresh buffer SHALL be configurable with a sensible default (e.g., 60 seconds). The next refresh cycle SHALL be scheduled based on the earliest expiry across all managing tokens and the earliest retry delay across all tokens in backoff.

#### Scenario: Token refreshed before expiry

- **WHEN** AUTH_IDENTITY has 45 seconds remaining and the refresh buffer is 60 seconds
- **THEN** AuthProvider SHALL initiate a refresh for AUTH_IDENTITY
- **AND** upon success, it SHALL write the new token to localStorage and reschedule

#### Scenario: Multiple tokens with different expiry times

- **WHEN** REZICS_SESSION expires in 30 seconds and NOTIFICATION_SESSION expires in 120 seconds
- **AND** the refresh buffer is 60 seconds
- **THEN** the next refresh cycle SHALL be scheduled based on REZICS_SESSION's expiry (the earliest)
- **AND** only REZICS_SESSION SHALL be refreshed in that cycle
- **AND** NOTIFICATION_SESSION SHALL be refreshed in a later cycle

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
- **AND** upon success, proceed to refresh service tokens in parallel if needed

### Requirement: AuthProvider does not perform user provisioning

AuthProvider SHALL NOT call `ensure()`, `userApi.ensure()`, or any user provisioning endpoint. Provisioning is the responsibility of the login flow.

#### Scenario: First-time user with no business session

- **WHEN** AuthProvider attempts to refresh REZICS_SESSION for a user who has not been provisioned
- **AND** the registry refresh function throws a "user not found" error
- **THEN** AuthProvider SHALL enter dormant state for REZICS_SESSION
- **AND** it SHALL NOT attempt to provision the user

### Requirement: AuthProvider is stateless and side-effect free to consumers

AuthProvider SHALL NOT maintain Zustand, Jotai, or React context state for token values or claims. It SHALL NOT expose any context provider that consumers read from. Its sole observable effect SHALL be writing tokens to localStorage and dispatching storage events. Token-specific side effects (e.g., store syncing) are the responsibility of registry refresh functions, not AuthProvider.

#### Scenario: No consumer-facing state

- **WHEN** AuthProvider is mounted and actively managing tokens
- **THEN** no React context, Zustand store, or global state SHALL be written by AuthProvider
- **AND** tokens SHALL exist only in localStorage

#### Scenario: Token write dispatches storage events

- **WHEN** AuthProvider writes or removes a token in localStorage
- **THEN** it SHALL dispatch the `AUTH_TOKEN_STORAGE_EVENT` custom event for same-tab listeners
- **AND** the standard `StorageEvent` SHALL propagate to other tabs

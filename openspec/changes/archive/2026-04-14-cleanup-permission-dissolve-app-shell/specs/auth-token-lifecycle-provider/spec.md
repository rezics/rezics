## MODIFIED Requirements

### Requirement: AuthProvider accepts a configurable token array

AuthProvider SHALL accept `tokens` parameter specifying which token names to manage. The default configuration SHALL include `AUTH_IDENTITY` and `REZICS_SESSION`. The ordering defines the dependency chain: `AUTH_IDENTITY` is refreshed first (via session cookie), then `REZICS_SESSION` (via exchange using the refreshed `AUTH_IDENTITY`). AuthProvider SHALL be exported from `@rezics/api` (not `@rezics/app-shell`).

#### Scenario: AuthProvider managed two tokens with dependency ordering

- **WHEN** AuthProvider initializes with default configuration
- **THEN** it manages `AUTH_IDENTITY` and `REZICS_SESSION` tokens, refreshing them in dependency order

#### Scenario: AuthProvider imported from @rezics/api

- **WHEN** an app needs the auth provider
- **THEN** it imports `AuthProvider` from `@rezics/api`

### Requirement: AuthProvider refreshes tokens proactively before expiry

AuthProvider SHALL schedule token refresh before JWT expiration with configurable refresh buffer (default 60 seconds). Each token has its own independent refresh schedule. When `REZICS_SESSION` needs refresh, AuthProvider SHALL first ensure `AUTH_IDENTITY` is valid, refreshing it if needed.

#### Scenario: REZICS_SESSION refresh triggers AUTH_IDENTITY check

- **WHEN** `REZICS_SESSION` is approaching expiry and `AUTH_IDENTITY` is also expired
- **THEN** AuthProvider refreshes `AUTH_IDENTITY` first (via session cookie), then exchanges it for a new `REZICS_SESSION`

#### Scenario: REZICS_SESSION refresh with valid AUTH_IDENTITY

- **WHEN** `REZICS_SESSION` is approaching expiry and `AUTH_IDENTITY` is still valid
- **THEN** AuthProvider exchanges the existing `AUTH_IDENTITY` for a new `REZICS_SESSION` without refreshing `AUTH_IDENTITY`

### Requirement: AuthProvider is stateless and side-effect free to consumers

AuthProvider SHALL NOT maintain Zustand/Jotai/React context state. Sole observable effect SHALL be writing tokens to localStorage and dispatching storage events. Consumers read tokens from localStorage or from stores that observe localStorage events.

#### Scenario: Token refresh updates localStorage

- **WHEN** AuthProvider refreshes a token
- **THEN** the new token is written to localStorage and a `package-auth-token-storage` custom event is dispatched

### Requirement: AuthProvider reacts to failure type

AuthProvider SHALL distinguish between retryable failures (network errors, 5xx) and non-retryable failures (401, 403, 404). On non-retryable failure for `AUTH_IDENTITY`, both tokens enter dormant state. On non-retryable failure for `REZICS_SESSION` only, `REZICS_SESSION` enters dormant while `AUTH_IDENTITY` continues refreshing.

#### Scenario: AUTH_IDENTITY non-retryable failure makes both dormant

- **WHEN** `AUTH_IDENTITY` refresh fails with 401 (session expired)
- **THEN** both `AUTH_IDENTITY` and `REZICS_SESSION` enter dormant state (user must re-login)

### Requirement: AuthProvider recovers on visibility change

When document becomes visible after hidden, AuthProvider SHALL check all managed tokens and refresh any expired/missing. This ensures tokens are fresh after the user returns from a background tab.

#### Scenario: Returning from background refreshes expired tokens

- **WHEN** the browser tab becomes visible and the `REZICS_SESSION` has expired
- **THEN** AuthProvider refreshes `AUTH_IDENTITY` if needed, then exchanges for a new `REZICS_SESSION`

### Requirement: AuthProvider does not perform user provisioning

AuthProvider SHALL NOT call `ensure()` or user provisioning endpoint. Provisioning is the responsibility of the auth `afterSignUp` hook.

#### Scenario: AuthProvider skips provisioning

- **WHEN** AuthProvider refreshes tokens for a newly registered user
- **THEN** it does not call any provisioning endpoint (the user was provisioned during registration)

### Requirement: authSessionStore hydrates permission from session token

When `authSessionStore` hydrates from a refreshed `REZICS_SESSION` token, it SHALL parse the token's `permission` claim and expose it as the `permission` field. It SHALL NOT derive or expose `capabilityLevel`.

#### Scenario: Store hydrates permission after token refresh

- **WHEN** AuthProvider writes a new `REZICS_SESSION` token to localStorage
- **THEN** `authSessionStore` reads the token's `permission` claim and updates its `permission` field accordingly

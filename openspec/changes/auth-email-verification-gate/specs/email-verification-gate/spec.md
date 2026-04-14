## ADDED Requirements

### Requirement: Exchange guard rejects unverified identity tokens

`exchangeForSessionToken()` SHALL parse the auth identity token claims before making a server call. If `email_verified === false`, it SHALL return `null` without calling the exchange endpoint. If `email_verified` is absent or the token has no such claim, the exchange SHALL proceed normally.

#### Scenario: Unverified token skips exchange

- **WHEN** `exchangeForSessionToken()` is called and the stored identity token has `email_verified: false` in its claims
- **THEN** it returns `null` without making a network request to `/session/exchange`

#### Scenario: Verified token proceeds with exchange

- **WHEN** `exchangeForSessionToken()` is called and the stored identity token does not have `email_verified: false`
- **THEN** it calls `POST /session/exchange` with the identity token as normal

### Requirement: Login tolerates unverified email

The `login()` function SHALL NOT throw when the identity token has `email_verified: false`. It SHALL hydrate auth session state and return successfully, allowing the UI to route based on `needsVerification` state.

#### Scenario: Login with unverified email

- **WHEN** a user signs in with valid credentials but their email is not verified
- **THEN** `login()` acquires the identity token, skips the exchange, hydrates auth state with `needsVerification: true`, and returns without error

#### Scenario: Login with verified email

- **WHEN** a user signs in with valid credentials and their email is verified
- **THEN** `login()` acquires the identity token, exchanges for a session token, hydrates auth state, and returns the session token

### Requirement: Registration tolerates unverified email

The `register()` function SHALL NOT throw when the identity token has `email_verified: false`. It SHALL hydrate auth session state and return successfully.

#### Scenario: Registration with email verification pending

- **WHEN** a user completes email/password registration (email not yet verified)
- **THEN** `register()` acquires the identity token, skips the exchange, hydrates auth state with `needsVerification: true`, and returns without error

### Requirement: Verify-email refresh fetches a new identity token

The verify-email page "Refresh" action SHALL force-fetch a new identity token from the auth service (via `queryAccessToken()`) before hydrating auth session state. This ensures updated `email_verified` claims are picked up.

#### Scenario: Refresh after verification

- **WHEN** the user has verified their email and clicks "Refresh" on the verify-email page
- **THEN** the page fetches a fresh identity token from the auth service, the new token does not contain `email_verified: false`, auth state is hydrated as verified, and the user is redirected to the app

#### Scenario: Refresh before verification

- **WHEN** the user clicks "Refresh" but has not yet verified their email
- **THEN** the page fetches a fresh identity token, the token still contains `email_verified: false`, and the page remains in the verification-needed state

### Requirement: Verify-email refresh triggers exchange after verification

After fetching a fresh identity token that no longer has `email_verified: false`, the refresh flow SHALL call `exchangeForSessionToken()` to acquire a session token before redirecting.

#### Scenario: Exchange after successful verification refresh

- **WHEN** the refresh flow detects that the new identity token is verified
- **THEN** it calls `exchangeForSessionToken()`, stores the session token, and redirects the user

### Requirement: localStorage snapshot includes email_verified

`writeAuthSnapshot()` SHALL include `email_verified` in the persisted state object. The value SHALL be `false` when the identity token claim is explicitly `false`, and omitted otherwise.

#### Scenario: Unverified token snapshot

- **WHEN** an identity token with `email_verified: false` is stored via `setToken()`
- **THEN** the localStorage snapshot includes `email_verified: false` in its state

#### Scenario: Verified token snapshot

- **WHEN** an identity token without `email_verified` claim is stored via `setToken()`
- **THEN** the localStorage snapshot does not include `email_verified` (or it is omitted)

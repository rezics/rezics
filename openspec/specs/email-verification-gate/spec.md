### Requirement: Verify-email refresh fetches a new identity token

The verify-email page "Refresh" action SHALL force-fetch a new identity token from the auth service (via `queryAccessToken()`) before hydrating auth session state. This ensures updated `email_verified` claims are picked up. After successful OTP verification, the refresh action detects the verified state and proceeds with token exchange.

#### Scenario: Refresh after OTP verification

- **WHEN** the user has verified their email via OTP code and clicks "Refresh" on the verify-email page
- **THEN** the page fetches a fresh identity token from the auth service, the new token does not contain `email_verified: false`, auth state is hydrated as verified, and the user is redirected to the app

#### Scenario: Refresh before verification

- **WHEN** the user clicks "Refresh" but has not yet verified their email via OTP
- **THEN** the page fetches a fresh identity token, the token still contains `email_verified: false`, and the page remains in the verification-needed state

### Requirement: Verify-email refresh triggers exchange after verification

After fetching a fresh identity token that no longer has `email_verified: false`, the refresh flow SHALL call `exchangeForSessionToken()` to acquire a session token before redirecting.

#### Scenario: Exchange after successful verification refresh

- **WHEN** the refresh flow detects that the new identity token is verified
- **THEN** it calls `exchangeForSessionToken()`, stores the session token, and redirects the user

## MODIFIED Requirements

### Requirement: AuthProvider does not perform user provisioning

AuthProvider SHALL NOT call `ensure()` or user provisioning endpoint. Provisioning is the responsibility of the auth `user.create.after` hook (for verified-at-creation users) and the verify-email middleware (for deferred email/password users). When the AuthProvider refresh cycle detects that `email_verified: false` has been removed from a refreshed identity token, the exchange guard in `exchangeForSessionToken()` will automatically allow the exchange to proceed on the next refresh cycle.

#### Scenario: AuthProvider skips provisioning

- **WHEN** AuthProvider refreshes tokens for a newly registered user
- **THEN** it does not call any provisioning endpoint (provisioning happens via the auth service hooks/middleware)

#### Scenario: AuthProvider auto-unblocks exchange after verification

- **WHEN** AuthProvider refreshes `AUTH_IDENTITY` and the new token no longer has `email_verified: false`
- **THEN** the next `REZICS_SESSION` refresh succeeds because `exchangeForSessionToken()` no longer short-circuits

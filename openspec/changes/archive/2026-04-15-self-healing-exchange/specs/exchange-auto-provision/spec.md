## ADDED Requirements

### Requirement: Auto-provision on exchange

The `POST /session/exchange` endpoint SHALL auto-provision a user record when the user exists in the auth database but not on the main server, provided the auth-session JWT indicates the user's email is verified.

#### Scenario: Verified user not yet provisioned

- **WHEN** a valid auth-session JWT is presented to `POST /session/exchange`, the JWT `email_verified` claim is absent (indicating verified), and no user record exists for the extracted `unitId`
- **THEN** the server SHALL create a user record via `UserService.provisionFromJwt()` using claims from the JWT (`sub` as `unitId`, `name`, `slug`), and return a valid rezics-session-token as if the user had been pre-provisioned

#### Scenario: Unverified user attempts exchange

- **WHEN** a valid auth-session JWT is presented to `POST /session/exchange`, the JWT contains `email_verified: false`, and no user record exists for the extracted `unitId`
- **THEN** the server SHALL reject the request with HTTP 403 and the message "Email not verified"
- **AND** the server SHALL NOT create a user record

#### Scenario: Already-provisioned user exchanges token

- **WHEN** a valid auth-session JWT is presented and a user record already exists for the `unitId`
- **THEN** the behavior SHALL be identical to the current implementation (look up user, sign rezics-session-token with role from DB)

#### Scenario: Concurrent provisioning (idempotency)

- **WHEN** two simultaneous exchange requests arrive for the same unprovisioned user
- **THEN** both requests SHALL succeed — `provisionFromJwt` uses database upsert, so the second call is a no-op on the create and both callers receive valid tokens

---

### Requirement: Eager provisioning via JWT-based exchange

After OTP email verification succeeds, the auth service's route interceptor SHALL attempt eager provisioning by signing an auth-session JWT and calling `POST /session/exchange` on the main server. This call is best-effort.

#### Scenario: Eager provisioning succeeds

- **WHEN** OTP verification returns a successful response with `body.user.id`, and the server is reachable
- **THEN** the auth service SHALL sign an auth-session JWT for the verified user and send it to `POST ${SERVER_BASE_URL}/session/exchange`
- **AND** the auth service SHALL discard the returned rezics-session-token (it is not needed)

#### Scenario: Eager provisioning fails

- **WHEN** the exchange call fails for any reason (server unreachable, timeout, error response)
- **THEN** the auth service SHALL log the error and continue — the verify-email response to the frontend is unaffected
- **AND** the user SHALL still be provisioned on their first frontend-initiated exchange (via the auto-provision fallback)

#### Scenario: SERVER_INTERNAL_SECRET is not required

- **WHEN** the auth service performs eager provisioning
- **THEN** it SHALL use a signed auth-session JWT as the authentication mechanism, not the `SERVER_INTERNAL_SECRET` header
- **AND** `SERVER_INTERNAL_SECRET` SHALL NOT be required in the auth service's environment for the registration critical path to succeed

---

### Requirement: Auth-presence cookie on OTP verification

#### Scenario: OTP verify with auto-sign-in

- **WHEN** `POST /api/auth/email-otp/verify-email` returns a successful response and `autoSignInAfterVerification` is enabled
- **THEN** the auth-presence cookie SHALL be set on the response, matching the behavior of other session-establishing paths (`/sign-in`, `/oauth/callback`)

---

### Requirement: Documentation (JSDoc)

#### Scenario: Database hook clarity

- **WHEN** a developer reads the `databaseHooks.user.create.after` hook in `instance.ts`
- **THEN** a JSDoc comment SHALL explain that this hook is designed for OAuth flows only, and that email-registered users are provisioned via the route interceptor and exchange fallback

#### Scenario: Exchange unitId mapping clarity

- **WHEN** a developer reads the `POST /session/exchange` endpoint in `session.api.ts`
- **THEN** a JSDoc comment SHALL explain that `sub` from the auth JWT maps to `unitId` in the server's user model

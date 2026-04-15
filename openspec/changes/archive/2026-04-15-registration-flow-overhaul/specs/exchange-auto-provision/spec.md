## MODIFIED Requirements

### Requirement: Auto-provision on exchange

The `POST /session/exchange` endpoint SHALL auto-provision a user record when the user exists in the auth database but not on the main server, provided the auth-session JWT indicates BOTH: (1) the user's email is verified, AND (2) the user has a confirmed identity (the JWT contains a non-null `slug` claim, indicating `UserProfile` exists in the auth DB).

#### Scenario: Fully registered user not yet provisioned

- **WHEN** a valid auth-session JWT is presented to `POST /session/exchange`, the JWT does not contain `email_verified: false`, the JWT contains a non-null `slug` claim, and no user record exists for the extracted `unitId`
- **THEN** the server SHALL create a user record via `UserService.provisionFromJwt()` using claims from the JWT (`sub` as `unitId`, `name`, `slug`), and return a valid rezics-session-token

#### Scenario: Unverified user attempts exchange

- **WHEN** a valid auth-session JWT is presented to `POST /session/exchange`, the JWT contains `email_verified: false`, and no user record exists for the extracted `unitId`
- **THEN** the server SHALL reject the request with HTTP 403 and the message "Email not verified"
- **AND** the server SHALL NOT create a user record

#### Scenario: User without identity step attempts exchange

- **WHEN** a valid auth-session JWT is presented to `POST /session/exchange`, the JWT does not contain a `slug` claim (or slug is null), and no user record exists for the extracted `unitId`
- **THEN** the server SHALL reject the request with HTTP 403 and the message "Registration incomplete"
- **AND** the server SHALL NOT create a user record

#### Scenario: Already-provisioned user exchanges token

- **WHEN** a valid auth-session JWT is presented and a user record already exists for the `unitId`
- **THEN** the behavior SHALL be identical to the current implementation (look up user, sign rezics-session-token with role from DB)

#### Scenario: Concurrent provisioning (idempotency)

- **WHEN** two simultaneous exchange requests arrive for the same unprovisioned user who has completed both registration steps
- **THEN** both requests SHALL succeed -- `provisionFromJwt` uses database upsert, so the second call is a no-op on the create and both callers receive valid tokens

## ADDED Requirements

### Requirement: Auth afterSignUp hook provisions server user synchronously

The auth service SHALL register a `afterSignUp` lifecycle hook with better-auth that calls the server's internal provisioning endpoint during user registration. The hook SHALL send `{ unitId, slug, name }` derived from the newly created auth user. If the provisioning call fails, registration SHALL fail and the error SHALL propagate to the client.

#### Scenario: Successful registration provisions server user

- **WHEN** a user completes registration via the auth service
- **THEN** the `afterSignUp` hook calls `POST <server>/internal/users/provision` with the user's `unitId`, `slug`, and `name`, and the server creates the user record before the registration response is returned to the client

#### Scenario: Server provisioning failure fails registration

- **WHEN** the `afterSignUp` hook's call to the server provisioning endpoint fails (network error, server error)
- **THEN** the registration response returns an error status to the client, and the user is informed registration did not complete

### Requirement: Server internal provisioning endpoint

The server SHALL expose `POST /internal/users/provision` authenticated via `x-internal-secret` header (matching existing internal endpoint pattern). The endpoint SHALL accept `{ unitId, slug, name }` and perform an idempotent upsert (`INSERT ... ON CONFLICT (unitId) DO NOTHING`). The endpoint SHALL NOT update existing user records — it is create-only.

#### Scenario: First-time provisioning creates user record

- **WHEN** the provisioning endpoint receives a request with a `unitId` that does not exist in the server database
- **THEN** a new user record is created with the provided `unitId`, `slug`, `name`, and default role MEMBER

#### Scenario: Duplicate provisioning is idempotent

- **WHEN** the provisioning endpoint receives a request with a `unitId` that already exists
- **THEN** no changes are made to the existing record and the endpoint returns success

#### Scenario: Missing or invalid internal secret returns 403

- **WHEN** the provisioning endpoint receives a request without a valid `x-internal-secret` header
- **THEN** the endpoint returns status 403
